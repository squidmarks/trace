import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWorkspaceRole } from "@/lib/permissions"
import { getChatSessionsCollection, getPagesCollection, getDocumentsCollection } from "@/lib/db"
import { generateChatCompletion } from "@/lib/chat"
import { ObjectId } from "mongodb"
import { sendMessageSchema } from "@trace/shared"
import type { ChatMessage, Citation, ToolCall } from "@trace/shared"

/**
 * POST /api/workspaces/:id/chat/:sessionId/messages
 * Send a message and get AI response (with streaming)
 */
export async function POST(
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

    // Parse and validate request body
    const body = await request.json()
    const validatedData = sendMessageSchema.parse(body)

    // Get chat session
    const chatSessions = await getChatSessionsCollection()
    const chatSession = await chatSessions.findOne({
      _id: new ObjectId(params.sessionId),
      workspaceId: new ObjectId(params.id),
      userId: new ObjectId(session.user.id),
    })

    if (!chatSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Add user message to session
    const userMessage: ChatMessage = {
      role: "user",
      content: validatedData.content,
      createdAt: new Date(),
    }

    await chatSessions.updateOne(
      { _id: new ObjectId(params.sessionId) },
      {
        $push: { messages: userMessage } as any,
        $set: { updatedAt: new Date() },
      }
    )

    // Get workspace config for model selection
    const workspaces = await (await import("@/lib/db")).getWorkspacesCollection()
    const workspace = await workspaces.findOne({ _id: new ObjectId(params.id) })
    const model = workspace?.config?.chat?.model || "gpt-4o-mini"

    // Generate AI response with streaming
    let fullContent = ""
    const citations: Citation[] = []
    let tokenUsage: any = null
    const messagesToSave: ChatMessage[] = [] // Track ALL messages to save

    for await (const event of generateChatCompletion(
      params.id,
      [...chatSession.messages, userMessage],
      model
    )) {
      if (event.type === "content" && event.content) {
        fullContent += event.content
      } else if (event.type === "toolCall" && event.toolCall) {
        // Tool call event means assistant made a tool call
        // We'll save this when we get the toolResult
      } else if (event.type === "toolResult" && event.toolResult) {
        // Extract citations from search results
        if (event.toolResult.result.results) {
          for (const result of event.toolResult.result.results) {
            citations.push({
              pageId: new ObjectId(result.pageId),
              documentId: new ObjectId(result.documentId),
              pageNumber: result.pageNumber,
              excerpt: result.summary?.substring(0, 200),
            })
          }
        }
      } else if (event.type === "done") {
        tokenUsage = event.usage
        break
      }
    }

    // Create final assistant message (only save the final response, not intermediate tool calls)
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: fullContent,
      createdAt: new Date(),
      model,
      citations: citations.length > 0 ? citations : undefined,
      tokenUsage,
      finishReason: "stop",
    }

    // Add assistant response to session
    await chatSessions.updateOne(
      { _id: new ObjectId(params.sessionId) },
      {
        $push: { messages: assistantMessage } as any,
        $set: { updatedAt: new Date() },
      }
    )

    return NextResponse.json({
      message: {
        ...assistantMessage,
        citations: citations.map((c) => ({
          ...c,
          pageId: c.pageId.toString(),
          documentId: c.documentId.toString(),
        })),
      },
    })
  } catch (error: any) {
    console.error("Error sending message:", error)

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/workspaces/:id/chat/:sessionId/messages
 * Get all messages for a session
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

    // Get chat session
    const chatSessions = await getChatSessionsCollection()
    const chatSession = await chatSessions.findOne({
      _id: new ObjectId(params.sessionId),
      workspaceId: new ObjectId(params.id),
      userId: new ObjectId(session.user.id),
    })

    if (!chatSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Format messages
    const formattedMessages = chatSession.messages.map((msg: any) => ({
      ...msg,
      citations: msg.citations?.map((c: any) => ({
        ...c,
        pageId: c.pageId?.toString(),
        documentId: c.documentId?.toString(),
      })),
    }))

    return NextResponse.json({ messages: formattedMessages })
  } catch (error: any) {
    console.error("Error getting messages:", error)
    return NextResponse.json(
      { error: "Failed to get messages" },
      { status: 500 }
    )
  }
}

