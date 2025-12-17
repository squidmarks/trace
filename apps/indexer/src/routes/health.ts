import { Router } from "express"

const router = Router()

const startTime = Date.now()

router.get("/health", (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000)

  res.json({
    status: "healthy",
    uptime,
    activeJobs: 0, // TODO: Track active jobs in Phase 2
    queuedJobs: 0, // TODO: Track queued jobs in Phase 2
    socketConnections: 0, // TODO: Track from Socket.io server
  })
})

export default router

