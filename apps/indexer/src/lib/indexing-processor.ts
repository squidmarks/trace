import { ObjectId } from "mongodb"
import { getDocumentsCollection, getPagesCollection } from "./db.js"
import { fetchDocument } from "./document-fetcher.js"
import { renderPdfToImages } from "./pdf-renderer.js"
import logger from "./logger.js"
import type { Server } from "socket.io"

export interface IndexJobOptions {
  workspaceId: string
  documentIds?: string[] // If empty, index all documents in workspace
  renderDpi?: number
  renderQuality?: number
}

export interface IndexProgress {
  workspaceId: string
  phase: "fetching" | "rendering" | "storing" | "complete" | "error"
  currentDocument?: {
    id: string
    filename: string
    current: number
    total: number
  }
  totalDocuments: number
  processedDocuments: number
  totalPages: number
  processedPages: number
  error?: string
}

/**
 * Process an indexing job for a workspace
 * Emits progress events via Socket.io to the workspace room
 */
export async function processIndexJob(
  options: IndexJobOptions,
  io: Server
): Promise<void> {
  const { workspaceId, documentIds, renderDpi = 150, renderQuality = 85 } = options

  logger.info(`🚀 Starting index job for workspace: ${workspaceId}`)

  const documents = await getDocumentsCollection()
  const pages = await getPagesCollection()

  try {
    // 1. Get documents to process
    const query: any = { workspaceId: new ObjectId(workspaceId) }
    if (documentIds && documentIds.length > 0) {
      query._id = { $in: documentIds.map((id) => new ObjectId(id)) }
    }

    const docsToProcess = await documents.find(query).toArray()

    if (docsToProcess.length === 0) {
      logger.warn(`No documents found for workspace: ${workspaceId}`)
      io.to(`workspace:${workspaceId}`).emit("index:error", {
        workspaceId,
        error: "No documents found to index",
      })
      return
    }

    logger.info(`📄 Found ${docsToProcess.length} documents to process`)

    // 2. Delete existing pages for these documents (re-index)
    const docIds = docsToProcess.map((d) => d._id)
    const deleteResult = await pages.deleteMany({
      documentId: { $in: docIds },
    })

    if (deleteResult.deletedCount > 0) {
      logger.info(`🗑️  Deleted ${deleteResult.deletedCount} existing pages`)
    }

    // 3. Process each document
    let processedDocs = 0
    let totalPagesCreated = 0

    for (const doc of docsToProcess) {
      const docId = doc._id.toString()
      const filename = doc.filename

      logger.info(`\n📄 Processing document ${processedDocs + 1}/${docsToProcess.length}: ${filename}`)

      // Emit fetching progress
      io.to(`workspace:${workspaceId}`).emit("index:progress", {
        workspaceId,
        phase: "fetching",
        currentDocument: {
          id: docId,
          filename,
          current: processedDocs + 1,
          total: docsToProcess.length,
        },
        totalDocuments: docsToProcess.length,
        processedDocuments: processedDocs,
        totalPages: totalPagesCreated,
        processedPages: totalPagesCreated,
      } as IndexProgress)

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

        // Fetch document
        const fetchedDoc = await fetchDocument(docId)

        // Emit rendering progress
        io.to(`workspace:${workspaceId}`).emit("index:progress", {
          workspaceId,
          phase: "rendering",
          currentDocument: {
            id: docId,
            filename,
            current: processedDocs + 1,
            total: docsToProcess.length,
          },
          totalDocuments: docsToProcess.length,
          processedDocuments: processedDocs,
          totalPages: totalPagesCreated,
          processedPages: totalPagesCreated,
        } as IndexProgress)

        // Render pages
        const renderedPages = await renderPdfToImages(fetchedDoc.buffer, {
          dpi: renderDpi,
          quality: renderQuality,
        })

        // Emit storing progress
        io.to(`workspace:${workspaceId}`).emit("index:progress", {
          workspaceId,
          phase: "storing",
          currentDocument: {
            id: docId,
            filename,
            current: processedDocs + 1,
            total: docsToProcess.length,
          },
          totalDocuments: docsToProcess.length,
          processedDocuments: processedDocs,
          totalPages: totalPagesCreated,
          processedPages: totalPagesCreated,
        } as IndexProgress)

        // Store pages in MongoDB
        const pageDocs = renderedPages.map((page) => ({
          workspaceId: new ObjectId(workspaceId),
          documentId: doc._id,
          pageNumber: page.pageNumber,
          imageData: page.imageData,
          width: page.width,
          height: page.height,
          // Placeholder for Phase 3 (AI analysis)
          analysis: null,
          embedding: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))

        await pages.insertMany(pageDocs)

        totalPagesCreated += renderedPages.length

        // Update document status and page count
        await documents.updateOne(
          { _id: doc._id },
          {
            $set: {
              status: "ready",
              pageCount: renderedPages.length,
              updatedAt: new Date(),
            },
          }
        )

        processedDocs++

        logger.info(
          `✅ Document ${processedDocs}/${docsToProcess.length} complete: ${renderedPages.length} pages`
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

        // Continue with next document
      }
    }

    // 4. Emit completion
    logger.info(`\n✅ Index job complete: ${processedDocs}/${docsToProcess.length} documents, ${totalPagesCreated} pages`)

    io.to(`workspace:${workspaceId}`).emit("index:complete", {
      workspaceId,
      documentCount: processedDocs,
      pageCount: totalPagesCreated,
      duration: 0, // TODO: Track actual duration
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error(`❌ Index job failed: ${message}`)

    io.to(`workspace:${workspaceId}`).emit("index:error", {
      workspaceId,
      error: message,
    })

    throw error
  }
}

