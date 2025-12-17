"use client"

import { useEffect, useState } from "react"
import { connectSocket, disconnectSocket, joinWorkspace, getSocket } from "@/lib/socket"

interface SocketTestProps {
  workspaceId: string
}

export default function SocketTest({ workspaceId }: SocketTestProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isJoined, setIsJoined] = useState(false)
  const [events, setEvents] = useState<string[]>([])

  useEffect(() => {
    const socket = getSocket()

    const handleConnect = () => {
      setIsConnected(true)
      addEvent("✅ Connected to Indexer")
    }

    const handleDisconnect = () => {
      setIsConnected(false)
      setIsJoined(false)
      addEvent("❌ Disconnected from Indexer")
    }

    const handleWorkspaceJoined = ({ workspaceId }: any) => {
      setIsJoined(true)
      addEvent(`✅ Joined workspace: ${workspaceId}`)
    }

    const handleIndexProgress = (data: any) => {
      addEvent(`📊 Index Progress: ${data.phase} - ${data.pagesDone}/${data.pagesTotal} pages`)
    }

    const handleIndexComplete = (data: any) => {
      addEvent(`🎉 Index Complete: ${data.pageCount} pages indexed`)
    }

    const handleIndexError = (data: any) => {
      addEvent(`❌ Index Error: ${data.error}`)
    }

    socket.on("connect", handleConnect)
    socket.on("disconnect", handleDisconnect)
    socket.on("workspace:joined", handleWorkspaceJoined)
    socket.on("index:progress", handleIndexProgress)
    socket.on("index:complete", handleIndexComplete)
    socket.on("index:error", handleIndexError)

    // Auto-connect on mount
    connectSocket()

    // Try to join workspace if already connected
    if (socket.connected) {
      joinWorkspace(workspaceId).catch((err) => {
        addEvent(`❌ Failed to join workspace: ${err.message}`)
      })
    }

    return () => {
      socket.off("connect", handleConnect)
      socket.off("disconnect", handleDisconnect)
      socket.off("workspace:joined", handleWorkspaceJoined)
      socket.off("index:progress", handleIndexProgress)
      socket.off("index:complete", handleIndexComplete)
      socket.off("index:error", handleIndexError)
      disconnectSocket()
    }
  }, [workspaceId])

  const addEvent = (event: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setEvents((prev) => [`[${timestamp}] ${event}`, ...prev].slice(0, 10))
  }

  const handleJoinWorkspace = async () => {
    try {
      await joinWorkspace(workspaceId)
    } catch (err: any) {
      addEvent(`❌ Failed to join: ${err.message}`)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold mb-3">Socket.io Connection Status</h3>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>
          <span className="text-sm">
            {isConnected ? "Connected to Indexer" : "Disconnected"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isJoined ? "bg-green-500" : "bg-gray-400"}`}></div>
          <span className="text-sm">
            {isJoined ? "Joined workspace room" : "Not in workspace room"}
          </span>
        </div>
      </div>

      {isConnected && !isJoined && (
        <button
          onClick={handleJoinWorkspace}
          className="mb-4 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Join Workspace
        </button>
      )}

      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <h4 className="text-xs font-semibold mb-2 text-gray-600 dark:text-gray-400">
          Recent Events:
        </h4>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-xs text-gray-500">No events yet</p>
          ) : (
            events.map((event, i) => (
              <div key={i} className="text-xs font-mono text-gray-600 dark:text-gray-400">
                {event}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

