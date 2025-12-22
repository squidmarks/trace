"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Sidebar from "./Sidebar"

interface WorkspaceLayoutProps {
  children: React.ReactNode
}

export default function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  const router = useRouter()
  const params = useParams()
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(
    params.id as string || null
  )
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  const handleWorkspaceChange = (workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId)
    setCurrentSessionId(null)
    
    // Go to chat for this workspace
    const searchParams = new URLSearchParams()
    searchParams.set("workspace", workspaceId)
    router.push(`/?${searchParams.toString()}`)
  }

  const handleSessionChange = (sessionId: string) => {
    setCurrentSessionId(sessionId)
    
    // Go to chat for this session
    const searchParams = new URLSearchParams()
    if (currentWorkspaceId) {
      searchParams.set("workspace", currentWorkspaceId)
    }
    searchParams.set("session", sessionId)
    router.push(`/?${searchParams.toString()}`)
  }

  const handleNewChat = () => {
    setCurrentSessionId(null)
    
    // Go to new chat
    const searchParams = new URLSearchParams()
    if (currentWorkspaceId) {
      searchParams.set("workspace", currentWorkspaceId)
    }
    router.push(`/?${searchParams.toString()}`)
  }

  const handleReloadSessions = () => {
    if (typeof window !== 'undefined' && (window as any).__reloadSidebarSessions) {
      (window as any).__reloadSidebarSessions()
    }
  }

  return (
    <div className="flex h-screen bg-white">
      <Sidebar
        currentWorkspaceId={currentWorkspaceId}
        currentSessionId={currentSessionId}
        onWorkspaceChange={handleWorkspaceChange}
        onSessionChange={handleSessionChange}
        onNewChat={handleNewChat}
        onReloadSessions={handleReloadSessions}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}

