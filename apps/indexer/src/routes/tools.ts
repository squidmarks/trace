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
 *   limit?: number (default: 10, max: 20),
 *   connectionLabels?: string[] (optional: filter by connection labels),
 *   connectionSpecs?: string[] (optional: filter by connection specifications),
 *   referenceMarkers?: string[] (optional: filter by reference marker values)
 * }
 */
router.post("/searchPages", async (req: Request, res: Response) => {
  try {
    const { workspaceId, query, limit = 10, connectionLabels, connectionSpecs, referenceMarkers } = req.body

    // Validate required fields (query OR filters required)
    if (!workspaceId || (!query && !connectionLabels && !connectionSpecs && !referenceMarkers)) {
      return res.status(400).json({
        error: "Missing required fields: workspaceId and at least one of (query, connectionLabels, connectionSpecs, referenceMarkers)",
      })
    }

    const searchLimit = Math.min(Math.max(1, limit || 10), 20)

    const filterInfo = []
    if (query) filterInfo.push(`query="${query}"`)
    if (connectionLabels) filterInfo.push(`connectionLabels=${JSON.stringify(connectionLabels)}`)
    if (connectionSpecs) filterInfo.push(`connectionSpecs=${JSON.stringify(connectionSpecs)}`)
    if (referenceMarkers) filterInfo.push(`refMarkers=${JSON.stringify(referenceMarkers)}`)
    
    logger.info(`[Tools] searchPages: workspace=${workspaceId}, ${filterInfo.join(", ")}, limit=${searchLimit}`)

    // Build MongoDB query
    const pages = await getPagesCollection()
    const workspaceObjectId = new ObjectId(workspaceId)

    const filter: any = {
      workspaceId: workspaceObjectId,
      analysis: { $exists: true, $ne: null },
    }

    // Add text search if query provided
    if (query) {
      filter.$text = { $search: query }
    }

    // Add connection filters
    const andConditions = []
    
    if (connectionLabels && connectionLabels.length > 0) {
      andConditions.push({
        "analysis.connections": {
          $elemMatch: {
            label: { $in: connectionLabels }
          }
        }
      })
    }

    if (connectionSpecs && connectionSpecs.length > 0) {
      andConditions.push({
        "analysis.connections": {
          $elemMatch: {
            specification: { $in: connectionSpecs }
          }
        }
      })
    }

    if (referenceMarkers && referenceMarkers.length > 0) {
      andConditions.push({
        "analysis.referenceMarkers": {
          $elemMatch: {
            value: { $in: referenceMarkers }
          }
        }
      })
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions
    }

    // Execute search with text score for ranking (if text search is used)
    let results
    if (query) {
      // Text search with relevance scoring
      // Note: MongoDB textScore typically ranges from 0.5 to 3.0+
      const minScore = searchLimit > 15 ? 0.85 : 1.0 // Higher threshold for better precision
      
      const rawResults = await pages
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
        .limit(searchLimit * 3) // Fetch more to ensure we have enough after filtering
        .toArray()
      
      // Filter by minimum score and then limit
      results = rawResults
        .filter(r => r.score >= minScore)
        .slice(0, searchLimit)
    } else {
      // Filter-only search (no text search, so no relevance score)
      results = await pages
        .find(filter, {
          projection: {
            _id: 1,
            workspaceId: 1,
            documentId: 1,
            pageNumber: 1,
            analysis: 1,
            createdAt: 1,
          },
        })
        .sort({ pageNumber: 1 }) // Sort by page number for filter-only searches
        .limit(searchLimit)
        .toArray()
      
      // Add a default score for consistency
      results.forEach(r => r.score = 1.0)
    }
    
    const filteredResults = results

    // Get document info for each result
    const documents = await getDocumentsCollection()
    const documentIds = [...new Set(filteredResults.map((r) => r.documentId))]
    const docs = await documents
      .find({ _id: { $in: documentIds } })
      .toArray()

    const docsMap = new Map(docs.map((d) => [d._id.toString(), d]))

    // Format results for AI consumption
    const formattedResults = filteredResults.map((page: any) => {
      const result: any = {
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
      }

      // Include linking metadata if present (especially important for filter-based searches)
      if (page.analysis?.connections && page.analysis.connections.length > 0) {
        result.connections = page.analysis.connections.map((c: any) => ({
          label: c.label,
          specification: c.specification,
          direction: c.direction,
          connectedComponent: c.connectedComponent,
        }))
      }

      if (page.analysis?.referenceMarkers && page.analysis.referenceMarkers.length > 0) {
        result.referenceMarkers = page.analysis.referenceMarkers.map((m: any) => ({
          value: m.value,
          markerType: m.markerType,
          description: m.description,
          referencedPage: m.referencedPage,
        }))
      }

      return result
    })

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
        entities: page.analysis?.entities?.map((e: any) => ({
          type: e.type,
          value: e.value,
          canonicalValue: e.canonicalValue,
        })) || [],
        confidence: page.analysis?.confidence || 0,
      },
    }

    // Include new linking metadata if present
    if (page.analysis?.connections && page.analysis.connections.length > 0) {
      formattedPage.analysis.connections = page.analysis.connections.map((c: any) => ({
        label: c.label,
        specification: c.specification,
        direction: c.direction,
        connectedComponent: c.connectedComponent,
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


