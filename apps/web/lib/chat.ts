/**
 * OpenAI Chat Integration with Tool Calling
 * Handles streaming chat completions and tool execution
 */

import OpenAI from "openai"
import type { ChatMessage } from "@trace/shared"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Tool definitions for OpenAI function calling
const tools = [
  {
    type: "function" as const,
    function: {
      name: "searchPages",
      description:
        "Search for relevant pages in the workspace using semantic search. Use this when the user asks about topics, concepts, or specific information that might be in the documents.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The search query. Be specific and include relevant keywords.",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 10, max: 20)",
            default: 10,
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getPage",
      description:
        "Get detailed information about a specific page. Use this when you need more details about a page that was found in search results, or when the user asks about a specific page number.",
      parameters: {
        type: "object",
        properties: {
          pageId: {
            type: "string",
            description: "The ID of the page to retrieve",
          },
        },
        required: ["pageId"],
      },
    },
  },
]

// System prompt for the assistant
const SYSTEM_PROMPT = `You are a helpful AI assistant that helps users explore and understand their PDF documents.

You have access to two tools:
1. searchPages: Search for relevant pages using keywords or topics
2. getPage: Get detailed information about a specific page

When answering questions:
- Always search for relevant information before answering
- Cite specific pages when you reference information
- If you can't find relevant information, say so clearly
- Be concise but informative
- Use the page summaries, topics, entities, and relations to provide comprehensive answers

Format your citations as: [Page X in DocumentName]`

interface ToolExecutionResult {
  toolCallId: string
  result: any
}

/**
 * Execute a tool call by making a request to the Indexer service
 */
async function executeTool(
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  const indexerUrl = process.env.INDEXER_SERVICE_URL || "http://localhost:3001"
  const serviceToken = process.env.INDEXER_SERVICE_TOKEN

  if (!serviceToken) {
    throw new Error("INDEXER_SERVICE_TOKEN not configured")
  }

  const response = await fetch(`${indexerUrl}/tools/${toolName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceToken}`,
    },
    body: JSON.stringify(args),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || `Tool execution failed: ${response.statusText}`)
  }

  return await response.json()
}

/**
 * Generate a chat completion with tool calling support
 * Returns an async generator for streaming responses
 */
export async function* generateChatCompletion(
  workspaceId: string,
  messages: ChatMessage[],
  model: string = "gpt-4o-mini"
): AsyncGenerator<{
  type: "content" | "toolCall" | "toolResult" | "done"
  content?: string
  toolCall?: { id: string; name: string; arguments: string }
  toolResult?: ToolExecutionResult
  finishReason?: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}> {
  // Convert our message format to OpenAI format
  const openaiMessages: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map((msg) => {
      // User and assistant messages
      if (msg.role === "user" || msg.role === "system") {
        return { role: msg.role, content: msg.content }
      }

      // Assistant message with tool calls
      if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
        return {
          role: "assistant",
          content: msg.content || null,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        }
      }

      // Tool response messages
      if (msg.role === "tool" && msg.toolCallId) {
        return {
          role: "tool",
          tool_call_id: msg.toolCallId,
          content: JSON.stringify(msg.content),
        }
      }

      return { role: msg.role, content: msg.content }
    }),
  ]

  let iteration = 0
  const maxIterations = 5 // Prevent infinite loops

  while (iteration < maxIterations) {
    iteration++
    console.log(`[Chat] === Iteration ${iteration} ===`)
    console.log(`[Chat] Message history (${openaiMessages.length} messages):`)
    openaiMessages.forEach((msg, idx) => {
      if (msg.role === 'tool') {
        console.log(`  [${idx}] role: tool, tool_call_id: ${msg.tool_call_id}`)
      } else if (msg.role === 'assistant' && msg.tool_calls) {
        console.log(`  [${idx}] role: assistant, tool_calls: ${msg.tool_calls.length} calls`)
        msg.tool_calls.forEach((tc: any) => console.log(`    - ${tc.id}: ${tc.function.name}`))
      } else {
        console.log(`  [${idx}] role: ${msg.role}`)
      }
    })

    // Call OpenAI with streaming
    const stream = await openai.chat.completions.create({
      model,
      messages: openaiMessages,
      tools,
      tool_choice: "auto",
      stream: true,
      temperature: 0.7,
    })
    
    console.log(`[Chat] Stream created for iteration ${iteration}`)

    const toolCalls: Map<number, any> = new Map()
    let contentBuffer = ""

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta

      // Handle content streaming
      if (delta?.content) {
        contentBuffer += delta.content
        yield { type: "content", content: delta.content }
      }

      // Handle tool call initiation
      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          const index = toolCall.index
          
          if (toolCall.id) {
            // New tool call
            toolCalls.set(index, {
              id: toolCall.id,
              name: toolCall.function?.name || "",
              arguments: toolCall.function?.arguments || "",
            })
          } else if (toolCalls.has(index) && toolCall.function?.arguments) {
            // Continue building arguments
            const existing = toolCalls.get(index)
            existing.arguments += toolCall.function.arguments
          }
        }
      }

      // Handle finish
      if (chunk.choices[0]?.finish_reason) {
        const finishReason = chunk.choices[0].finish_reason

        if (finishReason === "tool_calls" && toolCalls.size > 0) {
          // Assistant wants to call tools
          const toolCallsArray = Array.from(toolCalls.values())
          
          // Build assistant message with ALL tool calls
          const assistantToolCalls = toolCallsArray.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          }))

          openaiMessages.push({
            role: "assistant",
            content: null,
            tool_calls: assistantToolCalls,
          })

          // Execute each tool and collect results
          for (const toolCall of toolCallsArray) {
            console.log(`[Chat] Executing tool: ${toolCall.name} with args:`, toolCall.arguments)
            
            yield {
              type: "toolCall",
              toolCall,
            }

            try {
              const args = JSON.parse(toolCall.arguments)
              
              // Add workspaceId to tool arguments
              const toolArgs = { ...args, workspaceId }
              
              console.log(`[Chat] Calling executeTool for ${toolCall.name}`)
              const result = await executeTool(toolCall.name, toolArgs)
              console.log(`[Chat] Tool ${toolCall.name} result:`, result)

              yield {
                type: "toolResult",
                toolResult: {
                  toolCallId: toolCall.id,
                  result,
                },
              }

              // Add tool result to history
              openaiMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
              })
              console.log(`[Chat] Added tool response for ${toolCall.id}`)
            } catch (error: any) {
              console.error(`[Chat] Tool execution error for ${toolCall.name}:`, error)
              // Add error as tool result
              openaiMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: error.message }),
              })
              console.log(`[Chat] Added error response for ${toolCall.id}`)
            }
          }
          
          console.log(`[Chat] All ${toolCallsArray.length} tools executed, continuing to next iteration`)
          console.log(`[Chat] Message history length: ${openaiMessages.length}`)

          // Continue to next iteration to get final response
          break
        } else if (finishReason === "stop") {
          // Normal completion
          yield {
            type: "done",
            content: contentBuffer,
            finishReason,
            usage: chunk.usage
              ? {
                  promptTokens: chunk.usage.prompt_tokens,
                  completionTokens: chunk.usage.completion_tokens,
                  totalTokens: chunk.usage.total_tokens,
                }
              : undefined,
          }
          return
        }
      }
    }
  }

  // If we hit max iterations, return what we have
  yield {
    type: "done",
    content: "Maximum tool call iterations reached",
    finishReason: "stop",
  }
}


