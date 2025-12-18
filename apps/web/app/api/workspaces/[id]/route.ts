import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { ObjectId } from "mongodb"
import { authOptions } from "@/lib/auth"
import { getWorkspacesCollection } from "@/lib/db"
import { getWorkspaceRole, requireOwnerAccess } from "@/lib/permissions"
import type { UpdateWorkspaceRequest } from "@trace/shared"

// GET /api/workspaces/:id - Get workspace details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const workspaces = await getWorkspacesCollection()
    const workspace = await workspaces.findOne({
      _id: new ObjectId(params.id),
    })

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    return NextResponse.json({
      workspace,
      role,
    })
  } catch (error) {
    console.error("Error fetching workspace:", error)
    return NextResponse.json(
      { error: "Failed to fetch workspace" },
      { status: 500 }
    )
  }
}

// PATCH /api/workspaces/:id - Update workspace
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await requireOwnerAccess(params.id, session.user.id)

    const body: UpdateWorkspaceRequest = await request.json()

    // Validate input
    if (body.name !== undefined) {
      if (body.name.trim().length === 0) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
      }
      if (body.name.length > 100) {
        return NextResponse.json(
          { error: "Name must be 100 characters or less" },
          { status: 400 }
        )
      }
    }

    if (body.description !== undefined && body.description.length > 500) {
      return NextResponse.json(
        { error: "Description must be 500 characters or less" },
        { status: 400 }
      )
    }

    const workspaces = await getWorkspacesCollection()

    const updateFields: any = {
      updatedAt: new Date(),
    }

    if (body.name !== undefined) {
      updateFields.name = body.name.trim()
    }

    if (body.description !== undefined) {
      updateFields.description = body.description.trim()
    }

    const result = await workspaces.findOneAndUpdate(
      { _id: new ObjectId(params.id) },
      { $set: updateFields },
      { returnDocument: "after" }
    )

    if (!result) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    return NextResponse.json({ workspace: result })
  } catch (error: any) {
    console.error("Error updating workspace:", error)
    
    if (error.message === "Owner access required") {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    return NextResponse.json(
      { error: "Failed to update workspace" },
      { status: 500 }
    )
  }
}

// DELETE /api/workspaces/:id - Delete workspace
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await requireOwnerAccess(params.id, session.user.id)

    // Abort any active indexing jobs before deletion
    const INDEXER_SERVICE_URL = process.env.INDEXER_SERVICE_URL || "http://localhost:3001"
    const INDEXER_SERVICE_TOKEN = process.env.INDEXER_SERVICE_TOKEN
    
    if (INDEXER_SERVICE_TOKEN) {
      try {
        await fetch(`${INDEXER_SERVICE_URL}/jobs/${params.id}/abort`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${INDEXER_SERVICE_TOKEN}`,
          },
        })
        console.log(`Aborted indexing job for workspace ${params.id} before deletion`)
      } catch (error) {
        // Continue with deletion even if abort fails (job might not exist)
        console.log(`No active job to abort for workspace ${params.id}`)
      }
    }

    const workspaces = await getWorkspacesCollection()
    
    const result = await workspaces.deleteOne({
      _id: new ObjectId(params.id),
    })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    // TODO: In Phase 2+, also delete associated documents, pages, ontology, chat sessions

    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    console.error("Error deleting workspace:", error)
    
    if (error.message === "Owner access required") {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    return NextResponse.json(
      { error: "Failed to delete workspace" },
      { status: 500 }
    )
  }
}

