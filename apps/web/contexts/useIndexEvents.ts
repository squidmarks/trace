"use client"

import { useEffect, useState, useRef } from "react"
import type { 
  IndexProgressEvent,
  IndexCompleteEvent,
  IndexErrorEvent
} from "@trace/shared"
import { useEvents } from "./EventContext"

/**
 * Subscribe to index progress events for a specific workspace
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
    console.log(`[useIndexProgress] Setting up event subscription for workspace: ${workspaceId}`)
    
    const unsubscribe = subscribe<IndexProgressEvent>("index:progress", (data) => {
      console.log(`[useIndexProgress] Received progress event:`, data)
      if (data.workspaceId === workspaceId) {
        console.log(`[useIndexProgress] Workspace matches, updating state`)
        setProgress(data)
        onProgressRef.current?.(data)
      } else {
        console.log(`[useIndexProgress] Workspace doesn't match: ${data.workspaceId} !== ${workspaceId}`)
      }
    })

    return () => {
      console.log(`[useIndexProgress] Cleaning up event subscription`)
      unsubscribe()
    }
  }, [workspaceId, subscribe])

  // Join/leave workspace (separate effect to handle connection state)
  useEffect(() => {
    if (!isConnected) {
      console.log(`[useIndexProgress] Waiting for connection before joining ${workspaceId}`)
      hasJoinedRef.current = false
      return
    }

    if (hasJoinedRef.current) {
      console.log(`[useIndexProgress] Already joined ${workspaceId}, skipping`)
      return
    }

    console.log(`[useIndexProgress] Connected! Joining workspace: ${workspaceId}`)
    hasJoinedRef.current = true
    joinWorkspace(workspaceId)

    return () => {
      console.log(`[useIndexProgress] Leaving workspace: ${workspaceId}`)
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
  const { subscribe } = useEvents()
  
  // Use ref to hold latest callback without causing re-renders
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    const unsubscribe = subscribe<IndexCompleteEvent>("index:complete", (data) => {
      if (data.workspaceId === workspaceId) {
        onCompleteRef.current?.(data)
      }
    })

    return unsubscribe
  }, [workspaceId, subscribe])
}

/**
 * Subscribe to index error events for a specific workspace
 */
export function useIndexError(
  workspaceId: string,
  onError?: (data: IndexErrorEvent) => void
) {
  const { subscribe } = useEvents()
  
  // Use ref to hold latest callback without causing re-renders
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    const unsubscribe = subscribe<IndexErrorEvent>("index:error", (data) => {
      if (data.workspaceId === workspaceId) {
        onErrorRef.current?.(data)
      }
    })

    return unsubscribe
  }, [workspaceId, subscribe])
}

/**
 * Subscribe to index cancelled events for a specific workspace
 */
export function useIndexCancelled(
  workspaceId: string,
  onCancelled?: (data: { workspaceId: string }) => void
) {
  const { subscribe } = useEvents()
  
  // Use ref to hold latest callback without causing re-renders
  const onCancelledRef = useRef(onCancelled)
  useEffect(() => {
    onCancelledRef.current = onCancelled
  }, [onCancelled])

  useEffect(() => {
    const unsubscribe = subscribe<{ workspaceId: string }>("index:cancelled", (data) => {
      if (data.workspaceId === workspaceId) {
        onCancelledRef.current?.(data)
      }
    })

    return unsubscribe
  }, [workspaceId, subscribe])
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

