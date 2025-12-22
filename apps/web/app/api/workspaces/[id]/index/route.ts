import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getWorkspaceRole } from "@/lib/workspace-permissions"

/**
 * POST /api/workspaces/:id/index
 * Start indexing for a workspace
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check workspace permissions (owner or admin can start indexing)
    const role = await getWorkspaceRole(params.id, session.user.id)
    if (!role || (role !== "owner" && role !== "admin")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get body (optional params)
    const body = await request.json().catch(() => ({}))

    // Call indexer service (server-to-server)
    const INDEXER_SERVICE_URL = process.env.INDEXER_SERVICE_URL || "http://localhost:3001"
    const INDEXER_SERVICE_TOKEN = process.env.INDEXER_SERVICE_TOKEN

    if (!INDEXER_SERVICE_TOKEN) {
      console.error("INDEXER_SERVICE_TOKEN not configured")
      return NextResponse.json(
        { error: "Indexer service not configured" },
        { status: 500 }
      )
    }

    const response = await fetch(`${INDEXER_SERVICE_URL}/jobs/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${INDEXER_SERVICE_TOKEN}`,
      },
      body: JSON.stringify({
        workspaceId: params.id,
        documentIds: body.documentIds,
        params: body.params,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      return NextResponse.json(
        { error: errorData.error || "Failed to start indexing" },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result, { status: 202 })
  } catch (error: any) {
    console.error("Error starting indexing:", error)
    return NextResponse.json(
      { error: "Failed to start indexing" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workspaces/:id/index
 * Abort indexing for a workspace
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check workspace permissions
    const role = await getWorkspaceRole(params.id, session.user.id)
    if (!role || (role !== "owner" && role !== "admin")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Call indexer service
    const INDEXER_SERVICE_URL = process.env.INDEXER_SERVICE_URL || "http://localhost:3001"
    const INDEXER_SERVICE_TOKEN = process.env.INDEXER_SERVICE_TOKEN

    if (!INDEXER_SERVICE_TOKEN) {
      return NextResponse.json(
        { error: "Indexer service not configured" },
        { status: 500 }
      )
    }

    const response = await fetch(`${INDEXER_SERVICE_URL}/jobs/${params.id}/abort`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${INDEXER_SERVICE_TOKEN}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      return NextResponse.json(
        { error: errorData.error || "Failed to abort indexing" },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Error aborting indexing:", error)
    return NextResponse.json(
      { error: "Failed to abort indexing" },
      { status: 500 }
    )
  }
}
