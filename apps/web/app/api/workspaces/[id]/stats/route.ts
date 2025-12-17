import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWorkspaceRole } from "@/lib/permissions"
import { getDocumentsCollection, getPagesCollection } from "@/lib/db"
import { ObjectId } from "mongodb"

/**
 * GET /api/workspaces/:id/stats
 * Get workspace statistics (document count, page count)
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permissions (owner or viewer)
    const role = await getWorkspaceRole(params.id, session.user.id)
    if (!role) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const workspaceId = new ObjectId(params.id)

    // Get document count
    const documents = await getDocumentsCollection()
    const documentCount = await documents.countDocuments({ workspaceId })

    // Get page count
    const pages = await getPagesCollection()
    const pageCount = await pages.countDocuments({ workspaceId })

    return NextResponse.json({
      documentCount,
      pageCount,
    })
  } catch (error: any) {
    console.error("Error fetching workspace stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch workspace stats" },
      { status: 500 }
    )
  }
}

