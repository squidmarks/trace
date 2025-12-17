# 03 - Authentication & Permissions

This document describes authentication implementation and access control rules.

## Authentication

### NextAuth with Google OAuth

**Provider**: Google OAuth 2.0

**Flow**: Authorization Code flow with PKCE

**Session Storage**: JWT stored in httpOnly cookie

### Configuration

```typescript
// pages/api/auth/[...nextauth].ts
import NextAuth, { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { MongoDBAdapter } from "@next-auth/mongodb-adapter"
import clientPromise from "@/lib/mongodb"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  ],
  
  adapter: MongoDBAdapter(clientPromise),
  
  callbacks: {
    // Add user ID to session
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub!
      }
      return session
    },
    
    // Add user ID to JWT token
    jwt: async ({ token, user }) => {
      if (user) {
        token.sub = user.id
      }
      return token
    }
  },
  
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  }
}

export default NextAuth(authOptions)
```

### User Creation

When a user signs in for the first time via Google OAuth:

1. NextAuth receives Google profile
2. MongoDBAdapter checks if user exists by `googleId`
3. If not exists, creates new `User` document:

```typescript
{
  _id: new ObjectId(),
  googleId: profile.sub,
  email: profile.email,
  name: profile.name,
  avatar: profile.picture,
  createdAt: new Date(),
  updatedAt: new Date()
}
```

4. Returns session with `userId`

### Session Structure

```typescript
{
  user: {
    id: string,        // User._id
    email: string,
    name: string,
    image: string      // avatar URL
  },
  expires: string      // ISO timestamp
}
```

### Protected Routes (Web API)

All API routes except `/api/auth/*` require authentication.

**Middleware example**:

```typescript
// lib/auth.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import type { NextApiRequest, NextApiResponse } from "next"

export async function requireAuth(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  
  if (!session?.user?.id) {
    res.status(401).json({ error: "Unauthorized" })
    return null
  }
  
  return { userId: session.user.id, session }
}

// Usage in API route
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  
  const { userId } = auth
  // ... proceed with authenticated user
}
```

### Socket.io Authentication (Indexer)

The Indexer service hosts Socket.io and must validate browser sessions.

**Indexer server-side**:

```typescript
// indexer/src/server.ts
import { Server } from "socket.io"
import { getToken } from "next-auth/jwt"

const io = new Server(httpServer, {
  cors: {
    origin: process.env.WEB_APP_URL,
    credentials: true
  }
})

io.use(async (socket, next) => {
  try {
    // Extract and validate NextAuth JWT from cookie
    const token = await getToken({
      req: socket.request,
      secret: process.env.NEXTAUTH_SECRET!  // Indexer needs this!
    })
    
    if (!token?.sub) {
      return next(new Error("Authentication required"))
    }
    
    // Attach userId to socket
    socket.data.userId = token.sub
    next()
  } catch (err) {
    next(new Error("Authentication failed"))
  }
})
```

**Browser client-side**:

```typescript
// Browser
import { io } from "socket.io-client"

// Socket.io automatically sends cookies (including NextAuth session)
const socket = io(process.env.NEXT_PUBLIC_INDEXER_URL, {
  withCredentials: true
})
```

**Critical**: Indexer must have `NEXTAUTH_SECRET` to validate JWTs.

See: [05-realtime.md](05-realtime.md) for complete Socket.io implementation.

## Authorization

### Roles

Two roles:

| Role | Description | Capabilities |
|------|-------------|--------------|
| **Owner** | Creator of workspace | Full control: CRUD documents, trigger indexing, manage sharing, delete workspace |
| **Viewer** | Invited user | Read-only: view pages, search, chat, cannot modify |

**Note**: Owner is implicit (not in `Workspace.members` array). Only viewers are listed in `members`.

### Permission Checks

All permission checks happen in API routes (Web) and Socket.io middleware (Indexer) against MongoDB.

#### Workspace Membership Check

```typescript
// lib/permissions.ts (shared between Web and Indexer)
import { ObjectId } from "mongodb"
import { getDb } from "@/lib/mongodb"

export type WorkspaceRole = "owner" | "viewer" | null

export async function getWorkspaceRole(
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole> {
  const db = await getDb()
  
  const workspace = await db.collection("workspaces").findOne({
    _id: new ObjectId(workspaceId)
  })
  
  if (!workspace) return null
  
  // Check if owner
  if (workspace.ownerId.toString() === userId) {
    return "owner"
  }
  
  // Check if viewer
  const isMember = workspace.members.some(
    (m: any) => m.userId.toString() === userId
  )
  
  return isMember ? "viewer" : null
}

export async function requireWorkspaceAccess(
  workspaceId: string,
  userId: string,
  requiredRole?: "owner"
): Promise<{ role: WorkspaceRole; workspace: any }> {
  const role = await getWorkspaceRole(workspaceId, userId)
  
  if (!role) {
    throw new Error("Access denied: Not a member of this workspace")
  }
  
  if (requiredRole === "owner" && role !== "owner") {
    throw new Error("Access denied: Owner role required")
  }
  
  const db = await getDb()
  const workspace = await db.collection("workspaces").findOne({
    _id: new ObjectId(workspaceId)
  })
  
  return { role, workspace }
}
```

#### Usage in API Routes (Web)

**Read-only endpoint** (owner or viewer):

```typescript
// GET /api/workspaces/:id/pages
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  
  const { id: workspaceId } = req.query
  
  try {
    // Require any workspace access (owner or viewer)
    const { role, workspace } = await requireWorkspaceAccess(
      workspaceId as string,
      auth.userId
    )
    
    // ... fetch and return pages
    res.json({ pages })
  } catch (err) {
    res.status(403).json({ error: err.message })
  }
}
```

**Write endpoint** (owner only):

```typescript
// POST /api/workspaces/:id/documents
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res)
  if (!auth) return
  
  const { id: workspaceId } = req.query
  
  try {
    // Require owner role
    const { role, workspace } = await requireWorkspaceAccess(
      workspaceId as string,
      auth.userId,
      "owner"  // <-- requires owner
    )
    
    // ... create document
    res.status(201).json({ document })
  } catch (err) {
    res.status(403).json({ error: err.message })
  }
}
```

#### Usage in Socket.io (Indexer)

**Room join authorization**:

```typescript
// indexer/src/server.ts
socket.on("workspace:join", async (data) => {
  const { workspaceId } = data
  const userId = socket.data.userId
  
  // Check workspace access
  const role = await getWorkspaceRole(workspaceId, userId)
  
  if (!role) {
    socket.emit("error", { message: "Access denied" })
    return
  }
  
  // Join room
  socket.join(`workspace:${workspaceId}`)
  socket.emit("workspace:joined", { workspaceId, role })
})
```

### Permission Matrix

| Action | Owner | Viewer |
|--------|-------|--------|
| **Workspace** | | |
| View workspace details | ✅ | ✅ |
| Update workspace (name, description) | ✅ | ❌ |
| Delete workspace | ✅ | ❌ |
| View members | ✅ | ✅ |
| Add viewers | ✅ | ❌ |
| Remove viewers | ✅ | ❌ |
| **Documents** | | |
| List documents | ✅ | ✅ |
| View document details | ✅ | ✅ |
| Upload document | ✅ | ❌ |
| Add document by URL | ✅ | ❌ |
| Delete document | ✅ | ❌ |
| **Indexing** | | |
| View index status | ✅ | ✅ |
| View index progress | ✅ | ✅ |
| Trigger indexing | ✅ | ❌ |
| **Pages** | | |
| View page | ✅ | ✅ |
| View page metadata | ✅ | ✅ |
| Search pages | ✅ | ✅ |
| **Chat** | | |
| Create chat session | ✅ | ✅ |
| Send messages | ✅ | ✅ |
| View chat history | ✅ (own) | ✅ (own) |
| **Realtime** | | |
| Connect to Indexer Socket.io | ✅ | ✅ |
| Join workspace room | ✅ | ✅ |
| Receive progress events | ✅ | ✅ |

### Workspace Sharing

#### Add Viewer

```typescript
// POST /api/workspaces/:id/members
{
  email: "viewer@example.com"
}
```

**Process**:
1. Verify requestor is owner
2. Look up user by email
3. Check if already a member
4. Add to `workspace.members` array:

```typescript
await db.collection("workspaces").updateOne(
  { _id: new ObjectId(workspaceId) },
  {
    $push: {
      members: {
        userId: new ObjectId(viewerUserId),
        role: "viewer",
        addedAt: new Date(),
        addedBy: new ObjectId(auth.userId)
      }
    }
  }
)
```

#### Remove Viewer

```typescript
// DELETE /api/workspaces/:id/members/:userId
```

**Process**:
1. Verify requestor is owner
2. Remove from `workspace.members` array:

```typescript
await db.collection("workspaces").updateOne(
  { _id: new ObjectId(workspaceId) },
  {
    $pull: {
      members: { userId: new ObjectId(userIdToRemove) }
    }
  }
)
```

## Service-to-Service Authentication

### Web → Indexer

**Method**: Bearer token in Authorization header

**Token**: `INDEXER_SERVICE_TOKEN` (shared secret)

**Usage**:

```typescript
// Web app calling Indexer
const response = await fetch(`${INDEXER_BASE_URL}/jobs/start`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.INDEXER_SERVICE_TOKEN}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ workspaceId, params })
})
```

**Indexer validation**:

```typescript
// Indexer: POST /jobs/start
app.post("/jobs/start", (req, res) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.replace("Bearer ", "")
  
  if (token !== process.env.INDEXER_SERVICE_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" })
  }
  
  // ... process job
})
```

## Environment Variables

### Web App

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random-32-char-string>

# Google OAuth
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>

# MongoDB
MONGODB_URI=mongodb://localhost:27017/trace

# Indexer integration
INDEXER_BASE_URL=http://localhost:4000
INDEXER_SERVICE_TOKEN=<shared-secret>

# OpenAI (for chat)
OPENAI_API_KEY=<openai-api-key>
```

### Indexer Service

```bash
# MongoDB
MONGODB_URI=mongodb://localhost:27017/trace

# OpenAI (for analysis + embeddings)
OPENAI_API_KEY=<openai-api-key>

# Service token (for Web → Indexer calls)
INDEXER_SERVICE_TOKEN=<shared-secret>

# NextAuth (for validating browser sessions)
NEXTAUTH_SECRET=<same-as-web>

# Web app (for CORS)
WEB_APP_URL=http://localhost:3000
```

## Security Best Practices

### Token Generation

Use cryptographically secure random strings:

```bash
# Generate tokens
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Token Rotation

Recommended rotation schedule:
- `NEXTAUTH_SECRET`: Rotate every 90 days
- `INDEXER_SERVICE_TOKEN`: Rotate every 30 days

**Rotation process** (zero-downtime):
1. Add new token as `INDEXER_SERVICE_TOKEN_NEW`
2. Update Indexer to accept both old and new
3. Deploy Indexer
4. Update Web to use new token
5. Deploy Web
6. Remove old token from Indexer
7. Deploy Indexer again

### HTTPS Required in Production

All communication must use HTTPS:
- Browser ↔ Web: HTTPS + secure cookies
- Browser ↔ Indexer (Socket.io): WSS (WebSocket Secure)
- Web ↔ Indexer: HTTPS (even if internal)

### Cookie Security

NextAuth session cookie configuration:

```typescript
cookies: {
  sessionToken: {
    name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production'
    }
  }
}
```

## Navigation

- **Previous**: [02-architecture.md](02-architecture.md)
- **Next**: [04-indexing-pipeline.md](04-indexing-pipeline.md)
- **Related**: [05-realtime.md](05-realtime.md) - Socket.io authentication
