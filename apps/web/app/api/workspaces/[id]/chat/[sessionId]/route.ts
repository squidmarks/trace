import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWorkspaceRole } from "@/lib/permissions"
import { getChatSessionsCollection } from "@/lib/db"
import { ObjectId } from "mongodb"

/**
 * GET /api/workspaces/:id/chat/:sessionId
 * Get a specific chat session with all messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
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

    // Get session
    const chatSessions = await getChatSessionsCollection()
    const chatSession = await chatSessions.findOne({
      _id: new ObjectId(params.sessionId),
      workspaceId: new ObjectId(params.id),
      userId: new ObjectId(session.user.id),
    })

    if (!chatSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Format response
    const formatted = {
      _id: chatSession._id.toString(),
      workspaceId: chatSession.workspaceId.toString(),
      userId: chatSession.userId.toString(),
      title: chatSession.title || (chatSession.messages[0]?.content.substring(0, 50) + "..." || "New Chat"),
      messages: chatSession.messages.map((msg: any) => ({
        ...msg,
        citations: msg.citations?.map((c: any) => ({
          ...c,
          pageId: c.pageId.toString(),
          documentId: c.documentId.toString(),
        })),
      })),
      totalCost: chatSession.totalCost,
      createdAt: chatSession.createdAt,
      updatedAt: chatSession.updatedAt,
    }

    return NextResponse.json({ session: formatted })
  } catch (error: any) {
    console.error("Error getting chat session:", error)
    return NextResponse.json(
      { error: "Failed to get chat session" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/workspaces/:id/chat/:sessionId
 * Update a chat session (title)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
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

    // Parse request body
    const body = await request.json()
    const { title } = body

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    // Update session
    const chatSessions = await getChatSessionsCollection()
    const result = await chatSessions.updateOne(
      {
        _id: new ObjectId(params.sessionId),
        workspaceId: new ObjectId(params.id),
        userId: new ObjectId(session.user.id),
      },
      {
        $set: {
          title: title.trim(),
          updatedAt: new Date(),
        },
      }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error updating chat session:", error)
    return NextResponse.json(
      { error: "Failed to update chat session" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workspaces/:id/chat/:sessionId
 * Delete a chat session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
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

    // Delete session
    const chatSessions = await getChatSessionsCollection()
    const result = await chatSessions.deleteOne({
      _id: new ObjectId(params.sessionId),
      workspaceId: new ObjectId(params.id),
      userId: new ObjectId(session.user.id),
    })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting chat session:", error)
    return NextResponse.json(
      { error: "Failed to delete chat session" },
      { status: 500 }
    )
  }
}


