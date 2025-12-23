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
    const model = workspace?.config?.chat?.model || "gpt-5.2-chat-latest"

    // Fetch explicit pages if provided
    let explicitPagesContext = ""
    if (validatedData.explicitPageIds && validatedData.explicitPageIds.length > 0) {
      const pages = await getPagesCollection()
      const documents = await getDocumentsCollection()
      
      const explicitPages = await pages.find({
        _id: { $in: validatedData.explicitPageIds.map(id => new ObjectId(id)) },
        workspaceId: new ObjectId(params.id)
      }).toArray()
      
      // Get document names for each page
      const explicitPagesWithDocs = await Promise.all(explicitPages.map(async (page) => {
        const doc = await documents.findOne({ _id: page.documentId })
        return { page, documentName: doc?.name || "Unknown" }
      }))
      
      explicitPagesContext = `\n\n[EXPLICIT PAGE REFERENCES FROM USER]\nThe user has explicitly selected these pages to include in the conversation:\n${explicitPagesWithDocs.map(({ page, documentName }) => 
        `- Page ${page.pageNumber} from "${documentName}"\n  Summary: ${page.analysis?.summary || "No summary"}\n  Topics: ${page.analysis?.topics?.join(", ") || "None"}`
      ).join("\n")}\n[END EXPLICIT REFERENCES]\n\n`
    }

    // Augment user message with explicit page context
    const augmentedUserMessage: ChatMessage = {
      ...userMessage,
      content: explicitPagesContext + userMessage.content
    }

    // Create streaming response with Server-Sent Events
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: any) => {
          const data = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(data))
        }

        let fullContent = ""
        const citations: Citation[] = []
        let tokenUsage: any = null

        // Add explicit pages to citations upfront
        if (validatedData.explicitPageIds && validatedData.explicitPageIds.length > 0) {
          const pages = await getPagesCollection()
          const documents = await getDocumentsCollection()
          
          const explicitPages = await pages.find({
            _id: { $in: validatedData.explicitPageIds.map(id => new ObjectId(id)) },
            workspaceId: new ObjectId(params.id)
          }).toArray()
          
          for (const page of explicitPages) {
            const doc = await documents.findOne({ _id: page.documentId })
            citations.push({
              pageId: page._id,
              documentId: page.documentId,
              documentName: doc?.name || "Unknown",
              pageNumber: page.pageNumber,
              excerpt: page.analysis?.summary?.substring(0, 200) || "",
            })
          }
        }

        try {
          console.log(`[Messages API] Starting chat completion for session ${params.sessionId}`)
          console.log(`[Messages API] Model: ${model}`)
          console.log(`[Messages API] Message count: ${chatSession.messages.length + 1}`)
          console.log(`[Messages API] Explicit pages: ${validatedData.explicitPageIds?.length || 0}`)
          
          for await (const event of generateChatCompletion(
            params.id,
            [...chatSession.messages, augmentedUserMessage],
            model
          )) {
            if (event.type === "content" && event.content) {
              fullContent += event.content
              sendEvent({ type: "content", content: event.content })
            } else if (event.type === "toolCall" && event.toolCall) {
              // Send progress message for tool call
              const toolName = event.toolCall.name
              const args = JSON.parse(event.toolCall.arguments || "{}")
              
              let progressMessage = ""
              if (toolName === "searchPages") {
                progressMessage = `🔍 Searching for: "${args.query}"...`
              } else if (toolName === "getPage") {
                progressMessage = `📄 Analyzing page details...`
              }
              
              sendEvent({ 
                type: "progress", 
                message: progressMessage,
                toolCall: { name: toolName, arguments: args }
              })
            } else if (event.type === "toolResult" && event.toolResult) {
              // Send progress for tool result
              const result = event.toolResult.result
              
              if (result.results && result.results.length > 0) {
                const pages = result.results.slice(0, 3).map((r: any) => 
                  `Page ${r.pageNumber} (${r.documentName})`
                ).join(", ")
                sendEvent({ 
                  type: "progress", 
                  message: `✓ Found ${result.results.length} relevant pages: ${pages}${result.results.length > 3 ? '...' : ''}`
                })
              } else if (result.page) {
                sendEvent({ 
                  type: "progress", 
                  message: `✓ Retrieved details from Page ${result.page.pageNumber}`
                })
              }
              
              // Extract citations from search results
              if (result.results) {
                for (const searchResult of result.results) {
                  citations.push({
                    pageId: new ObjectId(searchResult.pageId),
                    documentId: new ObjectId(searchResult.documentId),
                    documentName: searchResult.documentName,
                    pageNumber: searchResult.pageNumber,
                    excerpt: searchResult.summary?.substring(0, 200),
                  })
                }
              }
            } else if (event.type === "done") {
              tokenUsage = event.usage
              // If no content was streamed but done event has content (e.g. max iterations message),
              // use that content
              if (!fullContent && event.content) {
                console.log(`[Messages API] Using content from done event: "${event.content}"`)
                fullContent = event.content
              }
              break
            }
          }

          // Create final assistant message
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: fullContent,
            createdAt: new Date(),
            model,
            citations: citations.length > 0 ? citations : undefined,
            tokenUsage,
            finishReason: "stop",
          }

          console.log(`[Messages API] Chat completion finished`)
          console.log(`[Messages API] Content length: ${fullContent.length} characters`)
          console.log(`[Messages API] Citations: ${citations.length}`)

          // Save to database
          await chatSessions.updateOne(
            { _id: new ObjectId(params.sessionId) },
            {
              $push: { messages: assistantMessage } as any,
              $set: { updatedAt: new Date() },
            }
          )
          
          console.log(`[Messages API] Saved assistant message to database`)

          // Generate title in background if this is the first message
          if (chatSession.messages.length === 0 && !chatSession.title) {
            generateSessionTitle(params.sessionId, userMessage.content, fullContent).catch((err) =>
              console.error("Error generating session title:", err)
            )
          }

          // Send final done event with complete message
          sendEvent({
            type: "done",
            message: {
              ...assistantMessage,
              citations: citations.map((c) => ({
                ...c,
                pageId: c.pageId.toString(),
                documentId: c.documentId.toString(),
              })),
            },
          })

          controller.close()
        } catch (error: any) {
          console.error("[Messages API] Error during streaming:", error)
          console.error("[Messages API] Error stack:", error.stack)
          console.error("[Messages API] Error name:", error.name)
          sendEvent({ type: "error", error: error.message || "Unknown error during streaming" })
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
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

    // Collect all unique document IDs from citations across all messages
    const documentIds = new Set<string>()
    chatSession.messages.forEach((msg: any) => {
      if (msg.citations) {
        msg.citations.forEach((c: any) => {
          if (c.documentId) {
            documentIds.add(c.documentId.toString())
          }
        })
      }
    })

    // Fetch document names if we have citations
    let documentsMap = new Map<string, string>()
    if (documentIds.size > 0) {
      const { getDocumentsCollection } = await import("@/lib/db")
      const documents = await getDocumentsCollection()
      const docs = await documents
        .find({ _id: { $in: Array.from(documentIds).map(id => new ObjectId(id)) } })
        .project({ _id: 1, filename: 1 })
        .toArray()
      
      documentsMap = new Map(docs.map(d => [d._id.toString(), d.filename]))
    }

    // Format messages and populate document names in citations
    const formattedMessages = chatSession.messages.map((msg: any) => ({
      ...msg,
      citations: msg.citations?.map((c: any) => ({
        ...c,
        pageId: c.pageId?.toString(),
        documentId: c.documentId?.toString(),
        documentName: documentsMap.get(c.documentId?.toString()) || c.documentName || "Unknown",
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

/**
 * Generate a title for a chat session using AI
 */
async function generateSessionTitle(
  sessionId: string,
  userMessage: string,
  assistantResponse: string
): Promise<void> {
  const OpenAI = (await import("openai")).default
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Generate a short, descriptive title (max 50 characters) for this conversation. Only respond with the title, no quotes or punctuation at the end.",
        },
        {
          role: "user",
          content: userMessage,
        },
        {
          role: "assistant",
          content: assistantResponse,
        },
      ],
      max_tokens: 20,
      temperature: 0.7,
    })

    const title = response.choices[0]?.message?.content?.trim()
    if (title) {
      // Update session with generated title
      const chatSessions = await getChatSessionsCollection()
      await chatSessions.updateOne(
        { _id: new ObjectId(sessionId) },
        {
          $set: {
            title,
            updatedAt: new Date(),
          },
        }
      )
      
      console.log(`[Chat] Generated title for session ${sessionId}: "${title}"`)
    }
  } catch (error) {
    console.error("Error generating session title:", error)
    throw error
  }
}

