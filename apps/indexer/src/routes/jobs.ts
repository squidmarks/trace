import { Router } from "express"
import { ObjectId } from "mongodb"
import type { Server } from "socket.io"
import type { StartIndexJobRequest, StartIndexJobResponse } from "@trace/shared"
import { startIndexingJob } from "../lib/indexing-processor.js"
import { getIndexJobsCollection } from "../lib/db.js"
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
    startIndexingJob(
      body.workspaceId,
      io,
      {
        documentIds: body.documentIds,
        renderDpi: body.params?.renderDpi,
        renderQuality: body.params?.renderQuality,
        analysisModel: body.params?.analysisModel,
      }
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

/**
 * POST /jobs/:workspaceId/abort
 * Abort an in-progress indexing job for a workspace
 */
router.post("/jobs/:workspaceId/abort", verifyServiceToken, async (req, res) => {
  try {
    const { workspaceId } = req.params

    if (!workspaceId) {
      return res.status(400).json({ error: "workspaceId is required" })
    }

    logger.info(`🛑 Abort requested: workspace=${workspaceId}`)

    const indexJobs = await getIndexJobsCollection()

    // Find active job for this workspace
    const activeJob = await indexJobs.findOne({
      workspaceId: new ObjectId(workspaceId),
      status: "in-progress",
    })

    if (!activeJob) {
      logger.warn(`   No active job found for workspace ${workspaceId}`)
      return res.status(404).json({ error: "No active job found" })
    }

    // Update job status to cancelled
    await indexJobs.updateOne(
      { _id: activeJob._id },
      {
        $set: {
          status: "cancelled",
          error: "Cancelled by user",
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    )

    logger.info(`   ✅ Job ${activeJob._id} marked as cancelled`)

    // Emit cancellation event to UI
    io.to(`workspace:${workspaceId}`).emit("index:error", {
      workspaceId,
      error: "Indexing cancelled by user",
    })

    res.status(200).json({ status: "cancelled" })
  } catch (error) {
    logger.error("❌ Error aborting job:", error)
    res.status(500).json({ error: "Failed to abort job" })
  }
})

export default router
