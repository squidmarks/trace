# 04 - Indexing Pipeline

This document describes the complete indexing pipeline executed by the Indexer service.

## Overview

Indexing is a **multi-phase batch process** that converts PDFs into searchable page-level units.

**Phases**:
1. **fetch** - Validate PDFs and read metadata
2. **render** - Convert PDF pages to JPEG images
3. **analyze** - Extract structured metadata using AI
4. **embed** - Generate embedding vectors for search
5. **ontology** - Synthesize workspace-level schema
6. **finalize** - Mark index complete

## Trigger

Owner triggers indexing via:

```typescript
// POST /api/workspaces/:id/index
{
  // Optional: override defaults
  params?: {
    analysisModel?: string,      // default: "gpt-4o"
    embeddingModel?: string,     // default: "text-embedding-3-small"
    renderDpi?: number,          // default: 150
    renderQuality?: number       // default: 85
  }
}
```

**Web app process**:

1. Verify requestor is owner
2. Get workspace documents with `status: "ready"`
3. Check if indexing already in progress:

```typescript
if (workspace.indexStatus === "processing" || workspace.indexStatus === "queued") {
  return res.status(409).json({ error: "Indexing already in progress" })
}
```

4. **Delete existing index** (if re-indexing):

```typescript
// Delete all existing pages
await db.collection("pages").deleteMany({ workspaceId: new ObjectId(workspaceId) })

// Delete existing ontology
await db.collection("ontologies").deleteMany({ workspaceId: new ObjectId(workspaceId) })
```

5. Update workspace status:

```typescript
await db.collection("workspaces").updateOne(
  { _id: new ObjectId(workspaceId) },
  {
    $set: {
      indexStatus: "queued",
      indexProgress: {
        phase: "fetch",
        docsDone: 0,
        docsTotal: docIds.length,
        pagesDone: 0,
        pagesTotal: 0,
        updatedAt: new Date()
      }
    }
  }
)
```

6. Call Indexer to start job:

```typescript
await fetch(`${process.env.INDEXER_BASE_URL}/jobs/start`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.INDEXER_SERVICE_TOKEN}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    workspaceId,
    params: {
      analysisModel: params?.analysisModel || "gpt-4o",
      embeddingModel: params?.embeddingModel || "text-embedding-3-small",
      renderDpi: params?.renderDpi || 150,
      renderQuality: params?.renderQuality || 85
    }
  })
})
```

7. Return 202 Accepted

## Indexer Job Execution

### Job Consumer

**v1 implementation** (simple polling):

```typescript
// indexer/src/worker.ts
import { MongoClient, ObjectId } from "mongodb"
import { io } from "./server"  // Socket.io instance

const client = new MongoClient(process.env.MONGODB_URI!)
const db = client.db()

async function pollForJobs() {
  while (true) {
    // Find next queued workspace
    const workspace = await db.collection("workspaces").findOneAndUpdate(
      { indexStatus: "queued" },
      { $set: { indexStatus: "processing" } },
      { sort: { "indexProgress.updatedAt": 1 }, returnDocument: "after" }
    )
    
    if (workspace.value) {
      try {
        await executeIndexJob(workspace.value)
      } catch (err) {
        console.error("Job failed:", err)
        await markJobFailed(workspace.value._id, err.message)
      }
    } else {
      // No jobs, wait before polling again
      await sleep(5000)
    }
  }
}

pollForJobs()
```

**v1.1+ recommendation**: Use BullMQ + Redis for better reliability, concurrency control, and retry logic.

### Phase 1: Fetch

**Goal**: Validate all PDFs are accessible and readable.

```typescript
async function phaseFetch(workspace: Workspace) {
  const workspaceId = workspace._id
  
  await updatePhase(workspaceId, "fetch")
  
  // Emit Socket.io event
  io.to(`workspace:${workspaceId}`).emit("index:started", {})
  
  const docs = await db.collection("documents").find({
    workspaceId,
    status: "ready"
  }).toArray()
  
  let totalPages = 0
  
  for (const doc of docs) {
    try {
      // Decode base64 PDF
      const pdfBuffer = Buffer.from(doc.pdfData, "base64")
      
      // Load PDF with pdf-lib to get page count
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const pageCount = pdfDoc.getPageCount()
      
      // Update document with page count
      await db.collection("documents").updateOne(
        { _id: doc._id },
        { $set: { pageCount, updatedAt: new Date() } }
      )
      
      totalPages += pageCount
      
    } catch (err) {
      console.error(`Failed to read document ${doc._id}:`, err)
      // Continue with other documents
    }
  }
  
  // Update workspace with totals
  await db.collection("workspaces").updateOne(
    { _id: workspaceId },
    {
      $set: {
        "indexProgress.docsTotal": docs.length,
        "indexProgress.pagesTotal": totalPages,
        "indexProgress.updatedAt": new Date()
      }
    }
  )
}
```

### Phase 2: Render

**Goal**: Convert each PDF page to a JPEG image optimized for AI.

```typescript
import { PDFDocument } from "pdf-lib"
import { createCanvas } from "canvas"
import crypto from "crypto"

async function phaseRender(workspace: Workspace) {
  const workspaceId = workspace._id
  
  await updatePhase(workspaceId, "render")
  
  const docs = await db.collection("documents").find({
    workspaceId,
    status: "ready"
  }).toArray()
  
  const params = workspace.indexProgress?.params || {
    renderDpi: 150,
    renderQuality: 85
  }
  
  for (const doc of docs) {
    try {
      const pdfBuffer = Buffer.from(doc.pdfData, "base64")
      
      // Use pdfjs-dist for rendering
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.js")
      const loadingTask = pdfjs.getDocument({ data: pdfBuffer })
      const pdfDoc = await loadingTask.promise
      
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum)
        
        // Calculate dimensions at target DPI
        const viewport = page.getViewport({ scale: params.renderDpi / 72 })
        
        // Create canvas
        const canvas = createCanvas(viewport.width, viewport.height)
        const ctx = canvas.getContext("2d")
        
        // Render PDF page to canvas
        await page.render({
          canvasContext: ctx,
          viewport
        }).promise
        
        // Convert to JPEG base64
        const imageData = canvas.toDataURL("image/jpeg", params.renderQuality / 100)
        const imageBase64 = imageData.replace(/^data:image\/jpeg;base64,/, "")
        
        // Calculate hash
        const imageHash = crypto.createHash("sha256").update(imageBase64).digest("hex")
        
        // Create Page document (analysis and embedding populated in later phases)
        await db.collection("pages").insertOne({
          workspaceId,
          documentId: doc._id,
          pageNumber: pageNum,
          imageData: imageBase64,
          imageHash,
          analysis: null,
          embedding: null,
          embeddingText: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        
        // Update progress
        await incrementProgress(workspaceId, "pagesDone")
        
        // Emit Socket.io progress (throttled)
        if (shouldEmitProgress(pageNum)) {
          await emitProgress(workspaceId)
        }
      }
      
      await incrementProgress(workspaceId, "docsDone")
      
    } catch (err) {
      console.error(`Failed to render document ${doc._id}:`, err)
    }
  }
}
```

### Phase 3: Analyze

**Goal**: Extract structured metadata from each page image using multimodal AI.

**AI Model**: `gpt-4o`

**Prompt**:

```typescript
const ANALYSIS_PROMPT = `You are analyzing a page from a technical document.

Extract the following information in JSON format:

{
  "summary": "2-4 sentence description of this page's content",
  "topics": ["array", "of", "subject", "tags"],
  "anchors": [
    {
      "id": "anchor_1",
      "label": "descriptive label",
      "type": "diagram_region | table | callout | annotation | etc",
      "bbox": { "x": 0.1, "y": 0.2, "w": 0.5, "h": 0.6 },
      "confidence": 0.95
    }
  ],
  "entities": [
    {
      "type": "auto-discovered type (e.g., transformer, reference_designator, voltage, etc.)",
      "value": "extracted text value",
      "canonicalValue": "normalized form if applicable",
      "bbox": { "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.05 },
      "confidence": 0.9
    }
  ],
  "relations": [
    {
      "type": "relationship type (e.g., connected_to, references, continues_to, etc.)",
      "source": { "kind": "entity", "value": "..." },
      "target": { "kind": "anchor", "id": "anchor_2" },
      "confidence": 0.85,
      "note": "optional clarification"
    }
  ],
  "confidence": 0.9
}

Guidelines:
- Bounding boxes are normalized (0.0 to 1.0) with origin at top-left
- Entity types should be specific and meaningful (not just "text" or "number")
- Relations should capture meaningful connections, not every possible link
- Summary should be detailed enough to support search
- Topics should be relevant for categorization
- Confidence scores should reflect actual certainty

Respond with ONLY the JSON object, no additional text.`
```

**Implementation**:

```typescript
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function phaseAnalyze(workspace: Workspace) {
  const workspaceId = workspace._id
  
  await updatePhase(workspaceId, "analyze")
  
  const pages = await db.collection("pages").find({
    workspaceId,
    analysis: null
  }).toArray()
  
  const params = workspace.indexProgress?.params || {
    analysisModel: "gpt-4o"
  }
  
  // Process with controlled concurrency
  const concurrency = 5
  for (let i = 0; i < pages.length; i += concurrency) {
    const batch = pages.slice(i, i + concurrency)
    
    await Promise.all(batch.map(async (page) => {
      try {
        const response = await openai.chat.completions.create({
          model: params.analysisModel,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: ANALYSIS_PROMPT },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${page.imageData}`,
                    detail: "high"
                  }
                }
              ]
            }
          ],
          max_tokens: 4096,
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
        
        const analysisText = response.choices[0].message.content
        const analysis = JSON.parse(analysisText)
        
        // Add metadata
        analysis.modelVersion = params.analysisModel
        analysis.promptVersion = "v1.0"
        analysis.analyzedAt = new Date()
        
        // Update page
        await db.collection("pages").updateOne(
          { _id: page._id },
          {
            $set: {
              analysis,
              updatedAt: new Date()
            }
          }
        )
        
        await incrementProgress(workspaceId, "pagesDone")
        
      } catch (err) {
        console.error(`Failed to analyze page ${page._id}:`, err)
      }
    }))
    
    // Emit progress
    await emitProgress(workspaceId)
  }
}
```

### Phase 4: Embed

**Goal**: Generate embedding vectors for semantic search.

**Model**: `text-embedding-3-small` (1536 dimensions)

**Embedding Text Synthesis**:

```typescript
function buildEmbeddingText(page: Page): string {
  const parts: string[] = []
  
  // Summary (most important)
  if (page.analysis.summary) {
    parts.push(page.analysis.summary)
  }
  
  // Topics
  if (page.analysis.topics?.length) {
    parts.push(`Topics: ${page.analysis.topics.join(", ")}`)
  }
  
  // Entities (up to 50 to avoid token limits)
  const entityTexts = page.analysis.entities
    ?.slice(0, 50)
    .map(e => `${e.type}: ${e.value}`)
  if (entityTexts?.length) {
    parts.push(`Entities: ${entityTexts.join("; ")}`)
  }
  
  return parts.join("\n\n")
}
```

**Implementation**:

```typescript
async function phaseEmbed(workspace: Workspace) {
  const workspaceId = workspace._id
  
  await updatePhase(workspaceId, "embed")
  
  const pages = await db.collection("pages").find({
    workspaceId,
    embedding: null
  }).toArray()
  
  const params = workspace.indexProgress?.params || {
    embeddingModel: "text-embedding-3-small"
  }
  
  // OpenAI embeddings API supports batching (up to 2048 inputs)
  const batchSize = 100
  for (let i = 0; i < pages.length; i += batchSize) {
    const batch = pages.slice(i, i + batchSize)
    
    try {
      const embeddingTexts = batch.map(p => buildEmbeddingText(p))
      
      const response = await openai.embeddings.create({
        model: params.embeddingModel,
        input: embeddingTexts
      })
      
      // Update pages with embeddings
      await Promise.all(batch.map(async (page, idx) => {
        const embedding = response.data[idx].embedding
        
        await db.collection("pages").updateOne(
          { _id: page._id },
          {
            $set: {
              embedding,
              embeddingText: embeddingTexts[idx],
              updatedAt: new Date()
            }
          }
        )
      }))
      
      await incrementProgress(workspaceId, "pagesDone", batch.length)
      await emitProgress(workspaceId)
      
    } catch (err) {
      console.error("Embedding batch failed:", err)
    }
  }
}
```

### Phase 5: Ontology

**Goal**: Synthesize workspace-level schema of entity types, relation types, and aliases.

**Process**:

1. Sample 50-100 page analyses (diverse selection across documents)
2. Extract all unique entity types and relation types
3. Use GPT-4o to generate descriptions and detect aliases
4. Store in `Ontology` collection

```typescript
async function phaseOntology(workspace: Workspace) {
  const workspaceId = workspace._id
  
  await updatePhase(workspaceId, "ontology")
  
  // Sample pages
  const pages = await db.collection("pages").aggregate([
    { $match: { workspaceId } },
    { $sample: { size: 100 } }
  ]).toArray()
  
  // Extract unique entity types
  const entityTypeCounts = new Map<string, { count: number; examples: string[] }>()
  const relationTypeCounts = new Map<string, number>()
  
  for (const page of pages) {
    for (const entity of page.analysis.entities || []) {
      if (!entityTypeCounts.has(entity.type)) {
        entityTypeCounts.set(entity.type, { count: 0, examples: [] })
      }
      const entry = entityTypeCounts.get(entity.type)!
      entry.count++
      if (entry.examples.length < 5) {
        entry.examples.push(entity.value)
      }
    }
    
    for (const relation of page.analysis.relations || []) {
      relationTypeCounts.set(
        relation.type,
        (relationTypeCounts.get(relation.type) || 0) + 1
      )
    }
  }
  
  const params = workspace.indexProgress?.params || {
    analysisModel: "gpt-4o"
  }
  
  // Use AI to generate descriptions and aliases
  const ontologyPrompt = `Given these entity types and examples found in a technical document set, generate:
1. A brief description for each entity type
2. Canonical aliases (e.g., "Xfmr" -> "Transformer")

Entity types:
${Array.from(entityTypeCounts.entries()).map(([type, data]) => 
  `- ${type} (count: ${data.count}, examples: ${data.examples.join(", ")})`
).join("\n")}

Relation types:
${Array.from(relationTypeCounts.entries()).map(([type, count]) => 
  `- ${type} (count: ${count})`
).join("\n")}

Respond with JSON:
{
  "entityTypes": [
    { "name": "...", "description": "...", "examples": [...], "count": N }
  ],
  "relationTypes": [
    { "name": "...", "description": "...", "count": N }
  ],
  "aliases": [
    { "from": "...", "to": "..." }
  ]
}`
  
  const response = await openai.chat.completions.create({
    model: params.analysisModel,
    messages: [{ role: "user", content: ontologyPrompt }],
    response_format: { type: "json_object" }
  })
  
  const ontology = JSON.parse(response.choices[0].message.content)
  
  // Store ontology
  await db.collection("ontologies").insertOne({
    workspaceId,
    ...ontology,
    createdAt: new Date(),
    updatedAt: new Date()
  })
}
```

### Phase 6: Finalize

**Goal**: Mark index complete.

```typescript
async function phaseFinalize(workspace: Workspace) {
  const workspaceId = workspace._id
  
  await updatePhase(workspaceId, "finalize")
  
  // Count total pages
  const pageCount = await db.collection("pages").countDocuments({ workspaceId })
  
  // Update Workspace
  await db.collection("workspaces").updateOne(
    { _id: workspaceId },
    {
      $set: {
        indexStatus: "ready",
        "indexProgress.phase": "finalize",
        "indexProgress.updatedAt": new Date()
      }
    }
  )
  
  // Emit completion event
  io.to(`workspace:${workspaceId}`).emit("index:ready", {
    pageCount
  })
}
```

## Progress Tracking

### Progress Updates

Indexer updates MongoDB progress throughout execution:

```typescript
async function updatePhase(workspaceId: ObjectId, phase: string) {
  await db.collection("workspaces").updateOne(
    { _id: workspaceId },
    {
      $set: {
        "indexProgress.phase": phase,
        "indexProgress.updatedAt": new Date()
      }
    }
  )
}

async function incrementProgress(workspaceId: ObjectId, field: string, amount: number = 1) {
  await db.collection("workspaces").updateOne(
    { _id: workspaceId },
    {
      $inc: { [`indexProgress.${field}`]: amount },
      $set: { "indexProgress.updatedAt": new Date() }
    }
  )
}
```

### Socket.io Progress Events

Indexer emits progress via Socket.io:

```typescript
import { io } from "./server"

async function emitProgress(workspaceId: ObjectId) {
  const workspace = await db.collection("workspaces").findOne({ _id: workspaceId })
  
  if (workspace?.indexProgress) {
    io.to(`workspace:${workspaceId}`).emit("index:progress", {
      phase: workspace.indexProgress.phase,
      docsDone: workspace.indexProgress.docsDone,
      docsTotal: workspace.indexProgress.docsTotal,
      pagesDone: workspace.indexProgress.pagesDone,
      pagesTotal: workspace.indexProgress.pagesTotal
    })
  }
}

// Throttle: emit every 10 pages or every 5 seconds
let lastEmit = Date.now()
let pagesSinceEmit = 0

function shouldEmitProgress(currentPage: number): boolean {
  pagesSinceEmit++
  const now = Date.now()
  
  if (pagesSinceEmit >= 10 || now - lastEmit >= 5000) {
    lastEmit = now
    pagesSinceEmit = 0
    return true
  }
  
  return false
}
```

See: [05-realtime.md](05-realtime.md) for Socket.io implementation details.

## Error Handling

### Error Types

| Scope | Description | Handling |
|-------|-------------|----------|
| `doc` | Document-level failure (PDF corrupt, unreadable) | Log error, continue to next document |
| `page` | Page-level failure (analysis failed, rendering failed) | Log error, continue to next page |
| `system` | System-level failure (OpenAI quota, DB connection) | Mark job as failed |

### Failure Handling

```typescript
async function markJobFailed(workspaceId: ObjectId, error: string) {
  await db.collection("workspaces").updateOne(
    { _id: workspaceId },
    {
      $set: {
        indexStatus: "failed",
        "indexProgress.error": error,
        "indexProgress.updatedAt": new Date()
      }
    }
  )
  
  // Emit failure event
  io.to(`workspace:${workspaceId}`).emit("index:failed", {
    error,
    phase: (await db.collection("workspaces").findOne({ _id: workspaceId }))?.indexProgress?.phase
  })
}
```

**Failure Conditions**:
- System-level error (OpenAI quota exhausted, DB connection lost)
- >50% of pages fail to analyze
- All documents fail to render

Partial success is marked as `ready` with errors logged in console (can add error tracking in v1.1).

## Idempotency

Re-indexing is safe because we delete all existing pages/ontology before starting:

```typescript
// Web API: POST /api/workspaces/:id/index
await db.collection("pages").deleteMany({ workspaceId: new ObjectId(workspaceId) })
await db.collection("ontologies").deleteMany({ workspaceId: new ObjectId(workspaceId) })
```

This ensures a clean slate for each indexing run.

## Navigation

- **Previous**: [03-auth-permissions.md](03-auth-permissions.md)
- **Next**: [05-realtime.md](05-realtime.md)
- **Related**: [01-data-models.md](01-data-models.md) - Workspace schema
