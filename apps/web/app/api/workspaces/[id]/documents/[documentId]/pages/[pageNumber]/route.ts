import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWorkspaceRole } from "@/lib/permissions"
import { getPagesCollection } from "@/lib/db"
import { ObjectId } from "mongodb"

/**
 * GET /api/workspaces/:id/documents/:documentId/pages/:pageNumber
 * Get a specific page with its image and analysis
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; documentId: string; pageNumber: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check workspace permissions
    const role = await getWorkspaceRole(params.id, session.user.id)
    if (!role) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get page
    const pages = await getPagesCollection()
    const page = await pages.findOne({
      workspaceId: new ObjectId(params.id),
      documentId: new ObjectId(params.documentId),
      pageNumber: parseInt(params.pageNumber),
    })

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 })
    }

    // Return page data
    return NextResponse.json({
      imageData: page.imageData,
      pageNumber: page.pageNumber,
      analysis: {
        summary: page.analysis?.summary || "",
        topics: page.analysis?.topics || [],
        entities: page.analysis?.entities || [],
        anchors: page.analysis?.anchors || [],
      },
    })
  } catch (error: any) {
    console.error("Error fetching page:", error)
    return NextResponse.json(
      { error: "Failed to fetch page" },
      { status: 500 }
    )
  }
}

