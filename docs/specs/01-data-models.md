# 01 - Data Models

All data is stored in **MongoDB**. This document defines the complete schema for each collection.

## Collections Overview

| Collection | Purpose |
|------------|---------|
| `users` | User accounts (from Google OAuth) |
| `workspaces` | Workspace containers with ownership and status |
| `documents` | PDF files in a workspace |
| `pages` | Individual page images + analyses + embeddings |
| `ontologies` | Per-workspace entity/relation schemas |
| `chatSessions` | Workspace-scoped conversation history |

## User

Represents an authenticated user account.

```typescript
{
  _id: ObjectId
  googleId: string              // Google OAuth subject ID
  email: string                 // Primary email from Google
  name: string                  // Display name from Google
  avatar?: string               // Google profile picture URL
  createdAt: Date
  updatedAt: Date
}
```

**Indexes**:
- `googleId` (unique)
- `email` (unique)

## Workspace

Container for documents, pages, and index. Unit of permissioning.

```typescript
{
  _id: ObjectId
  ownerId: ObjectId             // User._id who created workspace
  name: string                  // Display name
  description?: string          // Optional description
  
  // Sharing
  members: [
    {
      userId: ObjectId          // User._id
      role: "viewer"            // Only "viewer" in v1; owner not in array
      addedAt: Date
      addedBy: ObjectId         // User._id who granted access
    }
  ]
  
  // Index status
  indexStatus: "idle" | "queued" | "processing" | "ready" | "failed"
  
  // Progress tracking (updates during indexing)
  indexProgress?: {
    phase: "fetch" | "render" | "analyze" | "embed" | "ontology" | "finalize"
    docsDone: number
    docsTotal: number
    pagesDone: number
    pagesTotal: number
    updatedAt: Date
  }
  
  createdAt: Date
  updatedAt: Date
}
```

**Indexes**:
- `ownerId`
- `members.userId`
- `indexStatus`

**Access rules**:
- Owner: Full control (CRUD, indexing, sharing, delete)
- Viewer: Read-only (view pages, search, chat)

**Note**: No `activeIndexVersion` field—only one index per workspace.

## Document

A single PDF file in a workspace.

```typescript
{
  _id: ObjectId
  workspaceId: ObjectId         // Parent workspace
  uploadedBy: ObjectId          // User._id who added document
  
  filename: string              // Display name (e.g., "schematic-2.pdf")
  
  sourceType: "upload" | "url"
  sourceUrl?: string            // If sourceType === "url"
  
  // Storage
  pdfData: string               // Base64-encoded PDF file
  pdfHash: string               // SHA-256 hash for deduplication/integrity
  
  // Processing status
  pageCount?: number            // Populated after PDF is read
  status: "queued" | "processing" | "ready" | "failed"
  error?: string                // Error message if status === "failed"
  
  createdAt: Date
  updatedAt: Date
}
```

**Indexes**:
- `workspaceId`
- `status`
- `pdfHash` (for deduplication checks)

**Notes**:
- PDFs are stored as base64 in `pdfData` (same rationale as page images)
- `pdfHash` allows detecting duplicate uploads
- Status tracks document-level processing (separate from page-level)

## Page

A single page from a document. Atomic unit of retrieval.

```typescript
{
  _id: ObjectId
  workspaceId: ObjectId         // Parent workspace
  documentId: ObjectId          // Parent document
  pageNumber: number            // 1-based page number within document
  
  // Image storage
  imageData: string             // Base64-encoded JPEG (150-200 DPI, quality 85-90)
  imageHash: string             // SHA-256 of image for integrity
  
  // AI-generated analysis
  analysis: PageAnalysis        // See PageAnalysis schema below
  
  // Embedding for semantic search
  embedding: number[]           // 1536-dimensional vector (text-embedding-3-small)
  embeddingText: string         // Text used to generate embedding (for debugging)
  
  createdAt: Date
  updatedAt: Date
}
```

**Indexes**:
- `workspaceId, documentId, pageNumber` (compound, unique)
- `workspaceId` (for workspace-wide queries)
- `imageHash`

**Notes**:
- `imageData` is AI-optimized: same image used for analysis and display
- `embedding` uses OpenAI's `text-embedding-3-small` (1536 dimensions)
- `embeddingText` is synthesized from `analysis.summary + topics + entities`
- **No `indexVersion` field**: Pages are unique per workspace, not versioned

## PageAnalysis

AI-generated metadata embedded within Page documents.

```typescript
{
  // High-level content
  summary: string               // 2-4 sentence natural language description
  topics: string[]              // Subject matter tags (e.g., ["electrical", "transformer", "protection"])
  
  // Structured extractions
  anchors: Anchor[]             // Regions of interest on the page
  entities: Entity[]            // Named things extracted from page
  relations: Relation[]         // Connections between entities/anchors/pages
  
  // Metadata
  confidence: number            // 0.0-1.0 overall confidence score
  modelVersion: string          // e.g., "gpt-4o-2024-11-20"
  promptVersion: string         // e.g., "v1.2" for tracking prompt changes
  analyzedAt: Date
}
```

### Anchor

A region of interest on the page (diagram section, table, callout, etc.).

```typescript
{
  id: string                    // Unique within page (e.g., "anchor_1")
  label?: string                // Human-readable label (e.g., "Main Diagram")
  type: string                  // AI-discovered type (e.g., "diagram_region", "table", "callout")
  
  bbox?: {                      // Bounding box (normalized 0.0-1.0 coordinates)
    x: number                   // Left edge
    y: number                   // Top edge
    w: number                   // Width
    h: number                   // Height
  }
  
  confidence: number            // 0.0-1.0 confidence for this anchor
}
```

### Entity

A named thing extracted from the page (component, location, ID, measurement, etc.).

```typescript
{
  type: string                  // AI-discovered type (e.g., "transformer", "reference_designator", "voltage")
  value: string                 // Extracted text (e.g., "T-101", "13.8 kV")
  canonicalValue?: string       // Normalized form (e.g., "13800 V")
  
  bbox?: {                      // Optional bounding box if localized
    x: number
    y: number
    w: number
    h: number
  }
  
  confidence: number            // 0.0-1.0 confidence for this entity
}
```

### Relation

A connection between entities, anchors, or pages.

```typescript
{
  type: string                  // AI-discovered relation type (e.g., "references", "connected_to", "continues_to")
  
  source: {
    kind: "anchor" | "entity" | "page"
    id?: string                 // anchor.id or entity index (if kind !== "page")
    value?: string              // entity.value (if kind === "entity")
    pageNumber?: number         // If source is different page
  }
  
  target: {
    kind: "anchor" | "entity" | "page"
    id?: string
    value?: string
    pageNumber?: number         // If target is different page
  }
  
  confidence: number            // 0.0-1.0 confidence for this relation
  note?: string                 // Optional clarifying note from AI
}
```

**Examples**:

```typescript
// Entity-to-entity relation
{
  type: "connected_to",
  source: { kind: "entity", value: "T-101" },
  target: { kind: "entity", value: "Bus-A" },
  confidence: 0.92
}

// Cross-page reference
{
  type: "continues_to",
  source: { kind: "anchor", id: "anchor_3" },
  target: { kind: "page", pageNumber: 42 },
  confidence: 0.88,
  note: "Diagram continues on Sheet 42"
}

// Entity references anchor
{
  type: "located_in",
  source: { kind: "entity", value: "CB-203" },
  target: { kind: "anchor", id: "anchor_2" },
  confidence: 0.95
}
```

## Ontology

Workspace-level schema of discovered entity and relation types.

```typescript
{
  _id: ObjectId
  workspaceId: ObjectId
  
  entityTypes: [
    {
      name: string              // e.g., "transformer"
      description: string       // e.g., "Electrical power transformer"
      examples: string[]        // e.g., ["T-101", "XFMR-A", "Main Transformer"]
      count: number             // How many instances found
    }
  ]
  
  relationTypes: [
    {
      name: string              // e.g., "connected_to"
      description: string       // e.g., "Physical or logical connection"
      count: number             // How many instances found
    }
  ]
  
  aliases: [
    {
      from: string              // e.g., "Xfmr"
      to: string                // e.g., "Transformer"
    }
  ]
  
  createdAt: Date
  updatedAt: Date
}
```

**Indexes**:
- `workspaceId` (unique)

**Notes**:
- Generated after all pages are analyzed (during "ontology" phase)
- Used by chat assistant to understand domain-specific terminology
- One ontology per workspace (recreated on re-index)

## ChatSession

Workspace-scoped conversation history.

```typescript
{
  _id: ObjectId
  workspaceId: ObjectId         // Conversation scoped to this workspace
  userId: ObjectId              // User who owns this session
  title?: string                // Optional session title (default: first message)
  
  messages: [
    {
      role: "user" | "assistant" | "system"
      content: any              // String or structured (for tool calls)
      createdAt: Date
      
      // For assistant messages with citations
      citations?: [
        {
          documentId: ObjectId
          pageNumber: number
        }
      ]
      
      // For tool calls (optional, for debugging)
      toolCalls?: [
        {
          tool: string          // e.g., "searchPages"
          args: any
          result: any
        }
      ]
    }
  ]
  
  createdAt: Date
  updatedAt: Date
}
```

**Indexes**:
- `workspaceId, userId`
- `updatedAt` (for recent sessions)

**Notes**:
- Each user can have multiple sessions per workspace
- Messages array includes tool calls for transparency
- Citations reference Page documents for grounding

## Unique Constraints

Summary of critical unique indexes:

- `users.googleId` - unique
- `users.email` - unique
- `pages.(workspaceId, documentId, pageNumber)` - unique
- `ontologies.workspaceId` - unique

## MongoDB Sizing Estimates

For a typical workspace with 1000 pages:

| Collection | Typical Doc Size | Count | Total |
|------------|------------------|-------|-------|
| Page (with 100KB image) | ~110 KB | 1000 | ~110 MB |
| Document | ~2-50 MB (PDF) | 10 | ~200 MB |
| Ontology | ~5 KB | 1 | ~5 KB |
| ChatSession | ~50 KB | 20 | ~1 MB |

**Total per workspace**: ~300-500 MB

MongoDB document limit (16 MB) is comfortably above typical page/document sizes.

## Re-Indexing Behavior

When re-indexing a workspace:

1. Delete existing pages:
   ```typescript
   await db.collection("pages").deleteMany({ workspaceId })
   ```

2. Delete existing ontology:
   ```typescript
   await db.collection("ontologies").deleteMany({ workspaceId })
   ```

3. Recreate pages and ontology from scratch

**Note**: Chat sessions are NOT deleted on re-index (they may reference old page IDs, but this is acceptable for v1).

## Navigation

- **Previous**: [00-overview.md](00-overview.md)
- **Next**: [02-architecture.md](02-architecture.md)
- **Related**: [04-indexing-pipeline.md](04-indexing-pipeline.md) - How these models are populated
