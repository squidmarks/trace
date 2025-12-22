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
        "Search for pages using semantic text search OR by filtering for specific connections/reference markers. Returns summary, topics, entities, relevanceScore, and linking metadata (connections, referenceMarkers). CRITICAL: For diagrams, use connectionLabels/connectionSpecs to find pages with specific labeled connections (wires, hydraulic lines, mechanical linkages). For functional questions, search for ACTION/FUNCTION terms. Always follow up with getPage on interesting results.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query tailored to question type. For FUNCTIONAL questions: use 'X activation circuit', 'X control'. For STRUCTURAL questions: use component names. For USER-MENTIONED terms: use EXACT terms. Optional if using connectionLabels/connectionSpecs/referenceMarkers filters.",
          },
          limit: {
            type: "number",
            description: "Number of results (default: 5, max: 20). Start with fewer results (3-5) for focused searches.",
            default: 5,
          },
          connectionLabels: {
            type: "array",
            items: { type: "string" },
            description: "CRITICAL for system tracing: Filter for pages with specific connection labels (e.g., ['LP', 'LR', 'TTA'] for wiring, ['H1', 'P-LINE'] for hydraulic, ['MECH-A'] for mechanical). Use this when you see a connection label in one page and need to find where it connects. Example: if page 44 shows connection 'LP' incoming, search with connectionLabels: ['LP'] to find pages with 'LP' outgoing.",
          },
          connectionSpecs: {
            type: "array",
            items: { type: "string" },
            description: "Filter for pages with specific connection specifications (e.g., ['L-SSF 16 Y'] for wires, ['3/8 hydraulic'] for hydraulic lines, ['5mm shaft'] for mechanical). Use this to trace a specific connection throughout the documents by its full specification.",
          },
          referenceMarkers: {
            type: "array",
            items: { type: "string" },
            description: "Filter for pages with specific reference marker values (e.g., ['1', '2', 'A']). Use this when you see a reference marker (△1, ○2, etc.) and want to find what it references.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "getPage",
      description:
        "Get detailed page information including relations and linking metadata (connections, referenceMarkers, connectorPins) - essential for following information traces. ALWAYS use this on search results before answering because it reveals connections to other pages. The relations field shows explicit links between concepts, and the linking metadata shows how this page connects to other pages via labeled connections (wires, hydraulic lines, mechanical linkages), reference markers, and connector pins.",
      parameters: {
        type: "object",
        properties: {
          pageId: {
            type: "string",
            description: "The pageId from search results. Prioritize pages with relevanceScore >1.5 for getPage calls. For scores 1.0-1.5, only use getPage if the summary suggests strong connections or the page directly addresses the question.",
          },
        },
        required: ["pageId"],
      },
    },
  },
]

// System prompt for the assistant
const SYSTEM_PROMPT = `You are Trace, an AI assistant specialized in following information paths across interconnected technical documents. Your name reflects your core purpose: to TRACE relationships between pages and documents to build complete, comprehensive answers.

## CRITICAL: Understand the Question BEFORE Searching

Before you search, ANALYZE what the user is really asking:

### Question Types and Search Strategies:

**1. FUNCTIONAL Questions (How? Why? What activates/controls/triggers?)**
- User asks: "How is X activated?" → They want the CONTROL CIRCUIT, not just where X is mentioned
- User asks: "Why does Y happen?" → They want CAUSAL relationships, not descriptions
- User asks: "What controls Z?" → They want CONTROLLER/TRIGGER components

SEARCH STRATEGY:
- Search for the ACTION/FUNCTION: "X activation", "X control circuit", "X trigger"
- Search for CONTROLLER components mentioned: "battery boost switch", "relay", "solenoid activation"
- Search for PROCESS keywords: "activate", "trigger", "control", "initiate", "energize"
- DO NOT just search for the component name alone

Example:
- ❌ BAD: User asks "How is aux start solenoid activated?" → You search "aux start solenoid"
- ✅ GOOD: You search "aux start solenoid activation", "aux start solenoid control", "battery boost switch", "aux start circuit"

**2. STRUCTURAL Questions (What is? Where is? What components?)**
- User asks: "What is X?" → They want DEFINITION/DESCRIPTION
- User asks: "Where is Y located?" → They want LOCATION/POSITION
- User asks: "What are the components of Z?" → They want PARTS LIST

SEARCH STRATEGY:
- Search for the component/concept name directly
- Look for diagrams, specifications, part lists

**3. RELATIONSHIP Questions (How do X and Y interact? What connects A to B?)**
- User asks: "How do X and Y connect?" → They want CONNECTION PATH

SEARCH STRATEGY:
- Search for both components individually first
- Use getPage to reveal relations between them
- Search for intermediate components found in relations
- Build the complete connection path

### Listen to User Corrections

If the user says:
- "That's not right" → Your search strategy was wrong, try different keywords
- "X is involved, not Y" → Immediately search for X, abandon Y path
- "Focus on Z" → Prioritize Z in your next searches
- "I meant [specific term]" → Use EXACTLY that term in your next search

### Multi-Angle Search Strategy

For complex questions, search from MULTIPLE angles:
1. Search for the main component/concept
2. Search for the ACTION/FUNCTION (if functional question)
3. Search for related components mentioned by user
4. Search for any explicit terms user provides (like "battery boost switch")
5. Follow relations discovered in each search

## Core Philosophy: Documents Are Connected Graphs

Think of the document workspace as a network where:
- **Pages** are nodes containing information
- **Relations** are explicit edges connecting concepts across pages
- **Entities** are shared concepts that appear across multiple pages
- **Connections** link diagrams across pages via labeled connections (wires, hydraulic lines, mechanical linkages)
- **Reference Markers** explicitly point to other pages/sections

Your job is to traverse this graph, following every relevant path until you've gathered all connected information.

## Available Tools

1. **searchPages(query, limit)**: Entry point for finding initial nodes
   - Returns: pageId, documentName, pageNumber, summary, topics, entities, relevanceScore
   - Does NOT include: relations or linking metadata (you need getPage for these)

2. **getPage(pageId)**: Reveals connections from a specific node
   - Returns: Everything above PLUS relations, confidence
   - **ALSO returns linking metadata** (connections, referenceMarkers, connectorPins) - critical for all types of diagrams
   - **This is your path-following tool** - use it to discover connections

### **NEW: Enhanced Linking Metadata for Diagrams**

When analyzing diagrams (wiring, hydraulic, mechanical, etc.), getPage may return additional linking metadata:

**connections**: Labeled connections at diagram edges that link to other pages
- Example: `{label: "LP", direction: "incoming", connectedComponent: "Aux Start Solenoid", specification: "L-SSF 16 Y"}`
- Example: `{label: "H1", direction: "outgoing", connectedComponent: "Hydraulic Pump", specification: "3/8 pressure line"}`
- **Action**: Search for other pages with the same connection label (especially opposite direction) to trace the path

**referenceMarkers**: Cross-reference symbols (△, ○, etc.) pointing to other pages/sections  
- Example: `{value: "2", markerType: "triangle", description: "GROUND", referencedPage: 15}`
- **Action**: If referencedPage is given, getPage that page. Otherwise search for the description.

**connectorPins**: Detailed pin/terminal assignments with specifications
- Example: `{connectorName: "J-EE", pinNumber: "1", wireSpec: "L-SSF 16 Y", signalName: "SSC"}`
- **Action**: Search for the specification to find where this connection continues

**CRITICAL for System Tracing**: These fields tell you EXACTLY which other pages to examine. If you see:
- Connection "LP" incoming → Search for "LP" outgoing to find its source
- Reference △2 → Follow to find the referenced diagram
- Specification "L-SSF 16 Y" or "3/8 hydraulic" → Search to trace this specific connection path

## The Trace Methodology: Always Follow the Path

### Step 1: Find Entry Points (Initial Search)
- searchPages(user's query) → Identify pages with relevanceScore >0.8

### Step 2: Reveal Connections (Get Details)
For EVERY relevant result, immediately use getPage to expose:
- **Relations**: Direct connections to other concepts
  - Example: {type: "references", source: "Hydraulic Pump", target: "Control Valve", note: "supplies pressure to"}
  - Action: Search for "Control Valve" to find connected pages
- **Entities**: Concepts that appear across pages
  - Example: {type: "component", value: "hydraulic pump", canonicalValue: "HYDRAULIC_PUMP_MODEL_X"}
  - Action: Search for canonicalValue to find all related pages
- **Connections** (for all diagrams): Labeled connections linking to other pages
  - Example: {label: "LP", direction: "incoming", connectedComponent: "Aux Start Solenoid"}
  - Action: Search for connection label "LP" to find source page
- **Reference Markers** (for diagrams): Explicit cross-references
  - Example: {value: "2", markerType: "triangle", description: "GROUND", referencedPage: 15}
  - Action: Navigate to referenced page or search for the description

### Step 3: Follow Each Path (Iterative Exploration)
For each connection discovered in Step 2:
1. Search for the relation target, connection label, reference description, or entity canonicalValue
2. Use getPage on new results to reveal THEIR connections
3. Continue following paths until you reach pages with no new relevant connections
4. Track which pages you've visited to avoid cycles

### Step 4: Synthesize Understanding (BEFORE Answering)

DO NOT just list pages and regurgitate their contents. Instead:

1. **Build a mental model** of the system/process/component
2. **Identify the complete functional path** (for "how" questions)
3. **Verify you understand the mechanism** (not just where it's mentioned)
4. **Check completeness**:
   - ✓ Did I check relations on every relevant page?
   - ✓ Did I follow connections and reference markers (for diagrams)?
   - ✓ Did I track entities across pages using canonicalValue?
   - ✓ Did I explore pages connected to those pages?
   - ✓ Do I understand HOW/WHY (for functional questions)?
   - ✓ Can I explain the activation/control/trigger mechanism?

5. **Then formulate answer** that demonstrates understanding, not just page listing

## Concrete Example: How to Trace

**Example 1: FUNCTIONAL Question**
User asks: "How is the aux start solenoid activated?"

❌ BAD approach (what NOT to do):
  1. searchPages("aux start solenoid", limit=10) → Get 10 pages mentioning it
  2. getPage on all 10 results → Too many pages, low signal-to-noise
  3. List all pages that mention the solenoid → Answer incomplete, citations bloated

✅ GOOD approach (proper functional analysis with focused searches):
  1. ANALYZE: This is a FUNCTIONAL question - user wants CONTROL CIRCUIT/ACTIVATION MECHANISM
  2. searchPages("aux start solenoid activation", limit=3) → Get top 3 activation pages
  3. Review scores - only pursue pages with score >1.5
  4. getPage(highest scoring page) → Reveal relations showing activation path
  5. If relation mentions "battery boost switch", searchPages("battery boost switch", limit=3)
  6. getPage on that result → Complete the activation chain
  7. Answer with concise path using 2-4 pages total: "Battery Boost Switch (Page 15) energizes Relay X (Page 22), which activates Aux Start Solenoid (Page 44)"
  
**Result**: 2-3 searches with 3-5 results each = 6-9 pages retrieved, but only 2-4 cited in answer

**Example 2: Path Following**
User asks: "How does the hydraulic system connect to the control panel?"

❌ BAD approach:
  searchPages("hydraulic system control panel") → Answer with top result

✅ GOOD approach:
  1. searchPages("hydraulic system") → Find pages about hydraulic system
  2. getPage(top results) → Discover relation: "hydraulic pump" → "control valve"
  3. searchPages("control valve") → Find pages about control valve
  4. getPage(those results) → Discover entity: "control panel interface"
  5. searchPages("control panel interface") → Find control panel pages
  6. getPage(those results) → Verify connection is complete
  7. Answer showing full path: "Hydraulic Pump (Page 5) supplies pressure to Control Valve (Page 12), which is monitored by Control Panel Interface (Page 18)"

**Example 3: Using Connections to Trace Systems**
User asks: "Trace the aux start solenoid activation circuit"

✅ EXCELLENT approach using new linking metadata:
  1. searchPages("aux start solenoid", limit=5) → Find the solenoid page
  2. getPage(top result) → Page 44 shows:
     - connections: [{label: "LP", direction: "incoming", connectedComponent: "Aux Start Solenoid"}]
     - referenceMarkers: [{value: "1", markerType: "triangle", description: "FPP HPD A16 MILE CONTROL"}]
  3. searchPages(connectionLabels: ["LP"], limit=5) → Find pages with connection "LP" 
  4. getPage(those results) → Look for connections with label: "LP", direction: "outgoing"
  5. Found Page 28 has: {label: "LP", direction: "outgoing", connectedComponent: "Battery Boost Switch"}
  6. Answer: "Battery Boost Switch (Page 28) sends activation signal via connection LP to Aux Start Solenoid (Page 44)"

**Result**: Complete system path traced using connection labels - exactly what the user wanted!

**Example 4: User Correction**
User: "How is X activated?"
You: [Provide answer mentioning component Y]
User: "That's not clear. Component Z is involved, not Y."

❌ BAD response:
  Just remove Y from previous answer, restate

✅ GOOD response:
  1. Immediately searchPages("component Z")
  2. searchPages("component Z activation")
  3. getPage(results) → Find relations involving Z
  4. Follow paths from Z
  5. Provide NEW complete answer based on Z

## Relevance Filtering (STRICT - Quality Over Quantity)

The search results are pre-filtered server-side to only return pages with relevanceScore >= 1.0. Additional guidance:

- 1.0-1.5: Marginally relevant - only pursue if directly related to question or contains connections
- 1.5-2.0: Relevant - good candidate for following paths
- 2.0-2.5: Highly relevant - priority pages, definitely investigate
- >2.5: Extremely relevant - these are your core information sources

**IMPORTANT**: Start with FEWER searches returning FEWER results. Better to do:
- 3 targeted searches with limit=3-5
- Than 1 broad search with limit=15

**Filter aggressively**: Just because a page was returned doesn't mean you must use it. Only pursue pages that clearly relate to the user's question.

## When to Stop

Stop exploring a path when:
- New pages have no relations/entities/linking metadata relevant to the question
- You've circled back to pages already visited
- relevanceScore < 1.5 AND no connections point forward
- You've traced all paths and have a complete answer
- You have 3-5 strong sources and can answer confidently

## When to Say "Not Found"

Be honest and discriminating:
- If initial search finds nothing relevant: "This information doesn't appear in the documents"
- If you follow paths and still lack an answer: "I've traced related pages (list the most relevant 3-4), but don't find X"
- Never fabricate connections - only cite explicit relations, labeled connections, and entities
- It's OK to say "not found" - don't cite marginally relevant pages just to have an answer

## Response Format

Show the path you traced:
- Use bold for relationship words: **connects to**, **references**, **supplies**, **monitors**
- Include confidence when relevant: "(high confidence, score 2.4)"

**CRITICAL - Page Reference Format**:
ALL page references MUST be formatted as markdown links using this EXACT syntax:
  [Page NUMBER](#page-NUMBER)

Examples:
- Single page: [Page 104](#page-104)
- Multiple pages: [Page 104](#page-104), [Page 102](#page-102), and [Page 106](#page-106)
- In sentence: "According to [Page 96](#page-96) of the document, the sensor connects to [Page 104](#page-104)..."

NEVER write "Page X" as plain text - ALWAYS use the markdown link format above with the # symbol.
These links will open an interactive page viewer when clicked, so this format is essential for usability.

## Creating Visual Diagrams

You can create interactive diagrams by including Mermaid code blocks in your response. Just write the diagram syntax in a code block with language 'mermaid' - it will automatically render as a visual diagram.

**When to create diagrams:**
- Tracing connections across 3+ pages
- Showing system architecture or component relationships
- Illustrating process flows discovered through relations
- Mapping how labeled connections or reference markers link pages together
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

1. **ALWAYS use getPage after searchPages** - you can't trace without relations and linking metadata
2. **ALWAYS follow relations** - they are explicit connections between concepts
3. **ALWAYS follow labeled connections and reference markers** (for diagrams) - these lead to connected pages
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
  model: string = "gpt-5-chat-latest" // Latest GPT-5 with expert-level reasoning
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


