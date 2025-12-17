import { io, Socket } from "socket.io-client"

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_INDEXER_URL || "http://localhost:3001"
    
    socket = io(url, {
      withCredentials: true, // Send NextAuth cookie
      autoConnect: false, // Manual connection control
    })

    socket.on("connect", () => {
      console.log("[Socket.io] Connected to Indexer")
    })

    socket.on("disconnect", () => {
      console.log("[Socket.io] Disconnected from Indexer")
    })

    socket.on("error", (error: any) => {
      console.error("[Socket.io] Error:", error)
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

    const onJoined = () => {
      socket.off("workspace:joined", onJoined)
      socket.off("error", onError)
      resolve()
    }

    const onError = (error: any) => {
      socket.off("workspace:joined", onJoined)
      socket.off("error", onError)
      reject(new Error(error.message || "Failed to join workspace"))
    }

    socket.once("workspace:joined", onJoined)
    socket.once("error", onError)

    socket.emit("workspace:join", { workspaceId })
  })
}

export function leaveWorkspace(workspaceId: string): void {
  const socket = getSocket()
  socket.emit("workspace:leave", { workspaceId })
}

