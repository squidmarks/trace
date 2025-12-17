import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { ObjectId } from "mongodb"
import { authOptions } from "@/lib/auth"
import { getDocumentsCollection } from "@/lib/db"
import { getWorkspaceRole, requireOwnerAccess } from "@/lib/permissions"

// GET /api/workspaces/:id/documents/:documentId - Get document
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

    const documents = await getDocumentsCollection()

    const document = await documents.findOne({
      _id: new ObjectId(params.documentId),
      workspaceId: new ObjectId(params.id),
    })

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Remove pdfData from response (too large)
    const { pdfData, ...documentWithoutData } = document

    return NextResponse.json({ document: documentWithoutData })
  } catch (error) {
    console.error("Error fetching document:", error)
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    )
  }
}

// DELETE /api/workspaces/:id/documents/:documentId - Delete document
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; documentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await requireOwnerAccess(params.id, session.user.id)

    const documents = await getDocumentsCollection()

    const result = await documents.deleteOne({
      _id: new ObjectId(params.documentId),
      workspaceId: new ObjectId(params.id),
    })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // TODO: Phase 2+ - Also delete associated pages when re-indexing

    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    console.error("Error deleting document:", error)

    if (error.message === "Owner access required") {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    )
  }
}

