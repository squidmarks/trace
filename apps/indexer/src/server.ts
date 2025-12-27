// Load environment variables FIRST (before any other imports)
import "./env.js"

import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import { ObjectId } from "mongodb"
import cors from "cors"
import healthRouter from "./routes/health.js"
import jobsRouter, { setSocketIo } from "./routes/jobs.js"
import toolsRouter from "./routes/tools.js"
import { socketAuthMiddleware, verifyWorkspaceAccess } from "./lib/auth.js"
import { resumeInProgressJobs } from "./lib/indexing-processor.js"
import { getIndexJobsCollection, getPagesCollection } from "./lib/db.js"
import logger from "./lib/logger.js"

const PORT = process.env.PORT || 3001
const WEB_APP_URL = process.env.WEB_APP_URL || "http://localhost:3000"

logger.info("🚀 Starting Indexer Service...")
logger.info(`📋 Configuration:`)
logger.info(`   - Port: ${PORT}`)
logger.info(`   - Web App URL: ${WEB_APP_URL}`)
logger.info(`   - MongoDB: ${process.env.MONGODB_URI?.split("@")[1]?.split("/")[0] || "connected"}`)
logger.info(`   - Node: ${process.version}`)

// Create Express app
const app = express()

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now()
  res.on("finish", () => {
    const duration = Date.now() - start
    logger.api(req.method, req.path, res.statusCode, duration)
  })
  next()
})

// Middleware
app.use(express.json({ limit: "100mb" })) // Support large PDF uploads
logger.info("📦 Body parser: 100MB limit")

app.use(
  cors({
    origin: WEB_APP_URL,
    credentials: true,
  })
)
logger.info(`🔒 CORS enabled for: ${WEB_APP_URL}`)

// Routes
app.use(healthRouter)
app.use(jobsRouter)
app.use("/tools", toolsRouter)
logger.info("📍 Routes registered: /health, /jobs/start, /tools/searchPages, /tools/getPage")

// Create HTTP server
const httpServer = createServer(app)

// Create Socket.io server
const io = new Server(httpServer, {
  cors: {
    origin: WEB_APP_URL,
    credentials: true,
  },
})

// Pass Socket.io instance to routes
setSocketIo(io)

// Socket.io authentication middleware
io.use(socketAuthMiddleware)

// Socket.io connection handling
io.on("connection", (socket) => {
  const userId = socket.data.userId
  logger.socket(`✅ User connected: ${userId} (socket: ${socket.id})`)

  // Handle workspace room join
  socket.on("workspace:join", async ({ workspaceId }) => {
    logger.socket(`📥 Join request: workspace=${workspaceId}, user=${userId}`)
    
    try {
      // Verify user has access to workspace
      const hasAccess = await verifyWorkspaceAccess(workspaceId, userId)

      if (!hasAccess) {
        logger.warn(`🚫 Access denied: user=${userId}, workspace=${workspaceId}`)
        socket.emit("error", { message: "Access denied to workspace" })
        return
      }

      // Join workspace room
      socket.join(`workspace:${workspaceId}`)
      const roomSize = io.sockets.adapter.rooms.get(`workspace:${workspaceId}`)?.size || 0
      logger.socket(
        `✅ User joined room: user=${userId}, workspace=${workspaceId}, roomSize=${roomSize}`
      )

      // Confirm join
      socket.emit("workspace:joined", { workspaceId })

      // Check for active indexing job and send current state
      const indexJobs = await getIndexJobsCollection()
      const activeJob = await indexJobs.findOne({ 
        workspaceId: new ObjectId(workspaceId),
        status: "in-progress"
      })

      if (activeJob) {
        logger.socket(`📤 Sending current job state to newly joined user`)
        
        // Determine appropriate message based on progress
        let message = "Resuming indexing..."
        if (activeJob.progress.analyzedPages > 0 && activeJob.progress.analyzedPages < activeJob.progress.totalPages) {
          message = `Analyzing document... (${activeJob.progress.analyzedPages}/${activeJob.progress.totalPages} pages)`
        } else if (activeJob.progress.processedPages > 0 && activeJob.progress.processedPages < activeJob.progress.totalPages) {
          message = `Parsing document... (${activeJob.progress.processedPages}/${activeJob.progress.totalPages} pages)`
        }
        
        // Send current progress immediately to this socket
        socket.emit("index:progress", {
          workspaceId,
          phase: "processing",
          totalDocuments: activeJob.progress.totalDocuments,
          processedDocuments: activeJob.progress.processedDocuments,
          totalPages: activeJob.progress.totalPages,
          processedPages: activeJob.progress.processedPages,
          analyzedPages: activeJob.progress.analyzedPages,
          message,
        })
      }
    } catch (error) {
      logger.error("❌ Error joining workspace:", error)
      socket.emit("error", { message: "Failed to join workspace" })
    }
  })

  // Handle workspace room leave
  socket.on("workspace:leave", ({ workspaceId }) => {
    socket.leave(`workspace:${workspaceId}`)
    logger.socket(`👋 User left room: user=${userId}, workspace=${workspaceId}`)
  })

  // Handle index start request
  socket.on("index:start", async ({ workspaceId, documentIds, params }) => {
    logger.socket(`📋 Index start request: workspace=${workspaceId}, user=${userId}`)
    
    try {
      // Verify user has access to workspace (already verified in join, but double-check)
      const hasAccess = await verifyWorkspaceAccess(workspaceId, userId)

      if (!hasAccess) {
        logger.warn(`🚫 Access denied for index: user=${userId}, workspace=${workspaceId}`)
        socket.emit("error", { message: "Access denied to workspace" })
        return
      }

      // Fetch workspace to get config
      const { getWorkspacesCollection } = await import("./lib/db.js")
      const workspaces = await getWorkspacesCollection()
      const workspace = await workspaces.findOne({ _id: new ObjectId(workspaceId) })

      // Import startIndexingJob dynamically to avoid circular dependency
      const { startIndexingJob } = await import("./lib/indexing-processor.js")
      
      // Start indexing job with workspace config if available
      startIndexingJob(workspaceId, io, {
        documentIds,
        renderDpi: params?.renderDpi || workspace?.config?.indexing?.renderDpi,
        renderQuality: params?.renderQuality || workspace?.config?.indexing?.renderQuality,
        analysisModel: params?.analysisModel || workspace?.config?.indexing?.analysisModel,
        analysisDetail: params?.analysisDetail || workspace?.config?.indexing?.analysisDetail,
        customAnalysisPrompt: workspace?.config?.indexing?.customAnalysisPrompt,
      }).catch((error) => {
        logger.error(`❌ Indexing job failed for workspace ${workspaceId}:`, error)
      })

      // Confirm start
      socket.emit("index:started", { workspaceId })
      logger.socket(`✅ Index started: workspace=${workspaceId}`)
    } catch (error: any) {
      logger.error("❌ Error starting index:", error)
      socket.emit("error", { message: error.message || "Failed to start indexing" })
    }
  })

  // Handle index abort request
  socket.on("index:abort", async ({ workspaceId }) => {
    logger.socket(`🛑 Index abort request: workspace=${workspaceId}, user=${userId}`)
    
    try {
      // Verify user has access to workspace
      const hasAccess = await verifyWorkspaceAccess(workspaceId, userId)

      if (!hasAccess) {
        logger.warn(`🚫 Access denied for abort: user=${userId}, workspace=${workspaceId}`)
        socket.emit("error", { message: "Access denied to workspace" })
        return
      }

      // Import abortIndexingJob dynamically to avoid circular dependency
      const { abortIndexingJob } = await import("./lib/indexing-processor.js")
      
      // Abort indexing job
      await abortIndexingJob(workspaceId, io)

      logger.socket(`✅ Index aborted: workspace=${workspaceId}`)
    } catch (error: any) {
      logger.error("❌ Error aborting index:", error)
      socket.emit("error", { message: error.message || "Failed to abort indexing" })
    }
  })

  // Handle disconnect
  socket.on("disconnect", () => {
    logger.socket(`❌ User disconnected: ${userId} (socket: ${socket.id})`)
  })
})

// Export io for use in other modules
export { io }

// Ensure database indexes exist
async function ensureIndexes() {
  try {
    const pages = await getPagesCollection()
    
    // Create text index on searchable fields for full-text search
    await pages.createIndex(
      {
        "analysis.summary": "text",
        "analysis.topics": "text",
        "analysis.entities.text": "text",
      },
      {
        name: "pages_text_search",
        weights: {
          "analysis.summary": 10,
          "analysis.topics": 5,
          "analysis.entities.text": 3,
        },
      }
    )
    
    logger.success("✅ Database indexes verified")
  } catch (error: any) {
    logger.warn(`⚠️ Error ensuring indexes: ${error.message}`)
  }
}

// Start server
httpServer.listen(PORT, async () => {
  logger.success(`🎉 Indexer Service ready!`)
  logger.success(`🌐 HTTP Server: http://localhost:${PORT}`)
  logger.success(`⚡ Socket.io Server: ws://localhost:${PORT}`)
  logger.info(`📡 Waiting for connections...`)
  logger.info("")

  // Ensure database indexes
  await ensureIndexes()

  // Resume any in-progress jobs
  resumeInProgressJobs(io).catch((error) => {
    logger.error(`Failed to resume jobs: ${error.message}`)
  })
})

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`\n${signal} received, shutting down gracefully...`)
  
  // Close HTTP server
  httpServer.close(() => {
    logger.info("HTTP server closed")
  })

  // Close Socket.io connections
  io.close(() => {
    logger.info("Socket.io server closed")
  })

  // Close MongoDB connection
  const { closeDatabase } = await import("./lib/db")
  await closeDatabase()

  logger.info("Shutdown complete")
  process.exit(0)
}

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
process.on("SIGINT", () => gracefulShutdown("SIGINT"))

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error)
  gracefulShutdown("UNCAUGHT_EXCEPTION")
})

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason)
  gracefulShutdown("UNHANDLED_REJECTION")
})

