import { io, Socket } from "socket.io-client"

let socket: Socket | null = null
let currentWorkspaceId: string | null = null

export function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_INDEXER_URL || "http://localhost:3001"
    
    socket = io(url, {
      withCredentials: true, // Send NextAuth cookie
      autoConnect: false, // Manual connection control
      reconnection: true, // Auto-reconnect on disconnect
      reconnectionAttempts: Infinity, // Keep trying forever
      reconnectionDelay: 1000, // Start with 1s delay
      reconnectionDelayMax: 5000, // Max 5s between attempts
      timeout: 10000, // 10s connection timeout
    })

    socket.on("connect", () => {
      console.log("[Socket.io] ✅ Connected to Indexer")
      // Note: Workspace rejoining is handled by the component
    })

    socket.on("disconnect", (reason) => {
      console.log(`[Socket.io] ❌ Disconnected: ${reason}`)
      
      if (reason === "io server disconnect") {
        // Server disconnected us, need to manually reconnect
        socket!.connect()
      }
      // Otherwise, auto-reconnection will handle it
    })

    socket.on("reconnect_attempt", (attemptNumber) => {
      console.log(`[Socket.io] 🔄 Reconnection attempt ${attemptNumber}...`)
    })

    socket.on("reconnect", (attemptNumber) => {
      console.log(`[Socket.io] ✅ Reconnected after ${attemptNumber} attempts`)
    })

    socket.on("reconnect_error", (error) => {
      console.error("[Socket.io] ❌ Reconnection error:", error.message)
    })

    socket.on("reconnect_failed", () => {
      console.error("[Socket.io] ❌ Reconnection failed - giving up")
    })

    socket.on("error", (error: any) => {
      console.error("[Socket.io] ❌ Error:", error)
    })
  }

  return socket
}

export function connectSocket(): void {
  const socket = getSocket()
  if (!socket.connected) {
    socket.connect()
  }
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect()
  }
}

export function joinWorkspace(workspaceId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = getSocket()
    
    // Remember current workspace for auto-rejoin on reconnect
    currentWorkspaceId = workspaceId

    const onJoined = () => {
      socket.off("workspace:joined", onJoined)
      socket.off("error", onError)
      console.log(`[Socket.io] ✅ Joined workspace: ${workspaceId}`)
      resolve()
    }

    const onError = (error: any) => {
      socket.off("workspace:joined", onJoined)
      socket.off("error", onError)
      console.error(`[Socket.io] ❌ Failed to join workspace: ${error.message}`)
      reject(new Error(error.message || "Failed to join workspace"))
    }

    socket.once("workspace:joined", onJoined)
    socket.once("error", onError)

    socket.emit("workspace:join", { workspaceId })
  })
}

export function leaveWorkspace(workspaceId: string): void {
  const socket = getSocket()
  
  // Clear current workspace
  if (currentWorkspaceId === workspaceId) {
    currentWorkspaceId = null
  }
  
  socket.emit("workspace:leave", { workspaceId })
  console.log(`[Socket.io] 👋 Left workspace: ${workspaceId}`)
}

export function getCurrentWorkspaceId(): string | null {
  return currentWorkspaceId
}

