"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { FileText, Search, Settings, Save, RotateCcw } from "lucide-react"
import WorkspaceLayout from "@/components/WorkspaceLayout"
import type { Workspace, WorkspaceConfig, Role } from "@trace/shared"

// Default prompts - FULL versions from actual implementations
const DEFAULT_ANALYSIS_PROMPT = `You are analyzing technical wiring diagrams. Your job is to extract EVERY component, connection, and piece of information visible on the page. Missing information can lead to system failures.

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

const DEFAULT_SYSTEM_PROMPT = `You are Trace, an AI assistant specialized in following information paths across interconnected technical documents. Your name reflects your core purpose: to TRACE relationships between pages and documents to build complete, comprehensive answers.

## 🚨 ABSOLUTE RULE: ALWAYS SEARCH DOCUMENTS FIRST 🚨

**YOU MUST SEARCH THE DOCUMENTS FOR EVERY QUESTION. NO EXCEPTIONS.**

- ❌ NEVER answer from your general knowledge
- ❌ NEVER assume you know the answer without checking the documents
- ❌ NEVER provide generic advice when specific documentation exists
- ✅ ALWAYS use searchPages for EVERY user question
- ✅ ALWAYS base your answer on the retrieved documents
- ✅ If no relevant documents are found, say so explicitly

**This is a technical documentation system. Users have uploaded their specific manuals, schematics, and guides. Your job is to help them find and understand THEIR documents, not to provide general information.**

If a user asks "How do I check propane levels?" → You MUST search for "propane level", "propane gauge", "propane sensor" BEFORE answering.

If a user asks "What does button X do?" → You MUST search for "button X" BEFORE answering.

**The only acceptable response without searching is if the user explicitly asks you NOT to search (which they won't).**

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
- Use getPage to reveal connections and linking metadata between them
- Search for intermediate components found in connections
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
5. Follow connections and linking metadata discovered in each search

## Core Philosophy: Documents Are Connected Graphs

Think of the document workspace as a network where:
- **Pages** are nodes containing information
- **Entities** are shared concepts that appear across multiple pages
- **Connections** link diagrams across pages via labeled connections (wires, hydraulic lines, mechanical linkages)
- **Reference Markers** explicitly point to other pages/sections
- **Connector Pins** show detailed pin-level wiring information

Your job is to traverse this graph, following every relevant path until you've gathered all connected information.

## Available Tools

1. **searchPages(query, limit)**: Entry point for finding initial nodes
   - Returns: pageId, documentName, pageNumber, summary, topics, entities, relevanceScore
   - Does NOT include: linking metadata (you need getPage for these)

2. **getPage(pageId)**: Reveals connections from a specific node
   - Returns: Everything above PLUS confidence and **linking metadata** (connections, referenceMarkers, connectorPins)
   - **This is your path-following tool** - critical for all types of diagrams
   - Use this to discover connections between pages

### **NEW: Enhanced Linking Metadata for Diagrams**

When analyzing diagrams (wiring, hydraulic, mechanical, etc.), getPage may return additional linking metadata:

**connections**: Labeled connections at diagram edges that link to other pages
- Example: {label: "LP", direction: "incoming", connectedComponent: "Aux Start Solenoid", specification: "L-SSF 16 Y"}
- Example: {label: "H1", direction: "outgoing", connectedComponent: "Hydraulic Pump", specification: "3/8 pressure line"}
- **Action**: Search for other pages with the same connection label (especially opposite direction) to trace the path

**referenceMarkers**: Cross-reference symbols (△, ○, etc.) pointing to other pages/sections  
- Example: {value: "2", markerType: "triangle", description: "GROUND", referencedPage: 15}
- **Action**: If referencedPage is given, getPage that page. Otherwise search for the description.

**connectorPins**: Detailed pin/terminal assignments with specifications
- Example: {connectorName: "J-EE", pinNumber: "1", wireSpec: "L-SSF 16 Y", signalName: "SSC"}
- **Action**: Search for the specification to find where this connection continues

**CRITICAL for System Tracing**: These fields tell you EXACTLY which other pages to examine. If you see:
- Connection "LP" incoming → Search for "LP" outgoing to find its source
- Reference △2 → Follow to find the referenced diagram
- Specification "L-SSF 16 Y" or "3/8 hydraulic" → Search to trace this specific connection path

## Response Format

### CRITICAL - Inline Citation Format

**YOU MUST cite the source page for EVERY factual claim using inline markdown links.**

Format: [Page NUMBER](#page-NUMBER)

Examples:
- "The aux start solenoid connects to the battery disconnect switch [Page 44](#page-44)."
- "The load shedder shuts down the water heater [Page 51](#page-51) and AC control [Page 51](#page-51)."
- "Wire L-SSF 16 Y connects from the chassis connector [Page 22](#page-22) to the dash pod [Page 15](#page-15)."

**Every artifact, component, specification, or factual statement MUST have an inline citation.**

### Creating Diagrams

When helpful, create Mermaid diagrams to visualize relationships. Use this exact syntax:

\`\`\`mermaid
graph TD
  A[Component A] -->|Label| B[Component B]
  B --> C[Component C]
\`\`\`

Return ONLY valid JSON, no markdown formatting.`

export default function SettingsPage() {
  const params = useParams()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Form state - Initialize with defaults (will be replaced by workspace config if it exists)
  const [config, setConfig] = useState<WorkspaceConfig>({
    indexing: {
      renderDpi: 150,
      renderQuality: 85,
      analysisModel: "gpt-4o-mini",
      analysisTemperature: 0.1,
      analysisDetail: "auto",
      customAnalysisPrompt: DEFAULT_ANALYSIS_PROMPT
    },
    search: {
      maxResults: 5,
      minConfidence: 0.5
    },
    chat: {
      model: "gpt-5.2-chat-latest",
      maxTokens: 4000,
      customSystemPrompt: DEFAULT_SYSTEM_PROMPT
    }
  })

  useEffect(() => {
    fetchWorkspace()
  }, [params.id])

  const fetchWorkspace = async () => {
    try {
      const response = await fetch(`/api/workspaces/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setWorkspace(data.workspace)
        setRole(data.role)
        
        // Load existing config or use defaults
        if (data.workspace.config) {
          setConfig({
            indexing: {
              renderDpi: data.workspace.config.indexing?.renderDpi || 150,
              renderQuality: data.workspace.config.indexing?.renderQuality || 85,
              analysisModel: data.workspace.config.indexing?.analysisModel || "gpt-4o-mini",
              analysisTemperature: data.workspace.config.indexing?.analysisTemperature ?? 0.1,
              analysisDetail: data.workspace.config.indexing?.analysisDetail || "auto",
              customAnalysisPrompt: data.workspace.config.indexing?.customAnalysisPrompt ?? DEFAULT_ANALYSIS_PROMPT
            },
            search: {
              maxResults: data.workspace.config.search?.maxResults || 5,
              minConfidence: data.workspace.config.search?.minConfidence || 0.5
            },
            chat: {
              model: data.workspace.config.chat?.model || "gpt-5.2-chat-latest",
              maxTokens: data.workspace.config.chat?.maxTokens || 4000,
              customSystemPrompt: data.workspace.config.chat?.customSystemPrompt ?? DEFAULT_SYSTEM_PROMPT
            }
          })
        }
      }
    } catch (error) {
      console.error("Error fetching workspace:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      const response = await fetch(`/api/workspaces/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config })
      })

      if (response.ok) {
        setSaveMessage({ type: "success", text: "Settings saved successfully!" })
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        const error = await response.json()
        setSaveMessage({ type: "error", text: error.error || "Failed to save settings" })
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      setSaveMessage({ type: "error", text: "Failed to save settings" })
    } finally {
      setIsSaving(false)
    }
  }

  const resetAnalysisPrompt = () => {
    setConfig(prev => ({
      ...prev,
      indexing: { ...prev.indexing, customAnalysisPrompt: DEFAULT_ANALYSIS_PROMPT }
    }))
  }

  const resetSystemPrompt = () => {
    setConfig(prev => ({
      ...prev,
      chat: { ...prev.chat, customSystemPrompt: DEFAULT_SYSTEM_PROMPT }
    }))
  }

  if (isLoading) {
    return (
      <WorkspaceLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-500">Loading...</div>
        </div>
      </WorkspaceLayout>
    )
  }

  if (!workspace) {
    return (
      <WorkspaceLayout>
        <div className="text-center py-12">
          <p className="text-gray-600">Workspace not found</p>
        </div>
      </WorkspaceLayout>
    )
  }

  const isOwner = role === "owner"

  return (
    <WorkspaceLayout>
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Tab Navigation */}
          <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <Link
                href={`/workspaces/${params.id}/documents`}
                className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400"
              >
                <div className="flex items-center gap-2">
                  <FileText size={18} />
                  Documents
                </div>
              </Link>
              <Link
                href={`/workspaces/${params.id}/search`}
                className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400"
              >
                <div className="flex items-center gap-2">
                  <Search size={18} />
                  Search
                </div>
              </Link>
              <Link
                href={`/workspaces/${params.id}/settings`}
                className="border-b-2 border-blue-500 py-4 px-1 text-sm font-medium text-blue-600 dark:text-blue-400"
              >
                <div className="flex items-center gap-2">
                  <Settings size={18} />
                  Settings
                </div>
              </Link>
            </nav>
          </div>

          {!isOwner && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                Only workspace owners can modify settings
              </p>
            </div>
          )}

          {saveMessage && (
            <div className={`mb-6 p-4 rounded-lg ${
              saveMessage.type === "success" 
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-800"
            }`}>
              {saveMessage.text}
            </div>
          )}

          {/* Indexing Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-6">Indexing Settings</h2>

            {/* Rendering Settings */}
            <div className="mb-8">
              <h3 className="text-lg font-medium mb-4">PDF Rendering</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    DPI (Resolution)
                  </label>
                  <select
                    value={config.indexing?.renderDpi}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      indexing: { ...prev.indexing, renderDpi: parseInt(e.target.value) as any }
                    }))}
                    disabled={!isOwner}
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value={100}>100 DPI (Low - Fast)</option>
                    <option value={150}>150 DPI (Standard)</option>
                    <option value={200}>200 DPI (High)</option>
                    <option value={300}>300 DPI (Very High - Detailed)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Higher DPI = better detail but larger files and slower processing
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Quality: {config.indexing?.renderQuality}%
                  </label>
                  <input
                    type="range"
                    min="75"
                    max="95"
                    step="5"
                    value={config.indexing?.renderQuality}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      indexing: { ...prev.indexing, renderQuality: parseInt(e.target.value) as any }
                    }))}
                    disabled={!isOwner}
                    className="w-full disabled:opacity-50"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>75% (Smaller)</span>
                    <span>95% (Best)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Analysis Settings */}
            <div className="mb-8">
              <h3 className="text-lg font-medium mb-4">AI Analysis</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Model</label>
                  <select
                    value={config.indexing?.analysisModel}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      indexing: { ...prev.indexing, analysisModel: e.target.value }
                    }))}
                    disabled={!isOwner}
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="gpt-4o-mini">gpt-4o-mini (Cheaper)</option>
                    <option value="gpt-4o">gpt-4o (Better)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Temperature: {config.indexing?.analysisTemperature?.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={config.indexing?.analysisTemperature}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      indexing: { ...prev.indexing, analysisTemperature: parseFloat(e.target.value) }
                    }))}
                    disabled={!isOwner}
                    className="w-full disabled:opacity-50"
                  />
                  <p className="text-xs text-gray-500 mt-1">Lower = more consistent</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Detail Level</label>
                  <select
                    value={config.indexing?.analysisDetail}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      indexing: { ...prev.indexing, analysisDetail: e.target.value as any }
                    }))}
                    disabled={!isOwner}
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="low">Low</option>
                    <option value="auto">Auto</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              {/* Custom Analysis Prompt */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">
                    Custom Analysis Prompt
                  </label>
                  <button
                    onClick={resetAnalysisPrompt}
                    disabled={!isOwner}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                  >
                    <RotateCcw size={14} />
                    Reset to Default
                  </button>
                </div>
                <textarea
                  value={config.indexing?.customAnalysisPrompt || ""}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    indexing: { ...prev.indexing, customAnalysisPrompt: e.target.value }
                  }))}
                  disabled={!isOwner}
                  rows={12}
                  className="w-full border rounded px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {config.indexing?.customAnalysisPrompt?.length || 0} characters
                </p>
              </div>
            </div>
          </div>

          {/* Search Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-6">Search Settings</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Max Results</label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={config.search?.maxResults}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    search: { ...prev.search, maxResults: parseInt(e.target.value) }
                  }))}
                  disabled={!isOwner}
                  className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Min Confidence: {config.search?.minConfidence?.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.search?.minConfidence}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    search: { ...prev.search, minConfidence: parseFloat(e.target.value) }
                  }))}
                  disabled={!isOwner}
                  className="w-full disabled:opacity-50"
                />
                <p className="text-xs text-gray-500 mt-1">Filter out low-confidence results</p>
              </div>
            </div>
          </div>

          {/* Chat Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-6">Chat Settings</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Model</label>
                <select
                  value={config.chat?.model}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    chat: { ...prev.chat, model: e.target.value }
                  }))}
                  disabled={!isOwner}
                  className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="gpt-5.2-chat-latest">gpt-5.2-chat-latest</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Using model default temperature</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Max Tokens</label>
                <input
                  type="number"
                  min="1000"
                  max="16000"
                  step="1000"
                  value={config.chat?.maxTokens}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    chat: { ...prev.chat, maxTokens: parseInt(e.target.value) }
                  }))}
                  disabled={!isOwner}
                  className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Custom System Prompt */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">
                  Custom System Prompt
                </label>
                <button
                  onClick={resetSystemPrompt}
                  disabled={!isOwner}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                >
                  <RotateCcw size={14} />
                  Reset to Default
                </button>
              </div>
              <textarea
                value={config.chat?.customSystemPrompt || ""}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  chat: { ...prev.chat, customSystemPrompt: e.target.value }
                }))}
                disabled={!isOwner}
                rows={12}
                className="w-full border rounded px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                {config.chat?.customSystemPrompt?.length || 0} characters
              </p>
            </div>
          </div>

          {/* Save Button */}
          {isOwner && (
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-medium"
              >
                {isSaving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save size={18} />
                    Save All Settings
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  )
}

