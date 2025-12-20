import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWorkspaceRole } from "@/lib/permissions"
import { getPagesCollection } from "@/lib/db"
import { ensureSearchIndexes } from "@/lib/search-indexes"
import { ObjectId } from "mongodb"

/**
 * GET /api/workspaces/:id/search
 * Search pages within a workspace using MongoDB text search
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permissions (any member can search)
    const role = await getWorkspaceRole(params.id, session.user.id)
    if (!role) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Ensure search indexes exist (runs once per app startup)
    await ensureSearchIndexes()

    // Get search query from URL params
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")
    const documentId = searchParams.get("documentId") // Optional filter
    const limit = parseInt(searchParams.get("limit") || "20")
    const offset = parseInt(searchParams.get("offset") || "0")

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      )
    }

    // Build MongoDB text search query
    const pages = await getPagesCollection()
    const workspaceObjectId = new ObjectId(params.id)

    // Base filter: workspace and must have analysis
    const filter: any = {
      workspaceId: workspaceObjectId,
      analysis: { $exists: true, $ne: null },
      $text: { $search: query },
    }

    // Optional document filter
    if (documentId) {
      filter.documentId = new ObjectId(documentId)
    }

    // Execute search with text score for ranking
    const results = await pages
      .find(filter, {
        projection: {
          score: { $meta: "textScore" },
          _id: 1,
          workspaceId: 1,
          documentId: 1,
          pageNumber: 1,
          imageData: 1,
          width: 1,
          height: 1,
          analysis: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      })
      .sort({ score: { $meta: "textScore" } }) // Sort by relevance
      .skip(offset)
      .limit(limit)
      .toArray()

    // Get total count for pagination
    const total = await pages.countDocuments(filter)

    // Get document info for each result
    const { getDocumentsCollection } = await import("@/lib/db")
    const documents = await getDocumentsCollection()
    const documentIds = [...new Set(results.map((r) => r.documentId))]
    const docs = await documents
      .find({ _id: { $in: documentIds } })
      .toArray()

    const docsMap = new Map(docs.map((d) => [d._id.toString(), d]))

    // Format results
    const formattedResults = results.map((page: any) => ({
      _id: page._id.toString(),
      workspaceId: page.workspaceId.toString(),
      documentId: page.documentId.toString(),
      document: {
        _id: page.documentId.toString(),
        filename: docsMap.get(page.documentId.toString())?.filename || "Unknown",
      },
      pageNumber: page.pageNumber,
      imageData: page.imageData, // Base64 thumbnail
      width: page.width,
      height: page.height,
      analysis: {
        summary: page.analysis?.summary || "",
        topics: page.analysis?.topics || [],
        entities: page.analysis?.entities || [],
        anchors: page.analysis?.anchors || [],
        confidence: page.analysis?.confidence || 0,
      },
      score: page.score || 0,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    }))

    return NextResponse.json({
      query,
      results: formattedResults,
      pagination: {
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      },
    })
  } catch (error: any) {
    console.error("Error searching pages:", error)
    return NextResponse.json(
      { error: "Failed to search pages" },
      { status: 500 }
    )
  }
}

