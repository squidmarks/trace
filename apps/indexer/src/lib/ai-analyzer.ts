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

const ANALYSIS_PROMPT = `You are analyzing technical wiring diagrams. Your job is to extract EVERY component, connection, and piece of information visible on the page. Missing information can lead to system failures.

**SYSTEMATIC SCANNING APPROACH:**
1. Divide the page into grid sections (top-left, top-center, top-right, middle-left, etc.)
2. In EACH section, identify EVERY box, label, component, and wire
3. Don't skip anything - even if it seems minor or redundant
4. Look for: relays, switches, solenoids, breakers, fuses, connectors, inverters, chargers, batteries, motors, sensors
5. Capture component ratings (12V, 20A, 30A, etc.)
6. List ALL wire specifications (gauge, color codes)

Return a JSON object with:
1. **summary** (string): 2-3 sentence summary
2. **topics** (string[]): 8-12 topics covering ALL systems shown (lowercase, hyphenated)
3. **entities** (array): MINIMUM 20-30 entities for a typical wiring diagram
   - id: unique identifier
   - type: "relay", "switch", "solenoid", "breaker", "fuse", "connector", "inverter", "charger", "battery", "motor", "sensor", "wire", "cable", "specification"
   - label: Exact name as shown (e.g., "Battery Disconnect Relay", "Inverter Charger", "Generator Relay", "D1 Circuit Breaker")
   - value: Rating/spec (e.g., "12VDC", "30A", "J-EE connector", "16 GA RED")
   - confidence: 0.0-1.0

**CRITICAL - SCAN EVERY DIAGRAM SECTION:**

4. **connections** (array): Labeled connections that link to/from other pages (CRITICAL for tracing systems)
   - label: Connection identifier at diagram edge (e.g., "LP", "LLO", "TTA", "H1", "P-LINE", "MECH-A")
   - specification: Full specification if shown (e.g., "L-SSF 16 Y" for wires, "3/8 hydraulic" for hydraulic lines, "5mm shaft" for mechanical)
   - direction: "incoming", "outgoing", or "bidirectional"
   - connectedComponent: Which component on THIS page the connection links to (if visible)
   - confidence: 0.0-1.0

5. **referenceMarkers** (array): Cross-reference symbols pointing to other pages/sections (CRITICAL for navigation)
   - value: The marker identifier (e.g., "1", "2", "A", "B")
   - markerType: "triangle", "circle", "square", or "other"
   - description: What the marker text says (e.g., "FPP (OMIT, HPD) A16, MILE CONTROL WIRING", "GROUND")
   - referencedPage: Page number if explicitly stated
   - referencedSection: Section or diagram name if stated
   - confidence: 0.0-1.0

6. **connectorPins** (array): Detailed connector/terminal pin assignments
   - connectorName: Connector identifier (e.g., "J-EE", "J-FF", "Leveling Control")
   - pinNumber: Pin number or position if shown
   - wireSpec: Wire specification for this pin (e.g., "L-SSF 16 Y")
   - signalName: Signal or function name if labeled
   - connectedTo: What this pin connects to
   - confidence: 0.0-1.0

**COMPONENT IDENTIFICATION - SCAN METHODICALLY:**

**Common Components in Wiring Diagrams (find ALL of these):**
- **Power Components**: Batteries, inverters, chargers, generators, alternators, power supplies
- **Switching**: Relays (with IDs like K1, K2), contactors, solenoids (with names like "Aux Start Solenoid")
- **Protection**: Circuit breakers (often labeled D1, D2, etc. or CB1, CB2), fuses (with amp ratings)
- **Switches**: Toggle switches, push buttons, selector switches (labeled by function)
- **Connectors**: Labeled J-XX, P-XX, or by function (e.g., "Dash Pod Connector", "Chassis Connector")
- **Cables/Harnesses**: Any labeled wire bundles or cable assemblies
- **Other**: Resistors, diodes, LEDs, indicators, sensors, transducers

**For EACH component found, capture:**
- Exact label/name from diagram
- Component type (relay, breaker, switch, etc.)
- Any identifier (D1, K2, J-EE, CB3, etc.)
- Ratings/specs shown (12V, 30A, 20A breaker, etc.)
- Location description if needed (e.g., "in power distribution box")

**CONNECTION/WIRE IDENTIFICATION:**
- **Edge Connections**: Look at ALL four edges of each diagram section for labels (LP, LLO, TTA, H1, P-LINE, etc.)
- **Wire Specifications**: Capture EVERY wire shown with its:
  - Gauge/size (e.g., "16", "18", "14")  
  - Color code (e.g., "RED", "BLK", "Y" for yellow, "W" for white)
  - Full spec format (e.g., "L-SSF 16 Y", "18 W", "16 GA RED")
- **Wire Labels**: Common wire label formats to look for:
  - Color abbreviations: RED, BLK, BLU, YEL/Y, GRN, WHT/W, PUR, ORG, GRY
  - Gauge numbers: 10, 12, 14, 16, 18, 20, 22
  - Signal names: GND, PWR, +12V, SIGNAL, DATA
- **Connection Points**: Note what each wire/connection links TO and FROM
- **Harness Labels**: Look for bundle/harness identifiers

**CROSS-REFERENCE IDENTIFICATION:**
- Look for geometric shapes with numbers/letters: △1, △2, ○A, ○B, □1, etc.
- Note "SEE PAGE X", "TO PAGE Y", "REF DWG X" references
- Capture connector detail callouts and pin assignments
- Note any drawing/section references

**QUALITY CHECK BEFORE SUBMITTING:**
- Count your entities: Typical wiring diagram should have 20-40+ entities
- If you have < 15 entities, you missed major components - SCAN AGAIN
- Did you capture ALL boxes with labels? ALL connectors? ALL switches/relays?
- Did you get wire gauges and colors for visible wires?
- Did you identify ALL breakers, fuses, and protection devices?

**EXAMPLE - What a GOOD extraction looks like:**
For a complex diagram you should capture items like:
- "Battery Disconnect Relay" (relay)
- "Inverter Charger" (component)  
- "Generator Relay K1" (relay)
- "Circuit Breaker D1 30A" (breaker)
- "Circuit Breaker D2 20A" (breaker)
- "Fuse F1 15A" (fuse)
- "J-EE Connector" (connector)
- "Chassis Power Connector" (connector)
- "16 GA RED wire" (wire specification)
- "18 BLK wire" (wire specification)
- Plus 20-30 more components...

**CRITICAL:** Missing components means technicians can't troubleshoot. Extract EVERYTHING visible.

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
  detail: "low" | "auto" | "high" = "auto",
  customPrompt?: string
): Promise<{ analysis: any; inputTokens: number; outputTokens: number; cost: number }> {
  const model = getAnalysisModel(modelName)
  logger.debug(`   Analyzing page ${pageNumber} with ${model.name} (detail: ${detail})...`)

  const promptToUse = customPrompt || ANALYSIS_PROMPT
  if (customPrompt) {
    logger.debug(`   Using custom analysis prompt (${customPrompt.length} characters)`)
  }

  try {
    const response = await openai.chat.completions.create({
      model: modelName || process.env.ANALYSIS_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: promptToUse,
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
      max_tokens: 6000, // Increased for exhaustive component extraction (20-40+ entities)
      temperature: 0.05, // Very low temperature for maximum consistency and thoroughness
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
      confidence: 0.85, // Overall confidence score
      modelVersion: "gpt-4o",
      promptVersion: "v3.0", // Major update: systematic scanning, quality checks, 20-40+ entity target
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
 * @param customPrompt - Custom analysis prompt (optional)
 * @returns Array of analyses with cost tracking
 */
export async function analyzePages(
  pages: Array<{ pageNumber: number; imageData: string }>,
  filename: string,
  modelName: string,
  onProgress?: (current: number, total: number, cost: number) => void,
  customPrompt?: string
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
      batch.map((page) => analyzePage(page.imageData, page.pageNumber, filename, modelName, "auto", customPrompt))
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

