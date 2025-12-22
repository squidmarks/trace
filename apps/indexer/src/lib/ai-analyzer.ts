import OpenAI from "openai"
import logger from "./logger.js"
import { getAnalysisModel, calculateCost } from "./model-config.js"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Simplified interface for AI response
interface AIPageAnalysis {
  summary: string
  topics: string[]
  entities: Array<{
    id: string
    type: string
    label: string
    value?: string
    confidence: number
  }>
  relations: Array<{
    id: string
    type: string
    from: string
    to: string
    label?: string
    confidence: number
  }>
  connections?: Array<{
    label: string
    specification?: string
    direction: "incoming" | "outgoing" | "bidirectional"
    connectedComponent?: string
    confidence: number
  }>
  referenceMarkers?: Array<{
    value: string
    markerType: "triangle" | "circle" | "square" | "other"
    description?: string
    referencedPage?: number
    referencedSection?: string
    confidence: number
  }>
  connectorPins?: Array<{
    connectorName: string
    pinNumber?: string
    wireSpec?: string
    signalName?: string
    connectedTo?: string
    confidence: number
  }>
}

const ANALYSIS_PROMPT = `Analyze this document page image and extract structured information.

Return a JSON object with:
1. **summary** (string): 2-3 sentence summary of the page content
2. **topics** (string[]): 3-5 main topics/themes (lowercase, hyphenated)
3. **entities** (array): Important named entities (people, places, parts, specs, etc.)
   - id: unique identifier
   - type: "person", "place", "part", "specification", "measurement", etc.
   - label: human-readable name
   - value: associated value if applicable (e.g., "12V" for a voltage spec)
   - confidence: 0.0-1.0
4. **relations** (array): Relationships between entities
   - id: unique identifier
   - type: "connects-to", "part-of", "requires", "compatible-with", etc.
   - from: entity id
   - to: entity id
   - label: optional description
   - confidence: 0.0-1.0

**FOR DIAGRAMS AND SCHEMATICS, ALSO EXTRACT:**

5. **connections** (array): Labeled connections that link to/from other pages (CRITICAL for tracing systems)
   - label: Connection identifier at diagram edge (e.g., "LP", "LLO", "TTA", "H1", "P-LINE", "MECH-A")
   - specification: Full specification if shown (e.g., "L-SSF 16 Y" for wires, "3/8 hydraulic" for hydraulic lines, "5mm shaft" for mechanical)
   - direction: "incoming", "outgoing", or "bidirectional"
   - connectedComponent: Which component on THIS page the connection links to (if visible)
   - confidence: 0.0-1.0

6. **referenceMarkers** (array): Cross-reference symbols pointing to other pages/sections (CRITICAL for navigation)
   - value: The marker identifier (e.g., "1", "2", "A", "B")
   - markerType: "triangle", "circle", "square", or "other"
   - description: What the marker text says (e.g., "FPP (OMIT, HPD) A16, MILE CONTROL WIRING", "GROUND")
   - referencedPage: Page number if explicitly stated
   - referencedSection: Section or diagram name if stated
   - confidence: 0.0-1.0

7. **connectorPins** (array): Detailed connector/terminal pin assignments
   - connectorName: Connector identifier (e.g., "J-EE", "J-FF", "Leveling Control")
   - pinNumber: Pin number or position if shown
   - wireSpec: Wire specification for this pin (e.g., "L-SSF 16 Y")
   - signalName: Signal or function name if labeled
   - connectedTo: What this pin connects to
   - confidence: 0.0-1.0

**CRITICAL INSTRUCTIONS FOR DIAGRAMS:**
- Look at the EDGES of diagrams for connection labels (LP, LLO, TTA, H1, P-LINE, etc.) - these link to other pages!
- Look for shapes with numbers/letters inside (△1, △2, ○A, etc.) - these are cross-references!
- Look for connector boxes with pin details and specifications
- For wiring: specifications follow patterns like [letter]-[code] [gauge] [color] (e.g., "L-SSF 16 Y")
- For hydraulic: look for line sizes and types (e.g., "3/8 pressure line", "1/2 return")
- For mechanical: look for shaft sizes, linkage types (e.g., "5mm shaft", "cable A")
- Pay special attention to labeled connections entering/leaving the diagram boundaries

Focus on technical accuracy and extracting actionable information. For diagrams and schematics, identify components, their relationships, AND the linking information that connects this page to others.

Return ONLY valid JSON, no markdown formatting.`

/**
 * Analyze a page image using OpenAI Vision API
 * @param imageBase64 - Base64 encoded JPEG image
 * @param pageNumber - Page number for context
 * @param filename - Document filename for context
 * @param modelName - Model to use (defaults to env or gpt-4o-mini)
 * @param detail - Vision API detail level: "low" | "auto" | "high" (defaults to "auto")
 * @returns Structured page analysis and token usage
 */
export async function analyzePage(
  imageBase64: string,
  pageNumber: number,
  filename: string,
  modelName?: string,
  detail: "low" | "auto" | "high" = "auto"
): Promise<{ analysis: any; inputTokens: number; outputTokens: number; cost: number }> {
  const model = getAnalysisModel(modelName)
  logger.debug(`   Analyzing page ${pageNumber} with ${model.name} (detail: ${detail})...`)

  try {
    const response = await openai.chat.completions.create({
      model: modelName || process.env.ANALYSIS_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: ANALYSIS_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Document: ${filename}\nPage: ${pageNumber}\n\nAnalyze this page:`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: detail,
              },
            },
          ],
        },
      ],
      max_tokens: 3000, // Increased for additional linking metadata
      temperature: 0.1, // Low temperature for consistency
      response_format: { type: "json_object" },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error("No response from OpenAI")
    }

    // Parse JSON response
    const aiAnalysis = JSON.parse(content) as AIPageAnalysis

    // Validate required fields
    if (!aiAnalysis.summary || !aiAnalysis.topics || !Array.isArray(aiAnalysis.topics)) {
      throw new Error("Invalid analysis structure")
    }

    // Ensure arrays exist
    aiAnalysis.entities = aiAnalysis.entities || []
    aiAnalysis.relations = aiAnalysis.relations || []
    aiAnalysis.connections = aiAnalysis.connections || []
    aiAnalysis.referenceMarkers = aiAnalysis.referenceMarkers || []
    aiAnalysis.connectorPins = aiAnalysis.connectorPins || []

    // Convert to MongoDB PageAnalysis format
    const pageAnalysis: any = {
      summary: aiAnalysis.summary,
      topics: aiAnalysis.topics,
      entities: aiAnalysis.entities.map((e) => ({
        type: e.type,
        value: e.label, // Use label as value
        canonicalValue: e.value, // Optional specific value
        confidence: e.confidence,
      })),
      relations: aiAnalysis.relations.map((r) => ({
        type: r.type,
        source: {
          kind: "entity" as const,
          id: r.from,
        },
        target: {
          kind: "entity" as const,
          id: r.to,
        },
        confidence: r.confidence,
        note: r.label,
      })),
      confidence: 0.85, // Overall confidence score
      modelVersion: "gpt-4o",
      promptVersion: "v2.0", // Updated version for enhanced linking metadata
      analyzedAt: new Date(),
    }

    // Add new linking metadata if present
    if (aiAnalysis.connections && aiAnalysis.connections.length > 0) {
      pageAnalysis.connections = aiAnalysis.connections.map((c) => ({
        label: c.label,
        specification: c.specification,
        direction: c.direction,
        connectedComponent: c.connectedComponent,
        confidence: c.confidence,
      }))
    }

    if (aiAnalysis.referenceMarkers && aiAnalysis.referenceMarkers.length > 0) {
      pageAnalysis.referenceMarkers = aiAnalysis.referenceMarkers.map((m) => ({
        value: m.value,
        markerType: m.markerType,
        description: m.description,
        referencedPage: m.referencedPage,
        referencedSection: m.referencedSection,
        confidence: m.confidence,
      }))
    }

    if (aiAnalysis.connectorPins && aiAnalysis.connectorPins.length > 0) {
      pageAnalysis.connectorPins = aiAnalysis.connectorPins.map((p) => ({
        connectorName: p.connectorName,
        pinNumber: p.pinNumber,
        wireSpec: p.wireSpec,
        signalName: p.signalName,
        connectedTo: p.connectedTo,
        confidence: p.confidence,
      }))
    }

    // Extract token usage
    const inputTokens = response.usage?.prompt_tokens || 0
    const outputTokens = response.usage?.completion_tokens || 0
    const cost = calculateCost(inputTokens, outputTokens, model)

    // Build detailed logging message
    const linkingInfo = []
    if (pageAnalysis.connections?.length > 0) linkingInfo.push(`${pageAnalysis.connections.length} connections`)
    if (pageAnalysis.referenceMarkers?.length > 0) linkingInfo.push(`${pageAnalysis.referenceMarkers.length} refs`)
    if (pageAnalysis.connectorPins?.length > 0) linkingInfo.push(`${pageAnalysis.connectorPins.length} pins`)
    const linkingSummary = linkingInfo.length > 0 ? `, ${linkingInfo.join(", ")}` : ""

    logger.debug(
      `   ✅ Analysis complete: ${pageAnalysis.topics.length} topics, ${pageAnalysis.entities.length} entities${linkingSummary} (${inputTokens}/${outputTokens} tokens, $${cost.toFixed(4)})`
    )

    return {
      analysis: pageAnalysis,
      inputTokens,
      outputTokens,
      cost,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error(`   ❌ Analysis failed for page ${pageNumber}: ${message}`)
    throw new Error(`Failed to analyze page: ${message}`)
  }
}

/**
 * Analyze multiple pages with rate limiting and error handling
 * @param pages - Array of page objects with imageData and pageNumber
 * @param filename - Document filename
 * @param modelName - Model to use for analysis
 * @param onProgress - Progress callback
 * @returns Array of analyses with cost tracking
 */
export async function analyzePages(
  pages: Array<{ pageNumber: number; imageData: string }>,
  filename: string,
  modelName: string,
  onProgress?: (current: number, total: number, cost: number) => void
): Promise<{
  results: Array<any | null>
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
}> {
  const results: Array<any | null> = []
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCost = 0

  const maxConcurrent = 3 // Process 3 pages at a time
  const delayBetweenBatches = 1000 // 1 second between batches

  const totalBatches = Math.ceil(pages.length / maxConcurrent)
  logger.info(`🤖 Starting AI analysis: ${pages.length} pages (${totalBatches} batches of ${maxConcurrent})`)

  for (let i = 0; i < pages.length; i += maxConcurrent) {
    const batch = pages.slice(i, i + maxConcurrent)
    const batchNum = Math.floor(i / maxConcurrent) + 1
    
    logger.info(`   📊 Batch ${batchNum}/${totalBatches}: Analyzing pages ${i + 1}-${Math.min(i + maxConcurrent, pages.length)}...`)
    
    const batchResults = await Promise.allSettled(
      batch.map((page) => analyzePage(page.imageData, page.pageNumber, filename, modelName))
    )

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value.analysis)
        totalInputTokens += result.value.inputTokens
        totalOutputTokens += result.value.outputTokens
        totalCost += result.value.cost
      } else {
        logger.warn(`   ⚠️  Page analysis failed: ${result.reason}`)
        results.push(null) // Continue with other pages
      }
    }

    const successCount = results.filter((r) => r !== null).length
    logger.info(`   ✅ Progress: ${successCount}/${pages.length} pages analyzed (${Math.round((successCount / pages.length) * 100)}%) - Cost: $${totalCost.toFixed(4)}`)

    onProgress?.(results.length, pages.length, totalCost)

    // Rate limiting delay between batches (except for last batch)
    if (i + maxConcurrent < pages.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches))
    }
  }

  const successCount = results.filter((r) => r !== null).length
  logger.info(
    `✅ AI analysis complete: ${successCount}/${pages.length} pages successfully analyzed. Total cost: $${totalCost.toFixed(4)}`
  )

  return {
    results,
    totalCost,
    totalInputTokens,
    totalOutputTokens,
  }
}

