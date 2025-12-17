# 08 - API Contracts

This document defines all REST API endpoints for both the Web app and Indexer service.

## Web API (Public)

All endpoints require authentication via NextAuth session unless otherwise noted.

### Authentication

#### Sign In

```
GET /api/auth/signin
```

Redirects to Google OAuth flow.

#### Sign Out

```
GET /api/auth/signout
```

Clears session and redirects to home.

#### Session

```
GET /api/auth/session
```

Returns current session or `null`.

**Response**:
```typescript
{
  user: {
    id: string,
    email: string,
    name: string,
    image: string
  },
  expires: string
} | null
```

### Workspaces

#### List Workspaces

```
GET /api/workspaces
```

Returns all workspaces where user is owner or viewer.

**Response**:
```typescript
{
  workspaces: [
    {
      _id: string,
      ownerId: string,
      name: string,
      description?: string,
      role: "owner" | "viewer",
      indexStatus: "idle" | "queued" | "processing" | "ready" | "failed",
      createdAt: string,
      updatedAt: string
    }
  ]
}
```

#### Create Workspace

```
POST /api/workspaces
```

**Request**:
```typescript
{
  name: string,
  description?: string
}
```

**Response** (201):
```typescript
{
  workspace: {
    _id: string,
    ownerId: string,
    name: string,
    description?: string,
    indexStatus: "idle",
    createdAt: string,
    updatedAt: string
  }
}
```

#### Get Workspace

```
GET /api/workspaces/:id
```

**Response**:
```typescript
{
  workspace: {
    _id: string,
    ownerId: string,
    name: string,
    description?: string,
    members: [
      {
        userId: string,
        role: "viewer",
        addedAt: string,
        addedBy: string
      }
    ],
    indexStatus: "idle" | "queued" | "processing" | "ready" | "failed",
    indexProgress?: {
      phase: string,
      docsDone: number,
      docsTotal: number,
      pagesDone: number,
      pagesTotal: number,
      updatedAt: string
    },
    createdAt: string,
    updatedAt: string
  },
  role: "owner" | "viewer"
}
```

#### Update Workspace

```
PATCH /api/workspaces/:id
```

**Requires**: Owner role

**Request**:
```typescript
{
  name?: string,
  description?: string
}
```

**Response**:
```typescript
{
  workspace: Workspace
}
```

#### Delete Workspace

```
DELETE /api/workspaces/:id
```

**Requires**: Owner role

**Response** (204): No content

### Workspace Members

#### List Members

```
GET /api/workspaces/:id/members
```

**Response**:
```typescript
{
  members: [
    {
      userId: string,
      email: string,
      name: string,
      role: "owner" | "viewer",
      addedAt?: string,
      addedBy?: string
    }
  ]
}
```

#### Add Member

```
POST /api/workspaces/:id/members
```

**Requires**: Owner role

**Request**:
```typescript
{
  email: string  // User email to add as viewer
}
```

**Response** (201):
```typescript
{
  member: {
    userId: string,
    email: string,
    name: string,
    role: "viewer",
    addedAt: string,
    addedBy: string
  }
}
```

**Errors**:
- 404: User not found
- 400: User already a member

#### Remove Member

```
DELETE /api/workspaces/:id/members/:userId
```

**Requires**: Owner role

**Response** (204): No content

### Documents

#### List Documents

```
GET /api/workspaces/:id/documents
```

**Response**:
```typescript
{
  documents: [
    {
      _id: string,
      workspaceId: string,
      uploadedBy: string,
      filename: string,
      sourceType: "upload" | "url",
      sourceUrl?: string,
      pageCount?: number,
      status: "queued" | "processing" | "ready" | "failed",
      error?: string,
      createdAt: string,
      updatedAt: string
    }
  ]
}
```

#### Upload Document

```
POST /api/workspaces/:id/documents
```

**Requires**: Owner role

**Request** (multipart/form-data or JSON with base64):
```typescript
{
  filename: string,
  file: string  // base64-encoded PDF
}
```

**Response** (201):
```typescript
{
  document: Document
}
```

#### Add Document by URL

```
POST /api/workspaces/:id/documents/url
```

**Requires**: Owner role

**Request**:
```typescript
{
  url: string,
  filename?: string  // Optional override
}
```

**Response** (201):
```typescript
{
  document: Document
}
```

#### Get Document

```
GET /api/workspaces/:id/documents/:documentId
```

**Response**:
```typescript
{
  document: Document
}
```

#### Delete Document

```
DELETE /api/workspaces/:id/documents/:documentId
```

**Requires**: Owner role

**Response** (204): No content

**Note**: Also deletes all pages from that document on next re-index.

### Indexing

#### Get Index Status

```
GET /api/workspaces/:id/index
```

**Response**:
```typescript
{
  status: "idle" | "queued" | "processing" | "ready" | "failed",
  progress?: {
    phase: string,
    docsDone: number,
    docsTotal: number,
    pagesDone: number,
    pagesTotal: number,
    updatedAt: string
  },
  pageCount?: number  // Total pages indexed (when status === "ready")
}
```

#### Trigger Indexing

```
POST /api/workspaces/:id/index
```

**Requires**: Owner role

**Request**:
```typescript
{
  params?: {
    analysisModel?: string,      // default: "gpt-4o"
    embeddingModel?: string,     // default: "text-embedding-3-small"
    renderDpi?: number,          // default: 150
    renderQuality?: number       // default: 85
  }
}
```

**Response** (202):
```typescript
{
  status: "queued",
  message: "Indexing started"
}
```

**Errors**:
- 400: No documents ready for indexing
- 409: Indexing already in progress

**Note**: Re-indexing will delete all existing pages and ontology before starting.

### Pages

#### List Pages

```
GET /api/workspaces/:id/pages?documentId=<id>&limit=<N>&offset=<N>
```

**Query Parameters**:
- `documentId` (optional): Filter by document
- `limit` (optional, default 50): Max results
- `offset` (optional, default 0): Pagination offset

**Response**:
```typescript
{
  pages: [
    {
      _id: string,
      workspaceId: string,
      documentId: string,
      pageNumber: number,
      imageUrl: string,  // data URL
      analysis: PageAnalysis,
      createdAt: string,
      updatedAt: string
    }
  ],
  total: number
}
```

**Note**: `imageData` is returned as `imageUrl` data URL for browser display.

#### Get Page

```
GET /api/workspaces/:id/pages/:pageId
```

**Response**:
```typescript
{
  page: Page  // with imageUrl data URL
}
```

#### Get Page by Document + Page Number

```
GET /api/workspaces/:id/documents/:documentId/pages/:pageNumber
```

**Response**:
```typescript
{
  page: Page
}
```

### Search

#### Search Pages

```
GET /api/workspaces/:id/search?q=<query>&limit=<N>&offset=<N>
```

**Query Parameters**:
- `q` (required): Search query
- `limit` (optional, default 20): Max results
- `offset` (optional, default 0): Pagination offset

**Response**:
```typescript
{
  results: [
    {
      page: Page,
      score: number,
      matches: {
        vector: number,
        topics: string[],
        entities: string[]
      }
    }
  ],
  total: number,
  query: string
}
```

See: [06-search-retrieval.md](06-search-retrieval.md)

### Chat

#### Create/Continue Chat Session

```
POST /api/workspaces/:id/chat
```

**Request**:
```typescript
{
  sessionId?: string,  // Optional: continue existing session
  message: string,
  model?: string       // Optional: override default
}
```

**Response**:
```typescript
{
  sessionId: string,
  message: {
    role: "assistant",
    content: string,
    citations: [
      {
        pageId: string,
        documentId: string,
        pageNumber: number
      }
    ],
    createdAt: string
  }
}
```

See: [07-chat-system.md](07-chat-system.md)

#### List Chat Sessions

```
GET /api/workspaces/:id/chat/sessions
```

**Response**:
```typescript
{
  sessions: [
    {
      _id: string,
      title?: string,
      messageCount: number,
      lastMessageAt: string,
      createdAt: string
    }
  ]
}
```

#### Get Chat Session

```
GET /api/workspaces/:id/chat/sessions/:sessionId
```

**Response**:
```typescript
{
  session: ChatSession
}
```

#### Delete Chat Session

```
DELETE /api/workspaces/:id/chat/sessions/:sessionId
```

**Response** (204): No content

### Ontology

#### Get Workspace Ontology

```
GET /api/workspaces/:id/ontology
```

**Response**:
```typescript
{
  ontology: {
    _id: string,
    workspaceId: string,
    entityTypes: [
      {
        name: string,
        description: string,
        examples: string[],
        count: number
      }
    ],
    relationTypes: [
      {
        name: string,
        description: string,
        count: number
      }
    ],
    aliases: [
      {
        from: string,
        to: string
      }
    ],
    createdAt: string
  }
}
```

**Note**: Returns 404 if workspace has not been indexed yet.

---

## Indexer API (Internal)

These endpoints are NOT exposed to browsers. Only Web app can call Indexer.

### Start Index Job

```
POST /jobs/start
```

**Auth**: Requires `INDEXER_SERVICE_TOKEN` in Authorization header

**Request**:
```typescript
{
  workspaceId: string,
  params?: {
    analysisModel?: string,
    embeddingModel?: string,
    renderDpi?: number,
    renderQuality?: number
  }
}
```

**Response** (202):
```typescript
{
  status: "queued"
}
```

### Health Check

```
GET /health
```

**No auth required**

**Response**:
```typescript
{
  status: "healthy",
  uptime: number,  // seconds
  activeJobs: number,
  queuedJobs: number,
  socketConnections: number
}
```

---

## Error Responses

All endpoints return errors in consistent format:

```typescript
{
  error: string,           // Human-readable error message
  code?: string,           // Optional error code
  details?: any            // Optional additional details
}
```

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET/PATCH |
| 201 | Created | Successful POST creating resource |
| 202 | Accepted | Async operation queued |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid request body/params |
| 401 | Unauthorized | Missing/invalid auth |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource state conflict |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |

---

## Request/Response Examples

### Create Workspace + Upload Document + Index

**Step 1: Create workspace**

```bash
curl -X POST http://localhost:3000/api/workspaces \
  -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Electrical Schematics",
    "description": "2024 facility drawings"
  }'
```

**Response**:
```json
{
  "workspace": {
    "_id": "507f1f77bcf86cd799439011",
    "ownerId": "507f1f77bcf86cd799439012",
    "name": "Electrical Schematics",
    "description": "2024 facility drawings",
    "indexStatus": "idle",
    "createdAt": "2025-12-17T12:00:00Z",
    "updatedAt": "2025-12-17T12:00:00Z"
  }
}
```

**Step 2: Upload document**

```bash
curl -X POST http://localhost:3000/api/workspaces/507f1f77bcf86cd799439011/documents \
  -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "schematic-main.pdf",
    "file": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8P..."
  }'
```

**Response**:
```json
{
  "document": {
    "_id": "507f1f77bcf86cd799439013",
    "workspaceId": "507f1f77bcf86cd799439011",
    "uploadedBy": "507f1f77bcf86cd799439012",
    "filename": "schematic-main.pdf",
    "sourceType": "upload",
    "status": "ready",
    "pageCount": 24,
    "createdAt": "2025-12-17T12:01:00Z",
    "updatedAt": "2025-12-17T12:01:00Z"
  }
}
```

**Step 3: Trigger indexing**

```bash
curl -X POST http://localhost:3000/api/workspaces/507f1f77bcf86cd799439011/index \
  -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "status": "queued",
  "message": "Indexing started"
}
```

### Search + Chat Flow

**Step 1: Search**

```bash
curl -G http://localhost:3000/api/workspaces/507f1f77bcf86cd799439011/search \
  -H "Cookie: next-auth.session-token=..." \
  --data-urlencode "q=transformer protection" \
  --data-urlencode "limit=5"
```

**Response**:
```json
{
  "results": [
    {
      "page": {
        "_id": "...",
        "pageNumber": 5,
        "documentId": "...",
        "analysis": {
          "summary": "Shows transformer T-101 with protection relay...",
          "topics": ["transformer", "protection", "relay"]
        }
      },
      "score": 0.92,
      "matches": {
        "vector": 0.89,
        "topics": ["transformer", "protection"],
        "entities": ["T-101", "51-T"]
      }
    }
  ],
  "total": 12,
  "query": "transformer protection"
}
```

**Step 2: Chat**

```bash
curl -X POST http://localhost:3000/api/workspaces/507f1f77bcf86cd799439011/chat \
  -H "Cookie: next-auth.session-token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What protection is used for transformer T-101?"
  }'
```

**Response**:
```json
{
  "sessionId": "507f1f77bcf86cd799439014",
  "message": {
    "role": "assistant",
    "content": "Transformer T-101 uses overcurrent protection relay 51-T with the following settings: pickup at 150% FLA, time delay 0.5s. This is shown on page 5 of the electrical schematic.",
    "citations": [
      {
        "pageId": "507f1f77bcf86cd799439015",
        "documentId": "507f1f77bcf86cd799439013",
        "pageNumber": 5
      }
    ],
    "createdAt": "2025-12-17T12:05:00Z"
  }
}
```

---

## Rate Limiting

### Per-User Limits (v1.1+)

| Endpoint | Limit | Window |
|----------|-------|--------|
| Search | 60 requests | 1 minute |
| Chat | 20 messages | 1 hour |
| Document upload | 10 files | 1 hour |
| Index trigger | 3 jobs | 1 hour |

**Response when rate limited** (429):
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 120  // seconds
}
```

---

## Pagination

All list endpoints support pagination via `limit` and `offset`:

```
GET /api/workspaces/:id/pages?limit=50&offset=100
```

**Response includes total**:
```json
{
  "pages": [...],
  "total": 1234,
  "limit": 50,
  "offset": 100
}
```

---

## Navigation

- **Previous**: [07-chat-system.md](07-chat-system.md)
- **Next**: [09-ui-routes.md](09-ui-routes.md)
- **Related**: [03-auth-permissions.md](03-auth-permissions.md) - Auth requirements
