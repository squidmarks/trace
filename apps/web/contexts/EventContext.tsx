"use client"

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import { io, Socket } from "socket.io-client"
import type { 
  ServerToClientEvents, 
  ClientToServerEvents,
  IndexProgressEvent,
  IndexCompleteEvent,
  IndexErrorEvent
} from "@trace/shared"

// ============================================================================
// Event Context Types
// ============================================================================

interface EventContextValue {
  isConnected: boolean
  subscribe: <T = any>(eventName: string, handler: (data: T) => void) => () => void
  emit: (eventName: string, data?: any) => void
  joinWorkspace: (workspaceId: string) => void
  leaveWorkspace: (workspaceId: string) => void
}

// ============================================================================
// Event Context
// ============================================================================

const EventContext = createContext<EventContextValue | null>(null)

export function EventProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
  const handlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map())
  const currentWorkspaceRef = useRef<string | null>(null)
  const reconnectAttempts = useRef(0)

  // Initialize Socket.io connection
  useEffect(() => {
    const indexerUrl = process.env.NEXT_PUBLIC_INDEXER_URL || "http://localhost:3001"
    
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(indexerUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    })

    socketRef.current = socket

    // Connection event handlers
    socket.on("connect", () => {
      console.log("[Events] Connected to message server")
      setIsConnected(true)
      reconnectAttempts.current = 0
      
      // Auto-rejoin workspace on reconnect
      if (currentWorkspaceRef.current) {
        console.log(`[Events] Auto-rejoining workspace: ${currentWorkspaceRef.current}`)
        socket.emit("workspace:join", { workspaceId: currentWorkspaceRef.current })
      }
    })

    socket.on("disconnect", (reason) => {
      console.log("[Events] Disconnected from message server:", reason)
      setIsConnected(false)
    })

    socket.on("connect_error", (error) => {
      reconnectAttempts.current++
      console.error(`[Events] Connection error (attempt ${reconnectAttempts.current}):`, error.message)
    })

    // Set up generic message dispatcher
    // All events go through this dispatcher to registered handlers
    const eventNames: (keyof ServerToClientEvents)[] = [
      "workspace:joined",
      "workspace:left", 
      "index:started",
      "index:progress",
      "index:complete",
      "index:error",
      "index:cancelled",
      "error"
    ]

    eventNames.forEach((eventName) => {
      socket.on(eventName as any, (data: any) => {
        console.log(`[Events] Received: ${eventName}`, data)
        
        // Call all registered handlers for this event
        const handlers = handlersRef.current.get(eventName)
        if (handlers) {
          console.log(`[Events] Calling ${handlers.size} handler(s) for ${eventName}`)
          handlers.forEach((handler) => {
            try {
              handler(data)
            } catch (error) {
              console.error(`[Events] Handler error for ${eventName}:`, error)
            }
          })
        } else {
          console.warn(`[Events] No handlers registered for ${eventName}`)
        }
      })
    })

    return () => {
      console.log("[Events] Cleaning up connection")
      socket.disconnect()
    }
  }, [])

  // Subscribe to an event
  const subscribe = useCallback(<T = any>(
    eventName: string, 
    handler: (data: T) => void
  ): (() => void) => {
    console.log(`[Events] Subscribing to: ${eventName}`)
    
    // Get or create handler set for this event
    if (!handlersRef.current.has(eventName)) {
      handlersRef.current.set(eventName, new Set())
    }
    
    const handlers = handlersRef.current.get(eventName)!
    handlers.add(handler)

    // Return unsubscribe function
    return () => {
      console.log(`[Events] Unsubscribing from: ${eventName}`)
      handlers.delete(handler)
      
      // Clean up empty sets
      if (handlers.size === 0) {
        handlersRef.current.delete(eventName)
      }
    }
  }, [])

  // Emit an event
  const emit = useCallback((eventName: string, data?: any) => {
    if (!socketRef.current?.connected) {
      console.warn(`[Events] Cannot emit ${eventName} - socket not connected`)
      return
    }
    
    console.log(`[Events] Emitting: ${eventName}`, data)
    socketRef.current.emit(eventName as any, data)
  }, [])

  // Join a workspace room
  const joinWorkspace = useCallback((workspaceId: string) => {
    // Store current workspace for auto-rejoin on reconnect
    currentWorkspaceRef.current = workspaceId
    
    if (!socketRef.current?.connected) {
      console.log(`[Events] Socket not connected yet, will join ${workspaceId} on connect`)
      return
    }
    
    console.log(`[Events] Joining workspace: ${workspaceId}`)
    socketRef.current.emit("workspace:join", { workspaceId })
  }, [])

  // Leave a workspace room
  const leaveWorkspace = useCallback((workspaceId: string) => {
    // Clear current workspace
    if (currentWorkspaceRef.current === workspaceId) {
      currentWorkspaceRef.current = null
    }
    
    if (!socketRef.current?.connected) {
      console.log(`[Events] Socket not connected, skipping leave for ${workspaceId}`)
      return
    }
    
    console.log(`[Events] Leaving workspace: ${workspaceId}`)
    socketRef.current.emit("workspace:leave", { workspaceId })
  }, [])

  const value: EventContextValue = {
    isConnected,
    subscribe,
    emit,
    joinWorkspace,
    leaveWorkspace,
  }

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Get the event context
 */
export function useEvents(): EventContextValue {
  const context = useContext(EventContext)
  if (!context) {
    throw new Error("useEvents must be used within an EventProvider")
  }
  return context
}

// Index-specific hooks are now in useIndexEvents.ts
// Re-export them here for backward compatibility
export { 
  useIndexProgress, 
  useIndexComplete, 
  useIndexError, 
  useIndexCancelled,
  useIndexEvents 
} from "./useIndexEvents"

