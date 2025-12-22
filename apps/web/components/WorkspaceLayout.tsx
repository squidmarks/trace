"use client"

import { useState, useEffect, useRef } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { ChevronDown, LogOut } from "lucide-react"
import Sidebar from "./Sidebar"

interface WorkspaceLayoutProps {
  children: React.ReactNode
}

export default function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(
    params.id as string || null
  )
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<any>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Load workspace info
  useEffect(() => {
    if (currentWorkspaceId) {
      loadWorkspace()
    }
  }, [currentWorkspaceId])

  const loadWorkspace = async () => {
    try {
      const response = await fetch(`/api/workspaces/${currentWorkspaceId}`)
      if (response.ok) {
        const data = await response.json()
        setWorkspace(data.workspace)
      }
    } catch (error) {
      console.error("Error loading workspace:", error)
    }
  }

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
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            {workspace ? (
              <>
                <h1 className="text-lg font-semibold text-gray-900">
                  {workspace.name}
                </h1>
                {workspace.description && (
                  <span className="text-sm text-gray-500">
                    {workspace.description}
                  </span>
                )}
              </>
            ) : (
              <h1 className="text-lg font-semibold text-gray-900">
                Workspace
              </h1>
            )}
          </div>

          {/* User Profile Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {session?.user?.image && (
                <img
                  src={session.user.image}
                  alt={session.user.name || "User"}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <span className="text-sm text-gray-700">{session?.user?.name}</span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{session?.user?.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{session?.user?.email}</p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}

