"use client"

import { useEffect, useState, useRef } from "react"
import type { 
  IndexProgressEvent,
  IndexCompleteEvent,
  IndexErrorEvent
} from "@trace/shared"
import { useEvents } from "./EventContext"

// ============================================================================
// Generic Workspace Event Hook
// ============================================================================

/**
 * Generic hook for subscribing to workspace-scoped events
 * Handles the common pattern of: subscribe → filter by workspaceId → call callback
 */
function useWorkspaceEvent<T extends { workspaceId: string }>(
  eventName: string,
  workspaceId: string,
  callback?: (data: T) => void
) {
  const { subscribe } = useEvents()
  
  // Use ref to hold latest callback without causing re-renders
  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    const unsubscribe = subscribe<T>(eventName, (data) => {
      if (data.workspaceId === workspaceId) {
        callbackRef.current?.(data)
      }
    })

    return unsubscribe
  }, [eventName, workspaceId, subscribe])
}

// ============================================================================
// Index-Specific Hooks
// ============================================================================

/**
 * Subscribe to index progress events for a specific workspace
 * This is the only hook that returns state and handles workspace join/leave
 */
export function useIndexProgress(
  workspaceId: string,
  onProgress?: (data: IndexProgressEvent) => void
): IndexProgressEvent | null {
  const { subscribe, joinWorkspace, leaveWorkspace, isConnected } = useEvents()
  const [progress, setProgress] = useState<IndexProgressEvent | null>(null)
  const hasJoinedRef = useRef(false)
  
  // Use ref to hold latest callback without causing re-renders
  const onProgressRef = useRef(onProgress)
  useEffect(() => {
    onProgressRef.current = onProgress
  }, [onProgress])

  // Subscribe to events
  useEffect(() => {
    const unsubscribe = subscribe<IndexProgressEvent>("index:progress", (data) => {
      if (data.workspaceId === workspaceId) {
        setProgress(data)
        onProgressRef.current?.(data)
      }
    })

    return unsubscribe
  }, [workspaceId, subscribe])

  // Join/leave workspace (separate effect to handle connection state)
  useEffect(() => {
    if (!isConnected) {
      hasJoinedRef.current = false
      return
    }

    if (hasJoinedRef.current) {
      return
    }

    hasJoinedRef.current = true
    joinWorkspace(workspaceId)

    return () => {
      hasJoinedRef.current = false
      leaveWorkspace(workspaceId)
    }
  }, [workspaceId, isConnected, joinWorkspace, leaveWorkspace])

  return progress
}

/**
 * Subscribe to index complete events for a specific workspace
 */
export function useIndexComplete(
  workspaceId: string,
  onComplete?: (data: IndexCompleteEvent) => void
) {
  useWorkspaceEvent("index:complete", workspaceId, onComplete)
}

/**
 * Subscribe to index error events for a specific workspace
 */
export function useIndexError(
  workspaceId: string,
  onError?: (data: IndexErrorEvent) => void
) {
  useWorkspaceEvent("index:error", workspaceId, onError)
}

/**
 * Subscribe to index cancelled events for a specific workspace
 */
export function useIndexCancelled(
  workspaceId: string,
  onCancelled?: (data: { workspaceId: string }) => void
) {
  useWorkspaceEvent("index:cancelled", workspaceId, onCancelled)
}

/**
 * Subscribe to all index events for a workspace
 * Returns current progress state and provides callbacks for complete/error/cancelled
 */
export function useIndexEvents(
  workspaceId: string,
  callbacks?: {
    onProgress?: (data: IndexProgressEvent) => void
    onComplete?: (data: IndexCompleteEvent) => void
    onError?: (data: IndexErrorEvent) => void
    onCancelled?: (data: { workspaceId: string }) => void
  }
) {
  const progress = useIndexProgress(workspaceId, callbacks?.onProgress)
  useIndexComplete(workspaceId, callbacks?.onComplete)
  useIndexError(workspaceId, callbacks?.onError)
  useIndexCancelled(workspaceId, callbacks?.onCancelled)

  return { progress }
}

