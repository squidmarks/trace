import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { ObjectId } from "mongodb"
import { authOptions } from "@/lib/auth"
import { getWorkspaceRole } from "@/lib/permissions"
import { getWorkspacesCollection } from "@/lib/db"

const INDEXER_SERVICE_URL =
  process.env.INDEXER_SERVICE_URL || "http://localhost:3001"
const INDEXER_SERVICE_TOKEN = process.env.INDEXER_SERVICE_TOKEN

if (!INDEXER_SERVICE_TOKEN) {
  throw new Error("INDEXER_SERVICE_TOKEN environment variable is required")
}

/**
 * POST /api/workspaces/:id/index
 * Start indexing job for all documents in workspace
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

    // Fetch workspace to get config
    const workspaces = await getWorkspacesCollection()
    const workspace = await workspaces.findOne({ _id: new ObjectId(params.id) })
    
    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      )
    }

    // Use workspace config or fallback to defaults
    const config = workspace.config || {
      indexing: {
        renderDpi: 150,
        renderQuality: 85,
        analysisModel: "gpt-4o-mini",
        analysisTemperature: 0.1,
        analysisDetail: "auto",
      }
    }

    // Call Indexer service
    const response = await fetch(`${INDEXER_SERVICE_URL}/jobs/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${INDEXER_SERVICE_TOKEN}`,
      },
      body: JSON.stringify({
        workspaceId: params.id,
        params: {
          renderDpi: config.indexing.renderDpi,
          renderQuality: config.indexing.renderQuality,
          analysisModel: config.indexing.analysisModel,
          analysisDetail: config.indexing.analysisDetail,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.error || "Failed to start indexing job" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data, { status: 202 })
  } catch (error: any) {
    console.error("Error starting index job:", error)
    return NextResponse.json(
      { error: "Failed to start indexing job" },
      { status: 500 }
    )
  }
}

