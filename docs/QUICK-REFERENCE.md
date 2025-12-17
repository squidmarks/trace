# Trace Quick Reference

Fast lookup guide for developers working on Trace.

---

## System Components

| Component | Tech | Port | Purpose |
|-----------|------|------|---------|
| Web App | Next.js 14+ | 3000 | UI, Auth, API routes |
| Indexer | Node.js + Express | 3001 | PDF processing, AI analysis, Socket.io |
| Database | MongoDB Atlas | - | All persistent data + vector search |
| AI | OpenAI API | - | Vision, embeddings, chat |

---

## Data Models (Simplified)

```typescript
Workspace {
  name, description, ownerId, members[],
  indexStatus: "idle" | "queued" | "processing" | "ready" | "failed",
  indexProgress: { phase, docsDone, pagesDone, ... }
}

Document {
  workspaceId, filename, fileData (base64),
  sourceType: "upload" | "url",
  pageCount, status
}

Page {
  workspaceId, documentId, pageNumber,
  imageData (base64 JPEG),
  analysis: { summary, topics[], entities[], relations[], anchors[] },
  embedding: number[1536]
}

Ontology {
  workspaceId,
  entityTypes[],
  relationTypes[],
  aliases[]
}

ChatSession {
  workspaceId, userId,
  messages: { role, content, citations[], toolCalls[] }[]
}
```

---

## Key Design Decisions

### Why Base64 in MongoDB?
- **Simplicity**: No external storage service required
- **Transactional**: Atomic updates with analysis metadata
- **Performance**: Pages <200 KB fit comfortably in 16 MB limit
- **AI-Ready**: Images optimized for AI (150 DPI JPEG, quality 85)
- **Direct Usage**: Can be sent directly to OpenAI or rendered as data URLs

### Why No Index Versioning?
- **Complexity**: Versioning adds significant complexity for v1
- **Re-index Pattern**: Delete existing pages/ontology, recreate from scratch
- **Future**: Can add versioning later if needed

### Why Direct Socket.io Connection?
- **Simplicity**: No webhook proxy needed
- **Reliability**: Fewer points of failure
- **Latency**: Direct connection faster than webhook relay
- **Auth**: NextAuth session validated at Indexer
- **Room Filtering**: Users only receive events for their workspaces

---

## Indexing Pipeline (6 Phases)

1. **Fetch**: Load documents from MongoDB, count pages
2. **Render**: PDF → JPEG images (150 DPI, quality 85)
3. **Analyze**: AI extracts metadata from each page
4. **Embed**: Generate vectors from page content
5. **Ontology**: Synthesize entity/relation types
6. **Finalize**: Mark workspace as "ready"

**Progress Updates**: Emitted via Socket.io to browser at each phase.

**Re-indexing**: Deletes all existing pages and ontology before starting.

---

## API Endpoints (Key Routes)

### Web App

```
# Workspaces
GET    /api/workspaces
POST   /api/workspaces
GET    /api/workspaces/:id
PATCH  /api/workspaces/:id
DELETE /api/workspaces/:id

# Documents
POST   /api/workspaces/:id/documents
POST   /api/workspaces/:id/documents/url
GET    /api/workspaces/:id/documents
DELETE /api/workspaces/:id/documents/:docId

# Indexing
GET    /api/workspaces/:id/index
POST   /api/workspaces/:id/index

# Pages
GET    /api/workspaces/:id/pages
GET    /api/workspaces/:id/pages/:pageId

# Search
GET    /api/workspaces/:id/search?q=...

# Chat
POST   /api/workspaces/:id/chat
GET    /api/workspaces/:id/chat/sessions
```

### Indexer (Internal)

```
POST   /jobs/start         # Trigger indexing
GET    /health             # Service health
```

---

## Socket.io Events

### Connection

```typescript
// Browser connects to Indexer
const socket = io(process.env.NEXT_PUBLIC_INDEXER_URL, {
  withCredentials: true  // Sends NextAuth cookie
})

// Join workspace room
socket.emit("workspace:join", { workspaceId })
socket.on("workspace:joined", ({ workspaceId, role }) => {})
```

### Events from Indexer → Browser

```typescript
// Indexing progress
socket.on("index:progress", (data) => {
  // data: { phase, docsDone, docsTotal, pagesDone, pagesTotal }
})

// Indexing complete
socket.on("index:complete", (data) => {
  // data: { workspaceId, pageCount, duration }
})

// Indexing failed
socket.on("index:error", (data) => {
  // data: { workspaceId, error }
})
```

### Authentication

- **Middleware**: Indexer validates NextAuth JWT from cookie
- **Room Filtering**: Users join `workspace:${workspaceId}` rooms
- **Permissions**: Checked on room join (owner or viewer required)

---

## Permissions

| Action | Owner | Viewer |
|--------|-------|--------|
| View workspace | ✅ | ✅ |
| Upload documents | ✅ | ❌ |
| Trigger indexing | ✅ | ❌ |
| Search pages | ✅ | ✅ |
| Chat | ✅ | ✅ |
| View ontology | ✅ | ✅ |
| Manage members | ✅ | ❌ |
| Delete workspace | ✅ | ❌ |
| Receive Socket.io events | ✅ | ✅ |

**Enforcement**: Every API route and Socket.io room join checks permissions via `getWorkspaceRole(workspaceId, userId)`.

---

## Environment Variables

### Web App (apps/web/.env.local)

```bash
NEXTAUTH_SECRET=random-secret
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MONGODB_URI=mongodb+srv://...
INDEXER_SERVICE_URL=http://localhost:3001
INDEXER_SERVICE_TOKEN=shared-secret
NEXT_PUBLIC_INDEXER_URL=http://localhost:3001
```

### Indexer (apps/indexer/.env)

```bash
MONGODB_URI=mongodb+srv://...
OPENAI_API_KEY=sk-...
INDEXER_SERVICE_TOKEN=shared-secret
NEXTAUTH_SECRET=random-secret
NEXTAUTH_URL=http://localhost:3000
WEB_APP_URL=http://localhost:3000
PORT=3001
```

**IMPORTANT**: `NEXTAUTH_SECRET` must match between Web and Indexer for Socket.io auth to work.

---

## Common Queries

### MongoDB

```javascript
// Find all pages in a workspace
db.pages.find({ workspaceId: ObjectId("...") })

// Find pages by topic
db.pages.find({ "analysis.topics": "transformer" })

// Count pages per workspace
db.pages.aggregate([
  { $group: { _id: "$workspaceId", count: { $sum: 1 } } }
])

// Vector search (simplified)
db.pages.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [...],  // 1536 floats
      numCandidates: 100,
      limit: 20
    }
  }
])
```

### Common Code Patterns

**Get workspace with role**:
```typescript
const workspace = await getWorkspace(workspaceId)
const role = await getWorkspaceRole(workspaceId, userId)

if (!role) {
  return res.status(403).json({ error: "Access denied" })
}

if (role !== "owner") {
  return res.status(403).json({ error: "Owner role required" })
}
```

**Emit Socket.io event**:
```typescript
// In Indexer
io.to(`workspace:${workspaceId}`).emit("index:progress", {
  phase: "analyze",
  docsDone: 1,
  docsTotal: 3,
  pagesDone: 10,
  pagesTotal: 50
})
```

**Call OpenAI with image**:
```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Analyze this page..." },
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${base64Image}`
          }
        }
      ]
    }
  ]
})
```

---

## Troubleshooting

### Indexing Stuck

**Symptoms**: Status "processing" but no progress updates

**Causes**:
1. Indexer service crashed
2. MongoDB connection lost
3. OpenAI rate limit hit

**Debug**:
```bash
# Check indexer logs
cd apps/indexer
npm run logs

# Check workspace status
db.workspaces.findOne({ _id: ObjectId("...") })

# Reset status manually (if needed)
db.workspaces.updateOne(
  { _id: ObjectId("...") },
  { $set: { indexStatus: "idle" } }
)
```

### Socket.io Not Connecting

**Symptoms**: Browser can't connect to Indexer Socket.io

**Causes**:
1. CORS misconfiguration
2. Auth token mismatch
3. Indexer not running

**Debug**:
```javascript
// Browser console
const socket = io("http://localhost:3001", {
  withCredentials: true
})

socket.on("connect_error", (err) => {
  console.error("Connection error:", err.message)
})
```

**Check**:
- `WEB_APP_URL` in Indexer .env matches Web URL
- `NEXTAUTH_SECRET` matches between Web and Indexer
- Indexer is running on correct port

### Search Returns No Results

**Symptoms**: Search query returns empty results

**Causes**:
1. Workspace not indexed
2. Vector index not created
3. Index not finished

**Debug**:
```javascript
// Check workspace status
GET /api/workspaces/:id

// Check page count
db.pages.countDocuments({ workspaceId: ObjectId("...") })

// Check embeddings exist
db.pages.findOne(
  { workspaceId: ObjectId("..."), embedding: { $exists: true } }
)
```

### Chat Not Citing Pages

**Symptoms**: Assistant responds but no citations

**Causes**:
1. Tool calls disabled
2. Search returning no results
3. Model not using tools

**Debug**:
- Check tool definitions in chat prompt
- Test search endpoint directly
- Review OpenAI tool call logs

---

## FAQ

### Q: Why store images as base64 in MongoDB?

**A**: For v1 simplicity. Images are ~100-200 KB and optimized for AI. This avoids external storage dependencies and keeps page data atomic with analysis metadata.

### Q: Can I re-index without deleting the old index?

**A**: No, in v1 re-indexing deletes existing pages and ontology. Index versioning can be added in v2 if needed.

### Q: How does Socket.io auth work?

**A**: Browser sends NextAuth cookie to Indexer Socket.io server. Indexer validates JWT using same `NEXTAUTH_SECRET` as Web app. User ID extracted and used for permission checks.

### Q: Why is the Indexer separate from the Web app?

**A**: Separation of concerns. Indexing is CPU/memory intensive and should scale independently from the web tier. Also enables future features like distributed workers.

### Q: What's the cost per page?

**A**: Approximate OpenAI costs per page:
- Analysis (gpt-4o vision): ~$0.005
- Embedding (text-embedding-3-small): ~$0.0001
- **Total**: ~$0.005 per page
- 1000 pages ≈ $5

### Q: Can I use a different AI model?

**A**: Yes, models are configurable in index params. Default:
- Analysis: `gpt-4o`
- Embedding: `text-embedding-3-small`
- Chat: `gpt-4-turbo`

### Q: What PDF features are supported?

**A**: All PDFs are rendered to images, so all visual content is preserved. Text-based PDFs work fine, as do scanned documents, diagrams, etc. Forms and interactive elements are rendered statically.

### Q: How do I add more viewers?

**A**: As workspace owner, go to Settings tab → Members → Add Viewer (by email).

### Q: Can viewers trigger indexing?

**A**: No, only workspace owners can upload documents, delete documents, or trigger indexing.

### Q: What happens to chat when I re-index?

**A**: Chat sessions persist. Citations may break if page IDs change. Consider this when re-indexing active workspaces.

### Q: How do I delete all data for a workspace?

**A**: Delete the workspace via Settings → Danger Zone. This cascades to:
- Documents
- Pages
- Ontology
- Chat sessions

### Q: Can I export search results?

**A**: Not in v1. Planned for v1.1.

### Q: Is there a page limit per workspace?

**A**: No hard limit, but MongoDB Atlas free tier has storage limits. 1000 pages ≈ 200 MB.

### Q: How long does indexing take?

**A**: Approximately 30-45 seconds per page (including AI analysis and embedding). 100-page document ≈ 50 minutes. Bottleneck is OpenAI API rate limits.

---

## Performance Tips

### Indexing

- **Batch requests**: Indexer batches embedding calls (up to 100 at a time)
- **Concurrency**: Process multiple pages in parallel (default: 3)
- **Tune DPI**: Lower DPI (e.g., 120) = faster rendering, smaller files
- **Skip pages**: If documents have cover/blank pages, remove them first

### Search

- **Limit results**: Default 20, increase only if needed
- **Cache ontology**: Ontology changes rarely, cache aggressively
- **Index topics**: Create MongoDB index on `analysis.topics` for lexical search

### Chat

- **Stream responses**: (v1.1 feature) reduces perceived latency
- **Limit context**: Only pass relevant tool results to AI
- **Cache common queries**: Cache search results for popular terms

---

## Useful Commands

```bash
# Start both services
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint and format
npm run lint
npm run format

# MongoDB shell
mongosh "mongodb+srv://..."

# Check Indexer health
curl http://localhost:3001/health

# Trigger indexing (with auth)
curl -X POST http://localhost:3000/api/workspaces/:id/index \
  -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json"
```

---

## Links

- **Specs**: [docs/specs/](../specs/)
- **Architecture**: [02-architecture.md](../specs/02-architecture.md)
- **API**: [08-api-contracts.md](../specs/08-api-contracts.md)
- **Implementation Plan**: [11-implementation-plan.md](../specs/11-implementation-plan.md)

---

**Last Updated**: 2025-12-17
