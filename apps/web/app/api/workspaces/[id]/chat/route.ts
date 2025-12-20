import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWorkspaceRole } from "@/lib/permissions"
import { getChatSessionsCollection } from "@/lib/db"
import { ObjectId } from "mongodb"
import { createChatSessionSchema } from "@trace/shared"
import type { ChatSession } from "@trace/shared"

/**
 * POST /api/workspaces/:id/chat
 * Create a new chat session
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

    // Check permissions (any member can chat)
    const role = await getWorkspaceRole(params.id, session.user.id)
    if (!role) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = createChatSessionSchema.parse(body)

    // Create chat session
    const chatSessions = await getChatSessionsCollection()
    const newSession: Omit<ChatSession, "_id"> = {
      workspaceId: new ObjectId(params.id),
      userId: new ObjectId(session.user.id),
      title: validatedData.title,
      messages: [],
      totalCost: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await chatSessions.insertOne(newSession as any)

    return NextResponse.json({
      session: {
        _id: result.insertedId.toString(),
        ...newSession,
        workspaceId: newSession.workspaceId.toString(),
        userId: newSession.userId.toString(),
      },
    })
  } catch (error: any) {
    console.error("Error creating chat session:", error)
    
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to create chat session" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/workspaces/:id/chat
 * List all chat sessions for a workspace
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

    // Check permissions (any member can list sessions)
    const role = await getWorkspaceRole(params.id, session.user.id)
    if (!role) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get all sessions for this workspace and user
    const chatSessions = await getChatSessionsCollection()
    const sessions = await chatSessions
      .find({
        workspaceId: new ObjectId(params.id),
        userId: new ObjectId(session.user.id),
      })
      .sort({ updatedAt: -1 }) // Most recent first
      .toArray()

    // Format response
    const formattedSessions = sessions.map((s) => ({
      _id: s._id.toString(),
      workspaceId: s.workspaceId.toString(),
      userId: s.userId.toString(),
      title: s.title || (s.messages[0]?.content.substring(0, 50) + "..." || "New Chat"),
      messageCount: s.messages.length,
      totalCost: s.totalCost,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }))

    return NextResponse.json({ sessions: formattedSessions })
  } catch (error: any) {
    console.error("Error listing chat sessions:", error)
    return NextResponse.json(
      { error: "Failed to list chat sessions" },
      { status: 500 }
    )
  }
}


