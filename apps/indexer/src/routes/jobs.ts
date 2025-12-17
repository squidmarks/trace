import { Router } from "express"
import type { StartIndexJobRequest, StartIndexJobResponse } from "@trace/shared"
import logger from "../lib/logger.js"

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

    // TODO: Phase 2 - Queue the indexing job
    logger.warn(`⚠️  [STUB] Would start indexing job for workspace: ${body.workspaceId}`)
    logger.info("   (Actual indexing implementation coming in Phase 2)")

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

