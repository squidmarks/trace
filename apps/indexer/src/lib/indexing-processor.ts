import { ObjectId } from "mongodb"
import { getDocumentsCollection, getPagesCollection, getIndexJobsCollection } from "./db.js"
import { fetchDocument } from "./document-fetcher.js"
import { renderPdfToImages } from "./pdf-renderer.js"
import { analyzePage } from "./ai-analyzer.js"
import logger from "./logger.js"
import type { Server } from "socket.io"
import type { IndexJob } from "@trace/shared"

/**
 * Create a new index job
 */
export async function createIndexJob(
  workspaceId: string,
  documentIds?: string[],
  options?: {
    renderDpi?: number
    renderQuality?: number
    analysisModel?: string
    analysisDetail?: "low" | "auto" | "high"
  }
): Promise<string> {
  const indexJobs = await getIndexJobsCollection()
  
  const job: Omit<IndexJob, "_id"> = {
    workspaceId: new ObjectId(workspaceId),
    status: "queued",
    progress: {
      totalDocuments: 0,
      processedDocuments: 0,
      totalPages: 0,
      processedPages: 0,
      analyzedPages: 0,
    },
    cost: {
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
    },
    documentIds: documentIds?.map((id) => new ObjectId(id)),
    renderDpi: options?.renderDpi || 150,
    renderQuality: options?.renderQuality || 85,
    modelConfig: {
      analysis: options?.analysisModel || process.env.ANALYSIS_MODEL || "gpt-4o-mini",
      analysisDetail: options?.analysisDetail || "auto",
    },
    startedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const result = await indexJobs.insertOne(job as IndexJob)
  logger.info(`📋 Created index job: ${result.insertedId} for workspace: ${workspaceId}`)
  logger.info(`   📊 Settings: DPI=${job.renderDpi}, Quality=${job.renderQuality}, Model=${job.modelConfig.analysis}, Detail=${job.modelConfig.analysisDetail}`)
  
  return result.insertedId.toString()
}

/**
 * Process an index job (can be new or resumed)
 */
export async function processIndexJob(
  jobId: string,
  io: Server
): Promise<void> {
  const indexJobs = await getIndexJobsCollection()
  const documents = await getDocumentsCollection()
  const pages = await getPagesCollection()

  const job = await indexJobs.findOne({ _id: new ObjectId(jobId) })
  if (!job) {
    logger.error(`❌ Job not found: ${jobId}`)
    return
  }

  const workspaceId = job.workspaceId.toString()

  try {
    const isResume = job.status === "in-progress"
    logger.info(`🚀 Processing index job: ${jobId} (${job.status})${isResume ? " - RESUMING" : " - FRESH START"}`)

    // Update job status to in-progress
    await indexJobs.updateOne(
      { _id: job._id },
      { $set: { status: "in-progress", updatedAt: new Date() } }
    )

    // 1. Get documents to process
    const query: any = { workspaceId: job.workspaceId }
    if (job.documentIds && job.documentIds.length > 0) {
      query._id = { $in: job.documentIds }
    }

    const docsToProcess = await documents.find(query).toArray()

    if (docsToProcess.length === 0) {
      logger.warn(`No documents found for job: ${jobId}`)
      await indexJobs.updateOne(
        { _id: job._id },
        { 
          $set: { 
            status: "failed",
            error: "No documents found to index",
            completedAt: new Date(),
            updatedAt: new Date(),
          } 
        }
      )
      io.to(`workspace:${workspaceId}`).emit("index:error", {
        workspaceId,
        error: "No documents found to index",
      })
      return
    }

    logger.info(`📄 Found ${docsToProcess.length} documents to process`)

    // Reset progress counters ONLY for fresh start (not resume)
    if (!isResume) {
      logger.info(`🔄 Resetting progress counters for fresh start`)
      
      // Delete ALL pages for this workspace to ensure clean state
      // This prevents stale pages from remaining if indexing is aborted partway through
      const deleteResult = await pages.deleteMany({ workspaceId: job.workspaceId })
      logger.info(`🧹 Deleted ${deleteResult.deletedCount} existing pages for fresh re-index`)
      
      await indexJobs.updateOne(
        { _id: job._id },
        { 
          $set: { 
            "progress.totalDocuments": docsToProcess.length,
            "progress.processedDocuments": 0,
            "progress.totalPages": 0,
            "progress.processedPages": 0,
            "progress.analyzedPages": 0,
            updatedAt: new Date() 
          } 
        }
      )
      
      // Refresh job object to get reset progress
      const refreshedJob = await indexJobs.findOne({ _id: job._id })
      if (refreshedJob) {
        job.progress = refreshedJob.progress
      }
    } else {
      logger.info(`🔄 Resuming with existing progress: ${job.progress.analyzedPages}/${job.progress.totalPages} pages analyzed`)
    }

    // Emit immediate progress so UI shows activity right away
    io.to(`workspace:${workspaceId}`).emit("index:progress", {
      workspaceId,
      phase: "processing",
      totalDocuments: docsToProcess.length,
      processedDocuments: job.progress.processedDocuments,
      totalPages: job.progress.totalPages,
      processedPages: job.progress.processedPages,
      analyzedPages: job.progress.analyzedPages,
      message: "Starting indexing job...",
    })
    logger.info(`📤 Sent initial progress to UI`)

    // 2. Process each document
    let totalCost = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0

    for (const doc of docsToProcess) {
      const docId = doc._id.toString()
      const filename = doc.filename

      // Per-document counters (reset for each document)
      let currentDocumentTotalPages = 0
      let currentDocumentProcessedPages = 0
      let currentDocumentAnalyzedPages = 0

      // Emit immediate progress for this document
      io.to(`workspace:${workspaceId}`).emit("index:progress", {
        workspaceId,
        phase: "processing",
        currentDocument: {
          id: docId,
          filename,
          current: job.progress.processedDocuments + 1,
          total: docsToProcess.length,
          totalPages: currentDocumentTotalPages,
          processedPages: currentDocumentProcessedPages,
          analyzedPages: currentDocumentAnalyzedPages,
        },
        totalDocuments: docsToProcess.length,
        processedDocuments: job.progress.processedDocuments,
        totalPages: job.progress.totalPages || 0,
        processedPages: job.progress.processedPages || 0,
        analyzedPages: job.progress.analyzedPages || 0,
        message: "Starting document processing...",
      })

      // Check existing pages (for resume mode only, fresh start already deleted all pages)
      const existingPages = isResume 
        ? await pages.find({ documentId: doc._id }).toArray()
        : []
      const existingPageCount = existingPages.length
      const analyzedPagesCount = existingPages.filter(p => p.analysis !== null).length
      
      if (isResume && existingPageCount > 0) {
        logger.info(`🔄 Resuming document: ${filename} (${existingPageCount} pages exist, ${analyzedPagesCount} analyzed)`)
      }

      logger.info(`📄 Processing document ${job.progress.processedDocuments + 1}/${docsToProcess.length}: ${filename}`)

      // Fetch fresh job state for accurate initial progress
      const currentJob = await indexJobs.findOne({ _id: job._id })
      
      // Emit initial progress
      io.to(`workspace:${workspaceId}`).emit("index:progress", {
        workspaceId,
        phase: "processing",
        currentDocument: {
          id: docId,
          filename,
          current: job.progress.processedDocuments + 1,
          total: docsToProcess.length,
          totalPages: currentDocumentTotalPages,
          processedPages: currentDocumentProcessedPages,
          analyzedPages: currentDocumentAnalyzedPages,
        },
        totalDocuments: docsToProcess.length,
        processedDocuments: currentJob?.progress.processedDocuments || 0,
        totalPages: currentJob?.progress.totalPages || 0,
        processedPages: currentJob?.progress.processedPages || 0,
        analyzedPages: currentJob?.progress.analyzedPages || 0,
        message: "Initializing document...",
      })

      try {
        // Update document status
        await documents.updateOne(
          { _id: doc._id },
          { 
            $set: { 
              status: "processing",
              updatedAt: new Date(),
            } 
          }
        )

        let allPages: Array<{ pageNumber: number; imageData: string; width: number; height: number; _id?: any }> = []
        
        // Determine if we need to render
        const needsRendering = !isResume || existingPageCount === 0
        
        if (needsRendering) {
          // Emit "Downloading document..." if from URL
          const isFromUrl = doc.sourceType === "url"
          if (isFromUrl) {
            logger.info(`📥 Downloading document from URL...`)
            io.to(`workspace:${workspaceId}`).emit("index:progress", {
              workspaceId,
              phase: "processing",
              currentDocument: {
                id: docId,
                filename,
                current: job.progress.processedDocuments + 1,
                total: docsToProcess.length,
                totalPages: currentDocumentTotalPages,
                processedPages: currentDocumentProcessedPages,
                analyzedPages: currentDocumentAnalyzedPages,
              },
              totalDocuments: docsToProcess.length,
              processedDocuments: job.progress.processedDocuments,
              totalPages: job.progress.totalPages || 0,
              processedPages: job.progress.processedPages || 0,
              analyzedPages: job.progress.analyzedPages || 0,
              message: "Downloading document...",
            })
          }
          
          // Fetch document
          const fetchedDoc = await fetchDocument(docId)
          
          // Emit "Preparing to parse..." progress
          logger.info(`📖 Preparing to parse document...`)
          io.to(`workspace:${workspaceId}`).emit("index:progress", {
            workspaceId,
            phase: "processing",
            currentDocument: {
              id: docId,
              filename,
              current: job.progress.processedDocuments + 1,
              total: docsToProcess.length,
              totalPages: currentDocumentTotalPages,
              processedPages: currentDocumentProcessedPages,
              analyzedPages: currentDocumentAnalyzedPages,
            },
            totalDocuments: docsToProcess.length,
            processedDocuments: job.progress.processedDocuments,
            totalPages: job.progress.totalPages || 0,
            processedPages: job.progress.processedPages || 0,
            analyzedPages: job.progress.analyzedPages || 0,
            message: "Preparing to parse...",
          })
        
          // Render pages one at a time, saving each immediately
          const renderStartTime = Date.now()
          const renderedPages = await renderPdfToImages(
          fetchedDoc.buffer,
          {
            dpi: job.renderDpi,
            quality: job.renderQuality,
          },
          async (page, current, total) => {
            // First callback: set total pages for this document and increment overall total
            if (current === 1) {
              currentDocumentTotalPages = total
              await indexJobs.updateOne(
                { _id: job._id },
                { 
                  $inc: { 
                    "progress.totalPages": total
                  },
                  $set: {
                    updatedAt: new Date()
                  }
                }
              )
            }
            
            // Save page immediately after rendering
            const pageDoc = {
              _id: new ObjectId(),
              workspaceId: job.workspaceId,
              documentId: doc._id,
              pageNumber: page.pageNumber,
              imageData: page.imageData,
              thumbnailData: page.thumbnailData,
              width: page.width,
              height: page.height,
              analysis: null,
              embedding: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            }

            await pages.insertOne(pageDoc as any)
            allPages.push({ ...page, _id: pageDoc._id })
            
            logger.debug(`   💾 Saved page ${current}/${total}`)
            
            // Update progress (both overall and per-document)
            currentDocumentProcessedPages++
            await indexJobs.updateOne(
              { _id: job._id },
              { 
                $inc: { "progress.processedPages": 1 },
                $set: { updatedAt: new Date() }
              }
            )
            
            // Fetch fresh job state for accurate progress
            const freshJob = await indexJobs.findOne({ _id: job._id })
            
            // Calculate simple ETA based on overall job progress
            const jobElapsed = Date.now() - job.startedAt.getTime()
            const analyzedSoFar = freshJob?.progress.analyzedPages || 0
            const totalToAnalyze = freshJob?.progress.totalPages || total
            let etaSeconds: number | undefined
            if (analyzedSoFar > 0) {
              const avgTimePerAnalyzedPage = jobElapsed / analyzedSoFar
              const remainingToAnalyze = totalToAnalyze - analyzedSoFar
              etaSeconds = Math.round((avgTimePerAnalyzedPage * remainingToAnalyze) / 1000)
            }
            
            // Emit progress after each page
            io.to(`workspace:${workspaceId}`).emit("index:progress", {
              workspaceId,
              phase: "processing",
              currentDocument: {
                id: docId,
                filename,
                current: job.progress.processedDocuments + 1,
                total: docsToProcess.length,
                totalPages: currentDocumentTotalPages,
                processedPages: currentDocumentProcessedPages,
                analyzedPages: currentDocumentAnalyzedPages,
              },
              totalDocuments: docsToProcess.length,
              processedDocuments: freshJob?.progress.processedDocuments || job.progress.processedDocuments,
              totalPages: freshJob?.progress.totalPages || total,
              processedPages: freshJob?.progress.processedPages || 0,
              analyzedPages: freshJob?.progress.analyzedPages || 0,
              message: `Parsing document... (${current}/${total} pages)`,
              etaSeconds: etaSeconds && etaSeconds > 0 ? etaSeconds : undefined,
            })
          }
          )
          
          // Update document page count
          await documents.updateOne(
            { _id: doc._id },
            { $set: { pageCount: renderedPages.length } }
          )
        } else {
          // Resume: use existing pages
          logger.info(`⏭️  Using existing ${existingPageCount} rendered pages`)
          allPages = existingPages.map(p => ({
            pageNumber: p.pageNumber,
            imageData: p.imageData || "",
            width: (p as any).width || 0,
            height: (p as any).height || 0,
            _id: p._id
          }))
          // Set per-document total pages for existing pages
          currentDocumentTotalPages = allPages.length
          currentDocumentProcessedPages = allPages.length
        }

        // Analyze pages that need analysis
        const pagesToAnalyze = allPages.filter(page => {
          const existing = existingPages.find(p => p.pageNumber === page.pageNumber)
          return !existing || existing.analysis === null
        })
        
        logger.info(`🤖 Analyzing ${pagesToAnalyze.length} pages (${allPages.length - pagesToAnalyze.length} already analyzed)...`)
        
        // Set per-document analyzed pages count for already-analyzed pages
        currentDocumentAnalyzedPages = allPages.length - pagesToAnalyze.length
        
        // Emit "Preparing for document analysis..." message
        const currentJobBeforeAnalysis = await indexJobs.findOne({ _id: job._id })
        io.to(`workspace:${workspaceId}`).emit("index:progress", {
          workspaceId,
          phase: "processing",
          currentDocument: {
            id: docId,
            filename,
            current: job.progress.processedDocuments + 1,
            total: docsToProcess.length,
            totalPages: currentDocumentTotalPages,
            processedPages: currentDocumentProcessedPages,
            analyzedPages: currentDocumentAnalyzedPages,
          },
          totalDocuments: docsToProcess.length,
          processedDocuments: currentJobBeforeAnalysis?.progress.processedDocuments || job.progress.processedDocuments,
          totalPages: currentJobBeforeAnalysis?.progress.totalPages || 0,
          processedPages: currentJobBeforeAnalysis?.progress.processedPages || 0,
          analyzedPages: currentJobBeforeAnalysis?.progress.analyzedPages || 0,
          message: "Preparing for document analysis...",
        })
        logger.info(`📤 Sent analysis preparation message to UI`)
        
        // Process each page that needs analysis
        const analysisStartTime = Date.now()
        for (let i = 0; i < pagesToAnalyze.length; i++) {
          // Check if job was cancelled
          const currentJob = await indexJobs.findOne({ _id: job._id })
          if (currentJob?.status === "cancelled") {
            logger.warn(`🛑 Job ${job._id} was cancelled, stopping analysis`)
            return
          }

          const page = pagesToAnalyze[i]
          const pageNum = page.pageNumber
          const pageStartTime = Date.now()

          // Calculate image size for diagnostics
          const imageSizeKB = Math.round(page.imageData.length * 0.75 / 1024) // base64 to bytes to KB

          logger.info(`   🤖 Analyzing page ${pageNum}/${allPages.length} (image: ${imageSizeKB}KB)`)

          // Emit progress BEFORE starting analysis (so user sees immediate update)
          const preAnalysisJob = await indexJobs.findOne({ _id: job._id })
          
          // Calculate simple ETA based on overall job progress
          const jobElapsed = Date.now() - job.startedAt.getTime()
          const analyzedSoFar = preAnalysisJob?.progress.analyzedPages || 0
          const totalToAnalyze = preAnalysisJob?.progress.totalPages || allPages.length
          let etaSeconds: number | undefined
          if (analyzedSoFar > 0) {
            const avgTimePerAnalyzedPage = jobElapsed / analyzedSoFar
            const remainingToAnalyze = totalToAnalyze - analyzedSoFar
            etaSeconds = Math.round((avgTimePerAnalyzedPage * remainingToAnalyze) / 1000)
          }
          
          io.to(`workspace:${workspaceId}`).emit("index:progress", {
            workspaceId,
            phase: "processing",
            currentDocument: {
              id: docId,
              filename,
              current: job.progress.processedDocuments + 1,
              total: docsToProcess.length,
              totalPages: currentDocumentTotalPages,
              processedPages: currentDocumentProcessedPages,
              analyzedPages: currentDocumentAnalyzedPages,
            },
            totalDocuments: docsToProcess.length,
            processedDocuments: preAnalysisJob?.progress.processedDocuments || job.progress.processedDocuments,
            totalPages: preAnalysisJob?.progress.totalPages || allPages.length,
            processedPages: preAnalysisJob?.progress.processedPages || job.progress.processedPages,
            analyzedPages: preAnalysisJob?.progress.analyzedPages || job.progress.analyzedPages,
            message: `Analyzing document... (${currentDocumentAnalyzedPages}/${currentDocumentTotalPages} pages)`,
            etaSeconds: etaSeconds && etaSeconds > 0 ? etaSeconds : undefined,
          })

          // Analyze page
          try {
            const analysisStart = Date.now()
            const { analysis, inputTokens, outputTokens, cost } = await analyzePage(
              page.imageData,
              page.pageNumber,
              filename,
              job.modelConfig.analysis,
              job.modelConfig.analysisDetail
            )
            const analysisTime = Date.now() - analysisStart

            // Update page with analysis
            const dbStart = Date.now()
            await pages.updateOne(
              { _id: page._id },
              { 
                $set: { 
                  analysis,
                  updatedAt: new Date()
                } 
              }
            )
            const dbTime = Date.now() - dbStart

            // Update job cost and progress (both overall and per-document)
            totalInputTokens += inputTokens
            totalOutputTokens += outputTokens
            totalCost += cost
            currentDocumentAnalyzedPages++

            const jobStart = Date.now()
            const updatedJob = await indexJobs.findOneAndUpdate(
              { _id: job._id },
              { 
                $inc: { "progress.analyzedPages": 1 },
                $set: {
                  "cost.inputTokens": totalInputTokens,
                  "cost.outputTokens": totalOutputTokens,
                  "cost.totalCost": totalCost,
                  updatedAt: new Date(),
                }
              },
              { returnDocument: "after" }
            )
            const jobTime = Date.now() - jobStart
            const totalTime = Date.now() - pageStartTime

            logger.info(`   ✅ Page ${pageNum} analyzed ($${cost.toFixed(4)}) | AI: ${(analysisTime/1000).toFixed(1)}s, DB: ${dbTime}ms, Job: ${jobTime}ms, Total: ${(totalTime/1000).toFixed(1)}s`)

            // Calculate simple ETA based on overall job progress
            const jobElapsed = Date.now() - job.startedAt.getTime()
            const analyzedSoFar = updatedJob?.progress.analyzedPages || 0
            const totalToAnalyze = updatedJob?.progress.totalPages || allPages.length
            let etaSecondsAfter: number | undefined
            if (analyzedSoFar > 0) {
              const avgTimePerAnalyzedPage = jobElapsed / analyzedSoFar
              const remainingToAnalyze = totalToAnalyze - analyzedSoFar
              etaSecondsAfter = Math.round((avgTimePerAnalyzedPage * remainingToAnalyze) / 1000)
            }

            // Emit progress with updated values
            io.to(`workspace:${workspaceId}`).emit("index:progress", {
              workspaceId,
              phase: "processing",
              currentDocument: {
                id: docId,
                filename,
                current: job.progress.processedDocuments + 1,
                total: docsToProcess.length,
                totalPages: currentDocumentTotalPages,
                processedPages: currentDocumentProcessedPages,
                analyzedPages: currentDocumentAnalyzedPages,
              },
              totalDocuments: docsToProcess.length,
              processedDocuments: updatedJob?.progress.processedDocuments || job.progress.processedDocuments,
              totalPages: updatedJob?.progress.totalPages || allPages.length,
              processedPages: updatedJob?.progress.processedPages || job.progress.processedPages,
              analyzedPages: updatedJob?.progress.analyzedPages || job.progress.analyzedPages,
              message: `Analyzing document... (${currentDocumentAnalyzedPages}/${currentDocumentTotalPages} pages)`,
              etaSeconds: etaSecondsAfter && etaSecondsAfter > 0 ? etaSecondsAfter : undefined,
            })

          } catch (error) {
            logger.warn(`   ⚠️  Failed to analyze page ${pageNum}: ${error instanceof Error ? error.message : "Unknown error"}`)
            // Continue with next page (page saved but not analyzed)
          }
        }

        // Update document status
        await documents.updateOne(
          { _id: doc._id },
          {
            $set: {
              status: "ready",
              pageCount: allPages.length,
              updatedAt: new Date(),
            },
          }
        )

        // Update job document count
        await indexJobs.updateOne(
          { _id: job._id },
          { 
            $inc: { "progress.processedDocuments": 1 },
            $set: { updatedAt: new Date() }
          }
        )

        logger.info(
          `✅ Document complete: ${filename} - ${allPages.length} pages (Cost: $${totalCost.toFixed(4)})`
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        logger.error(`❌ Failed to process document ${docId}: ${message}`)

        // Mark document as failed
        await documents.updateOne(
          { _id: doc._id },
          {
            $set: {
              status: "failed",
              error: message,
              updatedAt: new Date(),
            },
          }
        )

        // Continue with next document (don't fail entire job)
      }
    }

    // 4. Mark job as complete
    await indexJobs.updateOne(
      { _id: job._id },
      { 
        $set: { 
          status: "complete",
          completedAt: new Date(),
          updatedAt: new Date(),
        } 
      }
    )

    const updatedJob = await indexJobs.findOne({ _id: job._id })
    
    logger.info(`✅ Index job complete: ${updatedJob!.progress.processedDocuments}/${docsToProcess.length} documents, ${updatedJob!.progress.processedPages} pages`)
    logger.info(`💰 Total cost: $${updatedJob!.cost.totalCost.toFixed(4)} (${updatedJob!.cost.inputTokens} input + ${updatedJob!.cost.outputTokens} output tokens)`)

    io.to(`workspace:${workspaceId}`).emit("index:complete", {
      workspaceId,
      documentCount: updatedJob!.progress.processedDocuments,
      pageCount: updatedJob!.progress.processedPages,
      cost: updatedJob!.cost.totalCost,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error(`❌ Index job failed: ${message}`)

    await indexJobs.updateOne(
      { _id: job._id },
      { 
        $set: { 
          status: "failed",
          error: message,
          completedAt: new Date(),
          updatedAt: new Date(),
        } 
      }
    )

    io.to(`workspace:${workspaceId}`).emit("index:error", {
      workspaceId,
      error: message,
    })

    throw error
  }
}

/**
 * Resume all in-progress jobs (called on server startup)
 */
export async function resumeInProgressJobs(io: Server): Promise<void> {
  const indexJobs = await getIndexJobsCollection()
  
  const inProgressJobs = await indexJobs.find({ status: "in-progress" }).toArray()
  
  if (inProgressJobs.length === 0) {
    logger.info("✅ No in-progress jobs to resume")
    return
  }

  logger.info(`🔄 Found ${inProgressJobs.length} in-progress job(s) to resume`)
  
  for (const job of inProgressJobs) {
    logger.info(`   🔄 Resuming job: ${job._id} (workspace: ${job.workspaceId})`)
    
    // Process job asynchronously (don't block startup)
    processIndexJob(job._id.toString(), io).catch((error) => {
      logger.error(`   ❌ Failed to resume job ${job._id}: ${error.message}`)
    })
  }
}

/**
 * Start a new indexing job
 */
export async function startIndexingJob(
  workspaceId: string,
  io: Server,
  options?: {
    documentIds?: string[]
    renderDpi?: number
    renderQuality?: number
    analysisModel?: string
    analysisDetail?: "low" | "auto" | "high"
  }
): Promise<void> {
  // Create job
  const jobId = await createIndexJob(workspaceId, options?.documentIds, options)
  
  // Start processing asynchronously
  processIndexJob(jobId, io).catch((error) => {
    logger.error(`Failed to process job ${jobId}: ${error.message}`)
  })
}

/**
 * Abort an in-progress indexing job
 */
export async function abortIndexingJob(
  workspaceId: string,
  io: Server
): Promise<void> {
  const indexJobs = await getIndexJobsCollection()
  
  // Find active job for this workspace
  const activeJob = await indexJobs.findOne({
    workspaceId: new ObjectId(workspaceId),
    status: "in-progress"
  })
  
  if (!activeJob) {
    logger.warn(`⚠️  No active job to abort for workspace: ${workspaceId}`)
    return
  }
  
  // Mark job as cancelled
  await indexJobs.updateOne(
    { _id: activeJob._id },
    {
      $set: {
        status: "cancelled",
        completedAt: new Date(),
        updatedAt: new Date(),
      }
    }
  )
  
  logger.info(`🛑 Cancelled indexing job: ${activeJob._id} for workspace: ${workspaceId}`)
  
  // Emit cancellation event to all clients in workspace room
  io.to(`workspace:${workspaceId}`).emit("index:cancelled", {
    workspaceId,
  })
}
