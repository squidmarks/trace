import { Router } from "express"
import type { Server } from "socket.io"
import type { StartIndexJobRequest, StartIndexJobResponse } from "@trace/shared"
import { processIndexJob } from "../lib/indexing-processor.js"
import logger from "../lib/logger.js"

// Store Socket.io instance (will be set by server.ts)
let io: Server

export function setSocketIo(socketIo: Server) {
  io = socketIo
}

const router = Router()

/**
 * Middleware to verify service token from Web app
 */
function verifyServiceToken(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" })
  }

  const token = authHeader.substring(7) // Remove "Bearer "

  if (token !== process.env.INDEXER_SERVICE_TOKEN) {
    return res.status(401).json({ error: "Invalid service token" })
  }

  next()
}

router.post("/jobs/start", verifyServiceToken, async (req, res) => {
  try {
    const body: StartIndexJobRequest = req.body

    if (!body.workspaceId) {
      logger.warn("❌ Job start failed: missing workspaceId")
      return res.status(400).json({ error: "workspaceId is required" })
    }

    logger.info(`📋 Job start requested: workspace=${body.workspaceId}`)
    if (body.params) {
      logger.debug("   Parameters:", body.params)
    }

    // Start indexing job in background (don't await)
    processIndexJob(
      {
        workspaceId: body.workspaceId,
        documentIds: body.documentIds,
        renderDpi: body.params?.renderDpi,
        renderQuality: body.params?.renderQuality,
      },
      io
    ).catch((error) => {
      logger.error(`❌ Indexing job failed for workspace ${body.workspaceId}:`, error)
    })

    const response: StartIndexJobResponse = {
      status: "queued",
    }

    res.status(202).json(response)
  } catch (error) {
    logger.error("❌ Error starting job:", error)
    res.status(500).json({ error: "Failed to start job" })
  }
})

export default router

