# Enhanced Linking Metadata for Trace

## Problem
Current indexing misses critical linking information in technical diagrams, especially:
- **Wire labels** (LP, LLO, TTA) that connect to/from other pages
- **Reference markers** (△1, △2) that explicitly point to other diagrams
- **Connector pin assignments** with wire specifications
- **Wire color codes** that trace circuits across multiple pages

## Solution
Three new metadata types added to `PageAnalysis`:

### 1. WireConnection
Captures labeled wires that connect to other pages/diagrams.

```typescript
interface WireConnection {
  label: string                    // Wire label (e.g., "LP", "LLO", "TTA")
  wireSpec?: string                // Wire specification (e.g., "L-SSF 16 Y", "S-SSC 16 Y")
  direction: "incoming" | "outgoing" | "bidirectional"
  connectedComponent?: string      // Component this wire connects to on this page
  bbox?: BoundingBox
  confidence: number
}
```

**Example from Page 44:**
```json
{
  "wireConnections": [
    {
      "label": "LP",
      "direction": "incoming",
      "connectedComponent": "Aux Start Solenoid",
      "confidence": 0.95
    },
    {
      "label": "LLO",
      "direction": "incoming",
      "confidence": 0.95
    },
    {
      "label": "TTA",
      "direction": "incoming",
      "confidence": 0.95
    }
  ]
}
```

### 2. ReferenceMarker
Captures explicit cross-references to other pages/sections (triangles, circles, etc.).

```typescript
interface ReferenceMarker {
  value: string                    // The marker value (e.g., "1", "2", "A")
  markerType: "triangle" | "circle" | "square" | "other"
  description?: string             // What this marker represents
  referencedPage?: number          // If known, the page this references
  referencedSection?: string       // Section or diagram name
  bbox?: BoundingBox
  confidence: number
}
```

**Example from Page 44:**
```json
{
  "referenceMarkers": [
    {
      "value": "1",
      "markerType": "triangle",
      "description": "FPP (OMIT, HPD) A16, MILE CONTROL WIRING",
      "confidence": 0.9
    },
    {
      "value": "2",
      "markerType": "triangle",
      "description": "GROUND",
      "confidence": 0.95
    }
  ]
}
```

### 3. ConnectorPin
Captures detailed connector/terminal information with pin assignments and wire specs.

```typescript
interface ConnectorPin {
  connectorName: string            // Connector identifier (e.g., "J-EE", "J-FF")
  pinNumber?: string               // Pin number or position
  wireSpec?: string                // Wire specification (e.g., "L-SSF 16 Y")
  signalName?: string              // Signal or function name
  connectedTo?: string             // What this pin connects to
  bbox?: BoundingBox
  confidence: number
}
```

**Example from Page 44:**
```json
{
  "connectorPins": [
    {
      "connectorName": "J-EE",
      "pinNumber": "1",
      "wireSpec": "J-EE 16 Y",
      "confidence": 0.9
    },
    {
      "connectorName": "Leveling Control",
      "pinNumber": "1",
      "wireSpec": "L-SSF 16 Y",
      "signalName": "S-SSC",
      "confidence": 0.85
    }
  ]
}
```

## Benefits for Path Tracing

With this enhanced metadata, the AI can:

1. **Follow wire paths across pages**: "LP connects to Aux Start Solenoid on page 44, trace LP to find where it originates"

2. **Use reference markers**: "△2 on page 44 references GROUND, follow to find the grounding diagram"

3. **Track connector pinouts**: "Pin 1 of J-EE carries signal L-SSF 16 Y, find all pages mentioning L-SSF"

4. **Build complete circuit traces**: Chain together wire connections across multiple pages to show the full circuit path

## Implementation Steps

### 1. Update AI Analysis Prompt
Add instructions to extract:
- Wire labels at diagram edges
- Reference markers (triangles, circles, etc.) with their values
- Connector identifiers with pin numbers and wire specifications
- Wire color codes and specifications

### 2. Update Search/Retrieval
The AI agent should be instructed to:
- Use `wireConnections` to follow paths across pages
- Use `referenceMarkers` to find related diagrams
- Use `connectorPins` to trace specific signals

### 3. Update System Prompt for Chat
Add to the Trace Methodology:
```
When analyzing wiring diagrams:
1. Check for wireConnections - these are labeled wires that connect to other pages
2. Check for referenceMarkers - these explicitly tell you which other pages/sections to examine
3. Check for connectorPins - these show detailed pin assignments for tracing specific signals
4. Follow the path: if a page shows wire "LP" incoming, search other pages for "LP" outgoing
```

## Example: Tracing Aux Start Solenoid Activation

**Current behavior:**
- Finds page 44 with "Aux Start Solenoid"
- Returns information about that component
- Misses that wire "LP" connects it to other pages

**Enhanced behavior:**
1. Finds page 44 with "Aux Start Solenoid"
2. Sees `wireConnection: { label: "LP", direction: "incoming", connectedComponent: "Aux Start Solenoid" }`
3. Searches for pages with `wireConnection: { label: "LP", direction: "outgoing" }`
4. Finds the source page (e.g., page 28) where LP originates
5. Traces the complete path from source through all intermediate pages to destination

## Migration Path

1. **Phase 1**: Add new fields as optional (`?`) to `PageAnalysis`
2. **Phase 2**: Update analysis prompt to extract this information
3. **Phase 3**: Re-index existing documents to populate new fields
4. **Phase 4**: Update AI agent system prompt to use new metadata
5. **Phase 5**: Consider deprecating/removing `anchors` if redundant with entities

## Note on Anchors

The current `anchors` field appears redundant with `entities` - both capture components/parts. Consider:
- **Option A**: Remove anchors entirely, use only entities
- **Option B**: Repurpose anchors for diagram-specific identifiers
- **Option C**: Keep for backward compatibility, mark as deprecated

The new `wireConnections` and `referenceMarkers` capture the true "linking" aspects that anchors should have represented.

