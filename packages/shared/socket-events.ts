/**
 * Socket.io event types for realtime communication
 * 
 * These types define the shape of events emitted between
 * browser clients and the Indexer Socket.io server.
 * 
 * Note: Socket.io server is hosted by the Indexer service,
 * not the Web app.
 */

import type { IndexPhase } from "./types"

// ============================================================================
// Client → Server Events
// ============================================================================

/**
 * Client requests to join a workspace room
 */
export interface WorkspaceJoinEvent {
  workspaceId: string
}

/**
 * Client requests to leave a workspace room
 */
export interface WorkspaceLeaveEvent {
  workspaceId: string
}

// ============================================================================
// Server → Client Events
// ============================================================================

/**
 * Confirmation that client joined workspace room
 */
export interface WorkspaceJoinedEvent {
  workspaceId: string
  role: "owner" | "viewer"
}

/**
 * Confirmation that client left workspace room
 */
export interface WorkspaceLeftEvent {
  workspaceId: string
}

/**
 * Indexing progress update
 */
export interface IndexProgressEvent {
  workspaceId: string
  phase: "processing"
  currentDocument?: {
    id: string
    filename: string
    current: number
    total: number
    totalPages: number        // Total pages in THIS document
    processedPages: number    // Pages rendered for THIS document
    analyzedPages: number     // Pages analyzed for THIS document
  }
  totalDocuments: number
  processedDocuments: number
  totalPages: number          // Overall total pages (all documents)
  processedPages: number      // Overall pages rendered (all documents)
  analyzedPages: number       // Overall pages analyzed (all documents)
  message?: string
  etaSeconds?: number
}

/**
 * Indexing completed successfully
 */
export interface IndexCompleteEvent {
  workspaceId: string
  documentCount: number
  pageCount: number
  cost: number
}

/**
 * Indexing job started
 */
export interface IndexStartedEvent {
  workspaceId: string
}

/**
 * Indexing job cancelled
 */
export interface IndexCancelledEvent {
  workspaceId: string
}

/**
 * Indexing failed
 */
export interface IndexErrorEvent {
  workspaceId: string
  error: string
}

/**
 * Generic error message
 */
export interface ErrorEvent {
  message: string
  code?: string
}

// ============================================================================
// Event Name Constants
// ============================================================================

/**
 * Client → Server event names
 */
export const ClientEvents = {
  WORKSPACE_JOIN: "workspace:join",
  WORKSPACE_LEAVE: "workspace:leave"
} as const

/**
 * Server → Client event names
 */
export const ServerEvents = {
  WORKSPACE_JOINED: "workspace:joined",
  WORKSPACE_LEFT: "workspace:left",
  INDEX_STARTED: "index:started",
  INDEX_PROGRESS: "index:progress",
  INDEX_COMPLETE: "index:complete",
  INDEX_CANCELLED: "index:cancelled",
  INDEX_ERROR: "index:error",
  ERROR: "error",
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  CONNECT_ERROR: "connect_error"
} as const

// ============================================================================
// Type-Safe Event Emitter Interfaces
// ============================================================================

/**
 * Type-safe interface for Socket.io server emitting to clients
 */
export interface ServerToClientEvents {
  [ServerEvents.WORKSPACE_JOINED]: (data: WorkspaceJoinedEvent) => void
  [ServerEvents.WORKSPACE_LEFT]: (data: WorkspaceLeftEvent) => void
  [ServerEvents.INDEX_STARTED]: (data: IndexStartedEvent) => void
  [ServerEvents.INDEX_PROGRESS]: (data: IndexProgressEvent) => void
  [ServerEvents.INDEX_COMPLETE]: (data: IndexCompleteEvent) => void
  [ServerEvents.INDEX_CANCELLED]: (data: IndexCancelledEvent) => void
  [ServerEvents.INDEX_ERROR]: (data: IndexErrorEvent) => void
  [ServerEvents.ERROR]: (data: ErrorEvent) => void
}

/**
 * Type-safe interface for Socket.io clients emitting to server
 */
export interface ClientToServerEvents {
  [ClientEvents.WORKSPACE_JOIN]: (data: WorkspaceJoinEvent) => void
  [ClientEvents.WORKSPACE_LEAVE]: (data: WorkspaceLeaveEvent) => void
}

/**
 * Socket.io server socket data
 */
export interface SocketData {
  userId: string
}

// ============================================================================
// Usage Examples
// ============================================================================

/*
// Server-side (Indexer)
import { Server } from "socket.io"
import type { ServerToClientEvents, ClientToServerEvents, SocketData } from "./socket-events"

const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>()

io.on("connection", (socket) => {
  socket.on("workspace:join", (data) => {
    // TypeScript knows data is WorkspaceJoinEvent
    socket.join(`workspace:${data.workspaceId}`)
    socket.emit("workspace:joined", { workspaceId: data.workspaceId, role: "owner" })
  })
})

// Emit to room
io.to("workspace:123").emit("index:progress", {
  phase: "analyze",
  docsDone: 1,
  docsTotal: 3,
  pagesDone: 10,
  pagesTotal: 50
})

// Client-side (Browser)
import { io, Socket } from "socket.io-client"
import type { ServerToClientEvents, ClientToServerEvents } from "./socket-events"

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  process.env.NEXT_PUBLIC_INDEXER_URL,
  { withCredentials: true }
)

socket.emit("workspace:join", { workspaceId: "123" })

socket.on("index:progress", (data) => {
  // TypeScript knows data is IndexProgressEvent
  console.log(`Progress: ${data.pagesDone}/${data.pagesTotal}`)
})
*/
