// Load environment variables FIRST (before any other imports)
import "./env.js"

import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import cors from "cors"
import healthRouter from "./routes/health.js"
import jobsRouter, { setSocketIo } from "./routes/jobs.js"
import { socketAuthMiddleware, verifyWorkspaceAccess } from "./lib/auth.js"
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
logger.info("📍 Routes registered: /health, /jobs/start")

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

  // Handle disconnect
  socket.on("disconnect", () => {
    logger.socket(`❌ User disconnected: ${userId} (socket: ${socket.id})`)
  })
})

// Export io for use in other modules
export { io }

// Start server
httpServer.listen(PORT, () => {
  logger.success(`🎉 Indexer Service ready!`)
  logger.success(`🌐 HTTP Server: http://localhost:${PORT}`)
  logger.success(`⚡ Socket.io Server: ws://localhost:${PORT}`)
  logger.info(`📡 Waiting for connections...`)
  logger.info("")
})

