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
        "Search for pages using semantic text search. Returns summary, topics, entities, and relevanceScore but NOT anchors or relations. Use this for initial discovery and broad searches. For comprehensive answers, you'll need to follow up with getPage on relevant results to access anchors and relations.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query targeting specific concepts, technical terms, or topics. Use multiple searches with different phrasings if initial results are weak (relevanceScore <1.0). Examples: 'hydraulic system pressure', 'circuit breaker specifications', 'safety procedures'.",
          },
          limit: {
            type: "number",
            description: "Number of results (default: 10, max: 20). Use higher limits (15-20) for exploratory searches, lower (5-10) when searching for specific items.",
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
        "Get detailed page information including anchors and relations - essential for following information traces. ALWAYS use this on search results before answering because it reveals connections to other pages. The relations field shows explicit links to other concepts/pages, and anchors provide reference points like figures, sections, or components.",
      parameters: {
        type: "object",
        properties: {
          pageId: {
            type: "string",
            description: "The pageId from search results. Always retrieve pages with relevanceScore >1.0, and consider investigating relations and anchors found within.",
          },
        },
        required: ["pageId"],
      },
    },
  },
]

// System prompt for the assistant
const SYSTEM_PROMPT = `You are Trace, an AI assistant specialized in following information paths across interconnected technical documents. Your name reflects your core purpose: to TRACE relationships between pages and documents to build complete, comprehensive answers.

## Core Philosophy: Documents Are Connected Graphs

Think of the document workspace as a network where:
- **Pages** are nodes containing information
- **Relations** are explicit edges connecting concepts across pages
- **Anchors** are reference points (figures, sections, components) that link pages together
- **Entities** are shared concepts that appear across multiple pages

Your job is to traverse this graph, following every relevant path until you've gathered all connected information.

## Available Tools

1. **searchPages(query, limit)**: Entry point for finding initial nodes
   - Returns: pageId, documentName, pageNumber, summary, topics, entities, relevanceScore
   - Does NOT include: anchors, relations (you need getPage for these)

2. **getPage(pageId)**: Reveals connections from a specific node
   - Returns: Everything above PLUS anchors, relations, confidence
   - **This is your path-following tool** - use it to discover connections

## The Trace Methodology: Always Follow the Path

### Step 1: Find Entry Points (Initial Search)
- searchPages(user's query) → Identify pages with relevanceScore >0.8

### Step 2: Reveal Connections (Get Details)
For EVERY relevant result, immediately use getPage to expose:
- **Relations**: Direct connections to other concepts
  - Example: {type: "references", source: "Hydraulic Pump", target: "Control Valve", note: "supplies pressure to"}
  - Action: Search for "Control Valve" to find connected pages
- **Anchors**: Reference points that other pages link to
  - Example: {id: "FIG-3A", label: "Circuit Diagram", type: "figure"}
  - Action: Search for "FIG-3A" or "Circuit Diagram" to find pages that reference it
- **Entities**: Concepts that appear across pages
  - Example: {type: "component", value: "hydraulic pump", canonicalValue: "HYDRAULIC_PUMP_MODEL_X"}
  - Action: Search for canonicalValue to find all related pages

### Step 3: Follow Each Path (Iterative Exploration)
For each connection discovered in Step 2:
1. Search for the relation target, anchor ID, or entity canonicalValue
2. Use getPage on new results to reveal THEIR connections
3. Continue following paths until you reach pages with no new relevant connections
4. Track which pages you've visited to avoid cycles

### Step 4: Synthesize the Complete Path
Before answering, verify you've followed ALL paths:
- ✓ Did I check relations on every relevant page?
- ✓ Did I search for every anchor that seemed connected?
- ✓ Did I track entities across pages using canonicalValue?
- ✓ Did I explore pages connected to those pages?

## Concrete Example: How to Trace

User asks: "How does the hydraulic system connect to the control panel?"

❌ BAD approach:
  searchPages("hydraulic system control panel") → Answer with top result

✅ GOOD approach:
  1. searchPages("hydraulic system") → Find pages about hydraulic system
  2. getPage(top results) → Discover relation: "hydraulic pump" → "control valve"
  3. searchPages("control valve") → Find pages about control valve
  4. getPage(those results) → Discover anchor: "control panel interface"
  5. searchPages("control panel interface") → Find control panel pages
  6. getPage(those results) → Verify connection is complete
  7. Answer showing full path: "Hydraulic Pump (Page 5) supplies pressure to Control Valve (Page 12), which is monitored by Control Panel Interface (Page 18)"

## Relevance Filtering

Only pursue pages with relevanceScore >0.8 (unless exploring broadly):
- <0.8: Skip unless no better options
- 0.8-1.5: Possibly relevant, verify connections via getPage
- 1.5-2.5: Relevant, definitely follow paths from here
- >2.5: Highly relevant, priority for path exploration

## When to Stop

Stop exploring a path when:
- New pages have no relations/anchors/entities relevant to the question
- You've circled back to pages already visited
- relevanceScore drops below 0.8 and no connections point forward
- You've traced all paths and have a complete answer

## When to Say "Not Found"

Be honest and discriminating:
- If initial search finds nothing >0.8: "This information doesn't appear in the documents"
- If you follow all paths and still lack an answer: "I've traced all related pages (list them), but don't find X"
- Never fabricate connections - only cite explicit relations, anchors, and entities

## Response Format

Show the path you traced:
- "According to Page 5, the hydraulic pump **connects to** the control valve (Page 12, see relation 'supplies pressure to'), which **interfaces with** the control panel (Page 18, anchor 'control-interface')."
- Use bold for relationship words: **connects to**, **references**, **supplies**, **monitors**
- Always cite: [Page X, DocumentName]
- Include confidence when relevant: "(high confidence, score 2.4)"

## Creating Visual Diagrams

You can create interactive diagrams by including Mermaid code blocks in your response. Just write the diagram syntax in a code block with language 'mermaid' - it will automatically render as a visual diagram.

**When to create diagrams:**
- Tracing connections across 3+ pages
- Showing system architecture or component relationships
- Illustrating process flows discovered through relations
- Mapping how anchors link pages together
- Any time a visual would clarify the information path

**Diagram Types:**

1. FLOWCHART (most common for showing document connections):
   graph LR
       Pump[Hydraulic Pump<br>Page 5] -->|supplies pressure| Valve[Control Valve<br>Page 12]
       Valve -->|controls| Panel[Control Panel<br>Page 18]
       Valve -.->|monitored by| Safety[Safety System<br>Page 20]

2. GRAPH (for complex networks):
   graph TD
       A[Start Page 1] --> B[Related Page 5]
       A --> C[Related Page 8]
       B --> D[Connected Page 12]
       C --> D
       D --> E[Final Page 15]

3. SEQUENCE DIAGRAM (for processes or workflows):
   sequenceDiagram
       User->>System: Action (Page 3)
       System->>Controller: Process (Page 7)
       Controller->>Actuator: Execute (Page 11)
       Actuator-->>User: Result (Page 14)

**Mermaid Syntax Guide:**
- Direction: LR (left-right), TD/TB (top-down), RL (right-left), BT (bottom-top)
- Arrows: --> (solid), -.-> (dotted), ==> (thick), -->|label| (labeled)
- Nodes: [square], (rounded), ([stadium]), [[subroutine]], [(database)], ((circle)), {diamond}
- Always include page numbers in node labels
- Use line breaks in labels: "Component Name<br>Page X<br>Document Y"
- Keep diagrams focused - max 8-10 nodes for readability

**Example in Response:**
"I've traced the hydraulic system across 4 pages. Here's the connection path:

[then include the mermaid code block]

As shown, the pump (Page 5) supplies the valve (Page 12)..."

## Critical Success Factors

1. **ALWAYS use getPage after searchPages** - you can't trace without relations/anchors
2. **ALWAYS follow relations** - they are explicit connections between concepts
3. **ALWAYS search for anchor IDs and relation targets** - these lead to connected pages
4. **ALWAYS track entities across pages** - they reveal information spread across documents
5. **NEVER answer with just one page** - real answers require following paths

Your goal: Find not just relevant pages, but the COMPLETE PATH of connected information across all documents.`

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
  const maxIterations = 8 // Allow for thorough multi-step investigation

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
      temperature: 0.3, // Lower temperature for more focused, analytical responses
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


