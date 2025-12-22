/**
 * Tool endpoints for OpenAI function calling
 * These endpoints are called by the Web App during chat interactions
 */

import express, { Request, Response } from "express"
import { ObjectId } from "mongodb"
import { getPagesCollection, getDocumentsCollection, getWorkspacesCollection } from "../lib/db.js"
import { verifyServiceToken } from "../lib/auth.js"
import logger from "../lib/logger.js"

const router = express.Router()

// Middleware to verify service token
router.use(verifyServiceToken)

/**
 * POST /tools/searchPages
 * Search pages within a workspace (for AI tool calling)
 * 
 * Expected payload:
 * {
 *   workspaceId: string,
 *   query: string,
 *   limit?: number (default: 10, max: 20)
 * }
 */
router.post("/searchPages", async (req: Request, res: Response) => {
  try {
    const { workspaceId, query, limit = 10 } = req.body

    // Validate required fields
    if (!workspaceId || !query) {
      return res.status(400).json({
        error: "Missing required fields: workspaceId, query",
      })
    }

    const searchLimit = Math.min(Math.max(1, limit || 10), 20)

    logger.info(`[Tools] searchPages: workspace=${workspaceId}, query="${query}", limit=${searchLimit}`)

    // Build MongoDB text search query
    const pages = await getPagesCollection()
    const workspaceObjectId = new ObjectId(workspaceId)

    const filter: any = {
      workspaceId: workspaceObjectId,
      analysis: { $exists: true, $ne: null },
      $text: { $search: query },
    }

    // Execute search with text score for ranking
    // Note: MongoDB textScore typically ranges from 0.5 to 3.0+
    // We use aggressive filtering to ensure only highly relevant pages are returned
    const minScore = searchLimit > 15 ? 0.85 : 1.0 // Higher threshold for better precision
    
    const results = await pages
      .find(filter, {
        projection: {
          score: { $meta: "textScore" },
          _id: 1,
          workspaceId: 1,
          documentId: 1,
          pageNumber: 1,
          analysis: 1,
          createdAt: 1,
        },
      })
      .sort({ score: { $meta: "textScore" } })
      .limit(searchLimit * 3) // Fetch more to ensure we have enough after aggressive filtering
      .toArray()
    
    // Filter by minimum score and then limit
    const filteredResults = results
      .filter(r => r.score >= minScore)
      .slice(0, searchLimit)

    // Get document info for each result
    const documents = await getDocumentsCollection()
    const documentIds = [...new Set(filteredResults.map((r) => r.documentId))]
    const docs = await documents
      .find({ _id: { $in: documentIds } })
      .toArray()

    const docsMap = new Map(docs.map((d) => [d._id.toString(), d]))

    // Format results for AI consumption
    const formattedResults = filteredResults.map((page: any) => ({
      pageId: page._id.toString(),
      documentId: page.documentId.toString(),
      documentName: docsMap.get(page.documentId.toString())?.filename || "Unknown",
      pageNumber: page.pageNumber,
      summary: page.analysis?.summary || "",
      topics: page.analysis?.topics || [],
      entities: page.analysis?.entities?.map((e: any) => ({
        type: e.type,
        value: e.value,
      })) || [],
      relevanceScore: page.score || 0,
    }))

    logger.info(`[Tools] searchPages: Found ${formattedResults.length} results`)

    return res.json({
      results: formattedResults,
      query,
      totalResults: formattedResults.length,
    })
  } catch (error: any) {
    logger.error("[Tools] searchPages error:", error)
    return res.status(500).json({
      error: "Failed to search pages",
      message: error.message,
    })
  }
})

/**
 * POST /tools/getPage
 * Get detailed information about a specific page (for AI tool calling)
 * 
 * Expected payload:
 * {
 *   pageId: string
 * }
 */
router.post("/getPage", async (req: Request, res: Response) => {
  try {
    const { pageId } = req.body

    // Validate required fields
    if (!pageId) {
      return res.status(400).json({
        error: "Missing required field: pageId",
      })
    }

    logger.info(`[Tools] getPage: pageId=${pageId}`)

    // Get page
    const pages = await getPagesCollection()
    const page = await pages.findOne({
      _id: new ObjectId(pageId),
    })

    if (!page) {
      return res.status(404).json({
        error: "Page not found",
      })
    }

    // Get document info
    const documents = await getDocumentsCollection()
    const document = await documents.findOne({
      _id: page.documentId,
    })

    // Format page details for AI consumption
    const formattedPage: any = {
      pageId: page._id.toString(),
      documentId: page.documentId.toString(),
      documentName: document?.filename || "Unknown",
      pageNumber: page.pageNumber,
      totalPages: document?.pageCount || null,
      analysis: {
        summary: page.analysis?.summary || "",
        topics: page.analysis?.topics || [],
        anchors: page.analysis?.anchors?.map((a: any) => ({
          id: a.id,
          label: a.label,
          type: a.type,
        })) || [],
        entities: page.analysis?.entities?.map((e: any) => ({
          type: e.type,
          value: e.value,
          canonicalValue: e.canonicalValue,
        })) || [],
        relations: page.analysis?.relations?.map((r: any) => ({
          type: r.type,
          source: r.source,
          target: r.target,
          note: r.note,
        })) || [],
        confidence: page.analysis?.confidence || 0,
      },
    }

    // Include new linking metadata if present
    if (page.analysis?.wireConnections && page.analysis.wireConnections.length > 0) {
      formattedPage.analysis.wireConnections = page.analysis.wireConnections.map((w: any) => ({
        label: w.label,
        wireSpec: w.wireSpec,
        direction: w.direction,
        connectedComponent: w.connectedComponent,
      }))
    }

    if (page.analysis?.referenceMarkers && page.analysis.referenceMarkers.length > 0) {
      formattedPage.analysis.referenceMarkers = page.analysis.referenceMarkers.map((m: any) => ({
        value: m.value,
        markerType: m.markerType,
        description: m.description,
        referencedPage: m.referencedPage,
        referencedSection: m.referencedSection,
      }))
    }

    if (page.analysis?.connectorPins && page.analysis.connectorPins.length > 0) {
      formattedPage.analysis.connectorPins = page.analysis.connectorPins.map((p: any) => ({
        connectorName: p.connectorName,
        pinNumber: p.pinNumber,
        wireSpec: p.wireSpec,
        signalName: p.signalName,
        connectedTo: p.connectedTo,
      }))
    }

    logger.info(`[Tools] getPage: Found page ${pageId}`)

    return res.json({ page: formattedPage })
  } catch (error: any) {
    logger.error("[Tools] getPage error:", error)
    return res.status(500).json({
      error: "Failed to get page",
      message: error.message,
    })
  }
})

export default router


