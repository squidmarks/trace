import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWorkspaceRole } from "@/lib/permissions"
import { getPagesCollection } from "@/lib/db"
import { ObjectId } from "mongodb"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; documentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = await getWorkspaceRole(params.id, session.user.id)
    if (!role) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const pages = await getPagesCollection()
    const documentPages = await pages
      .find({
        workspaceId: new ObjectId(params.id),
        documentId: new ObjectId(params.documentId),
      })
      .sort({ pageNumber: 1 })
      .project({
        _id: 1,
        pageNumber: 1,
        // Don't return full imageData here, only what's needed for thumbnails
      })
      .toArray()

    return NextResponse.json({
      pages: documentPages.map((p) => ({
        _id: p._id.toString(),
        pageNumber: p.pageNumber,
      })),
    })
  } catch (error: any) {
    console.error("Error fetching document pages:", error)
    return NextResponse.json(
      { error: "Failed to fetch pages" },
      { status: 500 }
    )
  }
}

