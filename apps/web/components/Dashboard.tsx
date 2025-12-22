"use client"

import { useState, useEffect, useRef } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, LogOut } from "lucide-react"
import Sidebar from "@/components/Sidebar"
import ChatInterface from "@/components/ChatInterface"

export default function Dashboard() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<any[]>([])
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

  // Initialize app and load workspaces
  useEffect(() => {
    // Bootstrap app on first authenticated load (creates admin user if needed)
    fetch("/api/bootstrap").catch(err => console.warn("Bootstrap warning:", err))
    loadWorkspaces()
  }, [])

  // Check URL params for workspace/session
  useEffect(() => {
    const workspaceParam = searchParams.get("workspace")
    const sessionParam = searchParams.get("session")
    
    if (workspaceParam) {
      setCurrentWorkspaceId(workspaceParam)
    }
    if (sessionParam) {
      setCurrentSessionId(sessionParam)
    }
  }, [searchParams])

  const loadWorkspaces = async () => {
    try {
      const response = await fetch("/api/workspaces")
      if (response.ok) {
        const data = await response.json()
        setWorkspaces(data.workspaces || [])
        
        // Auto-select first workspace if none selected
        if (!currentWorkspaceId && data.workspaces.length > 0) {
          setCurrentWorkspaceId(data.workspaces[0]._id)
        }
      }
    } catch (error) {
      console.error("Error loading workspaces:", error)
    }
  }

  const handleReloadSessions = () => {
    // Trigger sidebar to reload sessions
    if (typeof window !== 'undefined' && (window as any).__reloadSidebarSessions) {
      (window as any).__reloadSidebarSessions()
    }
  }

  const handleWorkspaceChange = (workspaceId: string) => {
    setCurrentWorkspaceId(workspaceId)
    setCurrentSessionId(null) // Reset session when switching workspace
    
    // Update URL
    const params = new URLSearchParams()
    params.set("workspace", workspaceId)
    router.push(`/?${params.toString()}`)
  }

  const handleSessionChange = (sessionId: string) => {
    setCurrentSessionId(sessionId)
    
    // Update URL
    const params = new URLSearchParams()
    if (currentWorkspaceId) {
      params.set("workspace", currentWorkspaceId)
    }
    params.set("session", sessionId)
    router.push(`/?${params.toString()}`)
  }

  const handleNewChat = () => {
    setCurrentSessionId(null)
    
    // Update URL (remove session param)
    const params = new URLSearchParams()
    if (currentWorkspaceId) {
      params.set("workspace", currentWorkspaceId)
    }
    router.push(`/?${params.toString()}`)
  }

  const handleSessionCreated = (sessionId: string) => {
    setCurrentSessionId(sessionId)
    
    // Update URL
    const params = new URLSearchParams()
    if (currentWorkspaceId) {
      params.set("workspace", currentWorkspaceId)
    }
    params.set("session", sessionId)
    router.push(`/?${params.toString()}`)
  }

  const currentWorkspace = workspaces.find((w) => w._id === currentWorkspaceId)

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <Sidebar
        currentWorkspaceId={currentWorkspaceId}
        currentSessionId={currentSessionId}
        onWorkspaceChange={handleWorkspaceChange}
        onSessionChange={handleSessionChange}
        onNewChat={handleNewChat}
        onReloadSessions={handleReloadSessions}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            {currentWorkspace ? (
              <>
                <h1 className="text-lg font-semibold text-gray-900">
                  {currentWorkspace.name}
                </h1>
                {currentWorkspace.description && (
                  <span className="text-sm text-gray-500">
                    {currentWorkspace.description}
                  </span>
                )}
              </>
            ) : (
              <h1 className="text-lg font-semibold text-gray-900">
                Select a workspace to start chatting
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

        {/* Chat Content */}
        <div className="flex-1 overflow-hidden">
          {!currentWorkspaceId ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="max-w-md">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Welcome to Trace
                </h2>
                <p className="text-gray-600 mb-6">
                  Select a workspace from the sidebar to start chatting with your documents.
                </p>
                {workspaces.length === 0 && (
                  <button
                    onClick={() => router.push("/workspaces/new")}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create Your First Workspace
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full p-6">
              <ChatInterface
                workspaceId={currentWorkspaceId}
                sessionId={currentSessionId}
                onSessionCreated={handleSessionCreated}
                onMessageSent={handleReloadSessions}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

