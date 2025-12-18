import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { ObjectId } from "mongodb"
import { authOptions } from "@/lib/auth"
import { getWorkspacesCollection } from "@/lib/db"
import type { CreateWorkspaceRequest } from "@trace/shared"

// GET /api/workspaces - List user's workspaces
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const workspaces = await getWorkspacesCollection()
    const userId = new ObjectId(session.user.id)

    // Find workspaces where user is owner or member
    const userWorkspaces = await workspaces
      .find({
        $or: [
          { ownerId: userId },
          { "members.userId": userId },
        ],
      })
      .sort({ updatedAt: -1 })
      .toArray()

    // Add role to each workspace
    const workspacesWithRole = userWorkspaces.map((ws) => ({
      ...ws,
      role: ws.ownerId.toString() === session.user.id ? "owner" : "viewer",
    }))

    return NextResponse.json({ workspaces: workspacesWithRole })
  } catch (error) {
    console.error("Error fetching workspaces:", error)
    return NextResponse.json(
      { error: "Failed to fetch workspaces" },
      { status: 500 }
    )
  }
}

// POST /api/workspaces - Create new workspace
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body: CreateWorkspaceRequest = await request.json()

    // Validate input
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    if (body.name.length > 100) {
      return NextResponse.json(
        { error: "Name must be 100 characters or less" },
        { status: 400 }
      )
    }

    if (body.description && body.description.length > 500) {
      return NextResponse.json(
        { error: "Description must be 500 characters or less" },
        { status: 400 }
      )
    }

    const workspaces = await getWorkspacesCollection()

    const workspace = {
      ownerId: new ObjectId(session.user.id),
      name: body.name.trim(),
      description: body.description?.trim(),
      members: [],
      indexStatus: "idle" as const,
      config: {
        indexing: {
          renderDpi: 150,
          renderQuality: 85,
          analysisModel: "gpt-4o-mini",
          analysisTemperature: 0.1,
          analysisDetail: "auto",
        },
        search: {
          maxResults: 25,
          minConfidence: 0.7,
        },
        chat: {
          model: "gpt-4o-mini",
          temperature: 0.7,
          maxTokens: 2000,
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await workspaces.insertOne(workspace)

    return NextResponse.json(
      {
        workspace: {
          ...workspace,
          _id: result.insertedId,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating workspace:", error)
    return NextResponse.json(
      { error: "Failed to create workspace" },
      { status: 500 }
    )
  }
}

