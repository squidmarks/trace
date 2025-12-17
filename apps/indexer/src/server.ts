import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import cors from "cors"
import dotenv from "dotenv"
import healthRouter from "./routes/health.js"
import jobsRouter from "./routes/jobs.js"
import { socketAuthMiddleware, verifyWorkspaceAccess } from "./lib/auth.js"

// Load environment variables
dotenv.config()

const PORT = process.env.PORT || 3001
const WEB_APP_URL = process.env.WEB_APP_URL || "http://localhost:3000"

// Create Express app
const app = express()

// Middleware
app.use(express.json({ limit: "50mb" })) // Support large PDF uploads
app.use(
  cors({
    origin: WEB_APP_URL,
    credentials: true,
  })
)

// Routes
app.use(healthRouter)
app.use(jobsRouter)

// Create HTTP server
const httpServer = createServer(app)

// Create Socket.io server
const io = new Server(httpServer, {
  cors: {
    origin: WEB_APP_URL,
    credentials: true,
  },
})

// Socket.io authentication middleware
io.use(socketAuthMiddleware)

// Socket.io connection handling
io.on("connection", (socket) => {
  const userId = socket.data.userId
  console.log(`[Socket.io] User connected: ${userId}`)

  // Handle workspace room join
  socket.on("workspace:join", async ({ workspaceId }) => {
    try {
      // Verify user has access to workspace
      const hasAccess = await verifyWorkspaceAccess(workspaceId, userId)

      if (!hasAccess) {
        socket.emit("error", { message: "Access denied to workspace" })
        return
      }

      // Join workspace room
      socket.join(`workspace:${workspaceId}`)
      console.log(`[Socket.io] User ${userId} joined workspace:${workspaceId}`)

      // Confirm join
      socket.emit("workspace:joined", { workspaceId })
    } catch (error) {
      console.error("Error joining workspace:", error)
      socket.emit("error", { message: "Failed to join workspace" })
    }
  })

  // Handle workspace room leave
  socket.on("workspace:leave", ({ workspaceId }) => {
    socket.leave(`workspace:${workspaceId}`)
    console.log(`[Socket.io] User ${userId} left workspace:${workspaceId}`)
  })

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`[Socket.io] User disconnected: ${userId}`)
  })
})

// Export io for use in other modules
export { io }

// Start server
httpServer.listen(PORT, () => {
  console.log(`[Indexer] Server running on port ${PORT}`)
  console.log(`[Indexer] Accepting connections from: ${WEB_APP_URL}`)
})

