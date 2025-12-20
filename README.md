# Trace

**AI-powered system for exploring and understanding large sets of visual PDF documents**

Trace transforms document collections into searchable, queryable knowledge bases by converting PDFs to page images, extracting structured metadata with AI, and enabling semantic search and natural language chat.

---

## What is Trace?

Trace helps you **find connections and meaning** across document sets that are primarily visual (diagrams, schematics, scanned documents, etc.) where traditional text-based search fails.

### Key Features

- 📄 **Visual-First Processing**: PDFs → Page images (AI-optimized)
- 🔍 **Hybrid Search**: Vector similarity + lexical matching
- 💬 **AI Chat Assistant**: Ask questions about your documents with citations
- 🧠 **Workspace Ontology**: Auto-generated entity and relation types
- 🎯 **Page-Level Precision**: Every result is a specific page with context
- 👥 **Collaboration**: Share workspaces with viewers
- ⚡ **Real-Time Updates**: Live indexing progress via Socket.io

### Use Cases

- Engineering document sets (electrical schematics, mechanical drawings)
- Legal document review (contracts, filings, discovery)
- Research paper collections
- Scanned archive exploration
- Technical manual search

---

## Architecture Overview

Trace consists of two main services:

```mermaid
graph LR
    Browser[Browser]
    Web[Web App<br/>Next.js]
    Indexer[Indexer Service<br/>Node.js]
    MongoDB[(MongoDB)]
    OpenAI[OpenAI API]
    
    Browser -->|HTTPS| Web
    Browser -.->|Socket.io| Indexer
    Web -->|REST| Indexer
    Web -->|MongoDB| MongoDB
    Indexer -->|MongoDB| MongoDB
    Indexer -->|AI| OpenAI
```

### Components

1. **Web App (Next.js)**
   - User interface and authentication (NextAuth + Google OAuth)
   - Document management
   - Search and chat endpoints
   - API for frontend

2. **Indexer Service (Node.js)**
   - PDF processing (render to images)
   - AI analysis (OpenAI Vision API)
   - Embedding generation
   - Ontology synthesis
   - Socket.io server for realtime progress updates

3. **MongoDB**
   - All persistent data (workspaces, documents, pages, analyses, ontology)
   - Vector search (Atlas Vector Search)
   - Page images stored as base64 JPEG

4. **OpenAI API**
   - Page analysis (`gpt-4o` with vision)
   - Embeddings (`text-embedding-3-small`)
   - Chat (`gpt-4-turbo`)

### Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Web
    participant Indexer
    participant MongoDB
    participant OpenAI
    
    User->>Web: Upload PDF
    Web->>MongoDB: Store document (base64)
    User->>Web: Trigger indexing
    Web->>MongoDB: Update status to "queued"
    Web->>Indexer: POST /jobs/start
    Indexer->>MongoDB: Fetch documents
    Indexer->>Indexer: Render PDF → page images
    Indexer->>MongoDB: Store pages with images
    Indexer-->>User: Socket.io progress update
    Indexer->>OpenAI: Analyze page images
    OpenAI->>Indexer: Structured metadata
    Indexer->>MongoDB: Store analyses
    Indexer->>OpenAI: Generate embeddings
    OpenAI->>Indexer: Vectors
    Indexer->>MongoDB: Store embeddings
    Indexer->>OpenAI: Synthesize ontology
    OpenAI->>Indexer: Entity/relation types
    Indexer->>MongoDB: Store ontology
    Indexer->>MongoDB: Update status to "ready"
    Indexer-->>User: Socket.io completion event
```

---

## Core Concepts

### Workspace

The primary organizational unit. Contains:
- Documents (PDFs)
- Pages (rendered images + AI analysis)
- Ontology (knowledge graph structure)
- Chat sessions
- Member permissions (owner + viewers)

### Document

A PDF file uploaded by user or fetched from URL. Stored as base64 in MongoDB.

### Page

A single page from a document, consisting of:
- **Image**: 150 DPI JPEG (base64, ~100-200 KB)
- **Analysis**: AI-extracted metadata:
  - Summary (2-3 sentences)
  - Topics (keywords)
  - Anchors (visual elements with bounding boxes)
  - Entities (people, places, things)
  - Relations (connections between entities)
- **Embedding**: 1536-dimensional vector for semantic search

### Ontology

Workspace-wide knowledge graph structure:
- **Entity Types**: Categories of things (e.g., "Transformer", "Person")
- **Relation Types**: Types of connections (e.g., "protects", "reports_to")
- **Aliases**: Normalized names for similar terms

---

## Technology Stack

### Frontend
- **Next.js 14+** (App Router)
- **React 18+**
- **TypeScript**
- **Tailwind CSS**
- **Socket.io Client**

### Backend
- **Node.js 20+**
- **Express.js**
- **NextAuth** (Google OAuth)
- **Socket.io Server** (in Indexer)
- **MongoDB Node Driver**

### Infrastructure
- **MongoDB Atlas** (with Vector Search)
- **OpenAI API** (gpt-4o, text-embedding-3-small)

### Development Tools
- **TypeScript**
- **ESLint** + **Prettier**
- **Zod** (runtime validation)
- **Jest** (testing)

---

## Project Structure

```
/
├── apps/
│   ├── web/                 # Next.js web app
│   │   ├── app/             # Next.js app router
│   │   ├── components/      # React components
│   │   ├── lib/             # Utilities, auth, DB
│   │   └── public/          # Static assets
│   │
│   └── indexer/             # Node.js indexer service
│       ├── src/
│       │   ├── jobs/        # Indexing pipeline
│       │   ├── lib/         # AI, PDF, DB utilities
│       │   ├── server.js    # Express + Socket.io
│       │   └── worker.js    # Job consumer
│       └── package.json
│
├── shared/                  # Shared types and contracts
│   ├── types.ts             # TypeScript interfaces
│   ├── contracts.ts         # Zod validators
│   └── socket-events.ts     # Socket.io event types
│
├── docs/
│   └── specs/               # Full specification documents
│       ├── 00-overview.md
│       ├── 01-data-models.md
│       ├── 02-architecture.md
│       ├── 03-auth-permissions.md
│       ├── 04-indexing-pipeline.md
│       ├── 05-realtime.md
│       ├── 06-search-retrieval.md
│       ├── 07-chat-system.md
│       ├── 08-api-contracts.md
│       ├── 09-ui-routes.md
│       ├── 10-deployment.md
│       └── 11-implementation-plan.md
│
└── package.json             # Monorepo root
```

---

## Getting Started

### Prerequisites

- **Node.js 20+** and npm/pnpm
- **MongoDB Atlas account** (free tier works)
- **OpenAI API key**
- **Google OAuth credentials**

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/trace.git
cd trace

# Install dependencies
npm install

# Set up environment variables
cp apps/web/.env.example apps/web/.env.local
cp apps/indexer/.env.example apps/indexer/.env

# Edit .env files with your credentials
```

### Environment Variables

**Web App** (`apps/web/.env.local`):
```bash
# NextAuth
NEXTAUTH_SECRET=your-random-secret
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# MongoDB
MONGODB_URI=mongodb+srv://...

# Indexer Service
INDEXER_SERVICE_URL=http://localhost:3001
INDEXER_SERVICE_TOKEN=your-shared-secret

# Public (exposed to browser)
NEXT_PUBLIC_INDEXER_URL=http://localhost:3001
```

**Indexer Service** (`apps/indexer/.env`):
```bash
# MongoDB
MONGODB_URI=mongodb+srv://...

# OpenAI
OPENAI_API_KEY=sk-...

# Service Auth
INDEXER_SERVICE_TOKEN=your-shared-secret

# NextAuth (for Socket.io auth)
NEXTAUTH_SECRET=your-random-secret
NEXTAUTH_URL=http://localhost:3000

# Web App URL (for CORS)
WEB_APP_URL=http://localhost:3000

# Server
PORT=3001
```

### Running Locally

```bash
# Terminal 1: Start web app
cd apps/web
npm run dev

# Terminal 2: Start indexer service
cd apps/indexer
npm run dev

# Visit http://localhost:3000
```

### MongoDB Setup

1. Create MongoDB Atlas cluster (free tier)
2. Create database: `trace`
3. Whitelist your IP address
4. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/trace?retryWrites=true&w=majority`

**Note**: Text search indexes are automatically created on first search. No manual setup required!

**Optional**: For vector search (Phase 5), create vector search index on `pages` collection:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    }
  ]
}
```

---

## Usage Flow

1. **Sign In**: Authenticate with Google
2. **Create Workspace**: Name and describe your workspace
3. **Upload Documents**: Add PDFs (upload or URL)
4. **Trigger Indexing**: Process documents with AI
5. **Wait for Completion**: Watch real-time progress (~30s per page)
6. **Search & Explore**: Find relevant pages by meaning
7. **Chat**: Ask questions and get answers with citations
8. **Share**: Invite viewers to collaborate

---

## Documentation

### Specification Documents

- [00-overview.md](docs/specs/00-overview.md) - System overview and design decisions
- [01-data-models.md](docs/specs/01-data-models.md) - MongoDB schemas
- [02-architecture.md](docs/specs/02-architecture.md) - System architecture and components
- [03-auth-permissions.md](docs/specs/03-auth-permissions.md) - Authentication and authorization
- [04-indexing-pipeline.md](docs/specs/04-indexing-pipeline.md) - PDF processing and AI analysis
- [05-realtime.md](docs/specs/05-realtime.md) - Socket.io design
- [06-search-retrieval.md](docs/specs/06-search-retrieval.md) - Hybrid search implementation
- [07-chat-system.md](docs/specs/07-chat-system.md) - AI chat assistant
- [08-api-contracts.md](docs/specs/08-api-contracts.md) - REST API endpoints
- [09-ui-routes.md](docs/specs/09-ui-routes.md) - Frontend routes and screens
- [10-deployment.md](docs/specs/10-deployment.md) - Deployment guide
- [11-implementation-plan.md](docs/specs/11-implementation-plan.md) - Build phases

### Quick Reference

See [QUICK-REFERENCE.md](docs/QUICK-REFERENCE.md) for:
- Common queries
- Troubleshooting
- FAQ

---

## Development

### Running Tests

```bash
# Web app tests
cd apps/web
npm test

# Indexer tests
cd apps/indexer
npm test
```

### Code Style

```bash
# Lint
npm run lint

# Format
npm run format
```

### Git Workflow

- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - Feature branches

---

## Deployment

### Production Checklist

- [ ] Set up MongoDB Atlas production cluster
- [ ] Enable MongoDB Vector Search
- [ ] Configure Google OAuth production credentials
- [ ] Set production environment variables
- [ ] Deploy Web App (Vercel, Railway, etc.)
- [ ] Deploy Indexer Service (Railway, Render, etc.)
- [ ] Configure CORS for Socket.io
- [ ] Set up monitoring (Sentry, DataDog, etc.)

See [10-deployment.md](docs/specs/10-deployment.md) for detailed deployment guide.

---

## Roadmap

### v1.0 (Current)
- ✅ Core indexing pipeline
- ✅ Hybrid search
- ✅ AI chat with tool calling
- ✅ Workspace sharing
- ✅ Real-time progress updates

### v1.1 (Planned)
- [ ] Streaming chat responses
- [ ] Advanced filters (by topic, entity type)
- [ ] Bounding box visualization
- [ ] Export search results

### v2.0 (Future)
- [ ] Graph traversal ("Trace mode")
- [ ] Graph visualization
- [ ] Multi-hop reasoning
- [ ] Collaboration features (annotations, comments)
- [ ] Mobile app

---

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

---

## License

MIT License - see [LICENSE](LICENSE) for details

---

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/trace/issues)
- **Documentation**: [docs/specs/](docs/specs/)
- **Email**: support@trace.example.com

---

## Acknowledgments

Built with:
- [Next.js](https://nextjs.org/)
- [OpenAI API](https://openai.com/)
- [MongoDB Atlas](https://www.mongodb.com/atlas)
- [Socket.io](https://socket.io/)
- [NextAuth](https://next-auth.js.org/)

---

**Ready to trace the connections?** 🔍✨
