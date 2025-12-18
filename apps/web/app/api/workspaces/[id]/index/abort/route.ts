import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWorkspaceRole } from "@/lib/permissions"

const INDEXER_SERVICE_URL =
  process.env.INDEXER_SERVICE_URL || "http://localhost:3001"
const INDEXER_SERVICE_TOKEN = process.env.INDEXER_SERVICE_TOKEN

if (!INDEXER_SERVICE_TOKEN) {
  throw new Error("INDEXER_SERVICE_TOKEN environment variable is required")
}

/**
 * POST /api/workspaces/:id/index/abort
 * Abort an in-progress indexing job
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permissions (owner only)
    const role = await getWorkspaceRole(params.id, session.user.id)
    if (role !== "owner") {
      return NextResponse.json(
        { error: "Owner access required" },
        { status: 403 }
      )
    }

    // Call Indexer service to abort
    const response = await fetch(
      `${INDEXER_SERVICE_URL}/jobs/${params.id}/abort`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${INDEXER_SERVICE_TOKEN}`,
        },
      }
    )

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.error || "Failed to abort indexing job" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("Error aborting index job:", error)
    return NextResponse.json(
      { error: "Failed to abort indexing job" },
      { status: 500 }
    )
  }
}

