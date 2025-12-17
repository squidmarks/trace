# 10 - Deployment & Operations

This document describes deployment configurations, environment variables, scaling considerations, and operational concerns.

## Environment Variables

### Web App

```bash
# Node Environment
NODE_ENV=production                      # production | development
PORT=3000                                # Server port

# NextAuth Configuration
NEXTAUTH_URL=https://trace.example.com   # Public URL
NEXTAUTH_SECRET=<random-32-char-hex>     # Generate with: openssl rand -hex 32

# Google OAuth
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>

# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/trace?retryWrites=true&w=majority

# Indexer Integration
INDEXER_BASE_URL=http://indexer:4000    # Internal URL to Indexer service
INDEXER_SERVICE_TOKEN=<shared-secret>   # Web → Indexer auth

# OpenAI
OPENAI_API_KEY=sk-...                    # For chat completions

# Logging
LOG_LEVEL=info                           # error | warn | info | debug
```

### Indexer Service

```bash
# Node Environment
NODE_ENV=production
PORT=4000

# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/trace?retryWrites=true&w=majority

# NextAuth (for validating browser sessions)
NEXTAUTH_SECRET=<same-as-web>            # Required to validate JWTs

# Web App
WEB_APP_URL=https://trace.example.com    # For CORS configuration

# OpenAI
OPENAI_API_KEY=sk-...                    # For analysis and embeddings

# Service Token
INDEXER_SERVICE_TOKEN=<shared-secret>    # Web → Indexer auth

# Concurrency Controls
MAX_CONCURRENT_DOCUMENTS=3               # Max documents processed in parallel
MAX_CONCURRENT_PAGES=5                   # Max pages analyzed in parallel
MAX_CONCURRENT_API_CALLS=10              # Max OpenAI API calls in parallel

# Rate Limiting
OPENAI_RATE_LIMIT_RPM=3000               # Requests per minute
OPENAI_RATE_LIMIT_TPM=250000             # Tokens per minute

# Job Polling (if not using queue)
JOB_POLL_INTERVAL_MS=5000                # How often to check for new jobs

# Logging
LOG_LEVEL=info
```

## Deployment Architectures

### Development (Local)

**Components**:
- Web: `localhost:3000` (Next.js)
- Indexer: `localhost:4000` (Node.js + Socket.io)
- MongoDB: Local instance or Atlas free tier

**Start Commands**:

```bash
# Terminal 1: Web
cd web
npm install
npm run dev

# Terminal 2: Indexer
cd indexer
npm install
npm run dev

# Terminal 3: MongoDB (if local)
mongod --dbpath ./data
```

**Browser Connections**:
- REST API: `http://localhost:3000/api/*`
- Socket.io: `http://localhost:4000` (direct to Indexer)

### Production (Single Server - Small Scale)

**Infrastructure**:
- 1x VPS (e.g., DigitalOcean Droplet, AWS EC2)
  - 4 CPU cores
  - 8 GB RAM
  - 100 GB SSD
- MongoDB Atlas (shared cluster)
- Nginx reverse proxy
- SSL via Let's Encrypt

**Architecture**:

```
                    ┌──────────────┐
                    │  Nginx       │
                    │  (SSL, proxy)│
                    └──────┬───────┘
                           │
             ┌─────────────┴─────────────┐
             │                           │
      ┌──────▼──────┐           ┌───────▼──────┐
      │  Web App    │           │  MongoDB     │
      │  (Port 3000)│───────────│  Atlas       │
      └─────────────┘           └──────────────┘
             │
      ┌──────▼──────┐
      │  Indexer    │
      │  (Port 4000)│◄──────────────Browser Socket.io
      │  + Socket.io│
      └─────────────┘
```

**Nginx Configuration**:

```nginx
server {
    listen 80;
    server_name trace.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name trace.example.com;

    ssl_certificate /etc/letsencrypt/live/trace.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/trace.example.com/privkey.pem;

    # Next.js app (REST API)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    # Indexer Socket.io (direct browser connection)
    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**Process Management (PM2)**:

```bash
# Install PM2
npm install -g pm2

# Start Web app
cd web
pm2 start npm --name "trace-web" -- start

# Start Indexer
cd indexer
pm2 start npm --name "trace-indexer" -- start

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
```

**PM2 Ecosystem File**:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'trace-web',
      cwd: './web',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1
    },
    {
      name: 'trace-indexer',
      cwd: './indexer',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      instances: 1
    }
  ]
}
```

### Production (Scaled - High Traffic)

**Infrastructure**:
- 3x Web servers (horizontal scaling)
- 2x Indexer workers
- Load balancer (AWS ALB, DigitalOcean LB, etc.)
- Redis cluster (for Socket.io adapter)
- MongoDB Atlas (dedicated cluster)

**Architecture**:

```
                    ┌──────────────┐
                    │Load Balancer │
                    └──────┬───────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐       ┌────▼────┐      ┌────▼────┐
    │ Web 1   │       │ Web 2   │      │ Web 3   │
    └────┬────┘       └────┬────┘      └────┬────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
                      ┌────▼────────┐
                      │MongoDB Atlas│
                      └────┬────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐       ┌────▼────┐      ┌────▼────┐
    │Indexer 1│       │Indexer 2│      │ Redis   │
    │+Socket  │       │+Socket  │      │ Cluster │
    └─────────┘       └─────────┘      └─────────┘
```

**Redis Adapter for Socket.io (Indexer)**:

```typescript
// indexer/src/server.ts
import { createAdapter } from "@socket.io/redis-adapter"
import { createClient } from "redis"

if (process.env.REDIS_URL) {
  const pubClient = createClient({ url: process.env.REDIS_URL })
  const subClient = pubClient.duplicate()

  await Promise.all([pubClient.connect(), subClient.connect()])

  io.adapter(createAdapter(pubClient, subClient))
  console.log("Socket.io using Redis adapter for multi-instance support")
}
```

**Load Balancer Configuration**:
- Sticky sessions: **Not required** for REST API (stateless)
- WebSocket support: **Required** for Socket.io to Indexer
- Health checks:
  - Web: `GET /api/health` → 200 OK
  - Indexer: `GET /health` → 200 OK
- Protocol: HTTP (LB handles SSL termination)

### Docker Deployment (Optional)

**Web Dockerfile**:

```dockerfile
# web/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app
COPY . .

# Build Next.js app
RUN npm run build

# Expose port
EXPOSE 3000

# Start
CMD ["npm", "start"]
```

**Indexer Dockerfile**:

```dockerfile
# indexer/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app
COPY . .

# Expose port
EXPOSE 4000

# Start
CMD ["npm", "start"]
```

**Docker Compose** (for development):

```yaml
# docker-compose.yml
version: '3.8'

services:
  web:
    build: ./web
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb://mongo:27017/trace
      - INDEXER_BASE_URL=http://indexer:4000
      - NEXT_PUBLIC_INDEXER_URL=http://localhost:4000
    depends_on:
      - mongo
      - indexer

  indexer:
    build: ./indexer
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb://mongo:27017/trace
      - WEB_APP_URL=http://localhost:3000

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

volumes:
  mongo-data:
```

## MongoDB Configuration

### Atlas Setup

1. Create Atlas account
2. Create cluster (M10+ recommended for production)
3. Enable **Atlas Vector Search**:
   - Navigate to cluster → Search
   - Create index: `page_embeddings` (see [06-search-retrieval.md](06-search-retrieval.md))
4. Network access:
   - Allow Web and Indexer IPs
   - Or use VPC peering (AWS/GCP)
5. Database user:
   - Create user with `readWrite` role on `trace` database
6. Connection string:
   - Use DNS SRV format: `mongodb+srv://...`

### Indexes

Ensure these indexes exist:

```typescript
// Run once on deployment
db.collection("users").createIndex({ googleId: 1 }, { unique: true })
db.collection("users").createIndex({ email: 1 }, { unique: true })

db.collection("workspaces").createIndex({ ownerId: 1 })
db.collection("workspaces").createIndex({ "members.userId": 1 })

db.collection("documents").createIndex({ workspaceId: 1 })
db.collection("documents").createIndex({ pdfHash: 1 })

db.collection("pages").createIndex(
  { workspaceId: 1, documentId: 1, pageNumber: 1 },
  { unique: true }
)
db.collection("pages").createIndex({ workspaceId: 1 })

db.collection("pages").createIndex(
  {
    "analysis.summary": "text",
    "analysis.topics": "text",
    "analysis.entities.value": "text"
  },
  {
    name: "page_text_search",
    weights: {
      "analysis.summary": 5,
      "analysis.topics": 3,
      "analysis.entities.value": 2
    }
  }
)

db.collection("ontologies").createIndex({ workspaceId: 1 }, { unique: true })

db.collection("chatSessions").createIndex({ workspaceId: 1, userId: 1 })
```

## OpenAI Configuration

### API Keys

- **Web**: Needs access for chat completions and query embeddings (search)
- **Indexer**: Needs access for page analysis, embeddings, and ontology generation

**Best practice**: Use separate API keys for Web and Indexer for cost tracking and rate limit isolation.

### Rate Limits

OpenAI enforces rate limits by organization:

**Tier 1** (typical):
- 3,000 RPM (requests per minute)
- 250,000 TPM (tokens per minute)

**Tier 2** (after spending $50+):
- 10,000 RPM
- 2,000,000 TPM

### Indexer Throttling

Respect rate limits to avoid 429 errors:

```typescript
// indexer/src/throttle.ts
import pLimit from "p-limit"

const analysisLimit = pLimit(parseInt(process.env.MAX_CONCURRENT_API_CALLS || "10"))
const embeddingLimit = pLimit(20) // Embeddings are cheaper, can be more concurrent

export async function analyzePageThrottled(page: any) {
  return analysisLimit(() => analyzePage(page))
}

export async function generateEmbeddingThrottled(text: string) {
  return embeddingLimit(() => generateEmbedding(text))
}
```

## Monitoring

### Health Checks

**Web**:

```typescript
// pages/api/health.ts
export default async function handler(req, res) {
  const health = {
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }
  
  // Check MongoDB connection
  try {
    const db = await getDb()
    await db.admin().ping()
    health.mongodb = "connected"
  } catch (err) {
    health.mongodb = "disconnected"
    health.status = "unhealthy"
  }
  
  res.status(health.status === "healthy" ? 200 : 503).json(health)
}
```

**Indexer**:

```typescript
// src/routes/health.ts
app.get("/health", async (req, res) => {
  const health = {
    status: "healthy",
    uptime: process.uptime(),
    activeJobs: getActiveJobCount(),
    queuedJobs: await getQueuedJobCount(),
    socketConnections: io.engine.clientsCount
  }
  
  res.json(health)
})
```

### Logging

**Structured logging** with Winston:

```typescript
// lib/logger.ts
import winston from "winston"

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" })
  ]
})
```

**Usage**:

```typescript
logger.info("Indexing started", { workspaceId })
logger.error("Page analysis failed", { pageId, error: err.message })
```

### Metrics (Future)

Integrate with Prometheus/Grafana:

- **Web metrics**: Request latency, error rates, active sessions
- **Indexer metrics**: Jobs processed, pages analyzed, API call latency, Socket.io connections
- **MongoDB metrics**: Query latency, connection pool usage
- **OpenAI metrics**: Token usage, cost, rate limit hits

## Backup & Recovery

### MongoDB Backups

**Atlas**: Automatic backups enabled by default
- Continuous backups (point-in-time recovery)
- Snapshot retention: 7 days (configurable)

**Manual backup**:

```bash
# Export entire database
mongodump --uri="$MONGODB_URI" --out=./backup

# Restore
mongorestore --uri="$MONGODB_URI" --dir=./backup
```

### Disaster Recovery

**RTO** (Recovery Time Objective): 1 hour
**RPO** (Recovery Point Objective): 15 minutes (Atlas backup frequency)

**Recovery steps**:
1. Provision new infrastructure
2. Restore MongoDB from Atlas backup
3. Deploy Web and Indexer from Git
4. Configure environment variables
5. Verify health checks
6. Update DNS

## Security

### SSL/TLS

- **Production**: HTTPS required for all traffic
- Use Let's Encrypt for free SSL certificates
- Nginx handles SSL termination

### Secrets Management

**Development**: `.env` files (gitignored)

**Production**: Use secrets manager
- AWS Secrets Manager
- HashiCorp Vault
- Or encrypted environment variables

### Network Security

- **Web ↔ Indexer**: Internal network (INDEXER_SERVICE_TOKEN for auth)
- **Browser ↔ Indexer (Socket.io)**: Public (validates NextAuth session)
- **MongoDB**: IP allowlist or VPC peering
- **OpenAI**: API key rotation every 90 days

### Input Validation

All API endpoints use Zod for request validation:

```typescript
import { z } from "zod"

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional()
})

// In API route
const body = createWorkspaceSchema.parse(req.body)
```

## Cost Estimation

### OpenAI Costs

**Assumptions**:
- 100 pages indexed per day
- 50 chat messages per day

**Indexing** (per 100 pages):
- Analysis: 100 pages × 4,000 tokens × $0.0025/1k = $1.00
- Embeddings: 100 pages × 500 tokens × $0.00002/1k = $0.001
- **Total**: ~$1.00 per 100 pages

**Chat** (per 50 messages):
- Input: 50 × 1,000 tokens × $0.0025/1k = $0.125
- Output: 50 × 500 tokens × $0.01/1k = $0.25
- **Total**: ~$0.375 per 50 messages

**Monthly estimate** (100 pages/day, 50 messages/day):
- Indexing: $30/month
- Chat: $11.25/month
- **Total**: ~$41/month

### MongoDB Atlas Costs

- **M10 shared cluster**: $57/month (2 GB RAM, 10 GB storage)
- **M20 dedicated**: $134/month (4 GB RAM, 20 GB storage)

### Infrastructure Costs

**Single server** (DigitalOcean):
- 4 CPU, 8 GB RAM: $48/month

**Scaled** (3 web + 2 indexer):
- Web: 3 × $24/month = $72/month
- Indexer: 2 × $48/month = $96/month
- Load balancer: $12/month
- Redis: $15/month (managed)
- **Total**: ~$195/month

## Navigation

- **Previous**: [09-ui-routes.md](09-ui-routes.md)
- **Next**: [11-implementation-plan.md](11-implementation-plan.md)
- **Related**: [02-architecture.md](02-architecture.md) - System architecture
