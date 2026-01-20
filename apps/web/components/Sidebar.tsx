"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  ChevronDown, 
  ChevronLeft,
  Plus, 
  MessageSquare, 
  FolderOpen,
  Menu,
  X,
  Trash2,
  Edit2,
  Check,
  Settings,
  AlertCircle,
  Search,
  Users
} from "lucide-react"
import ConfirmButton from "./ConfirmButton"

interface Workspace {
  _id: string
  name: string
  description?: string
  documentCount?: number
}

interface ChatSession {
  _id: string
  workspaceId: string
  title?: string
  messageCount: number
  createdAt: Date
  updatedAt: Date
}

// Format relative time (e.g., "2 hours ago", "yesterday")
function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return "yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

interface SidebarProps {
  currentWorkspaceId: string | null
  currentSessionId: string | null
  onWorkspaceChange: (workspaceId: string) => void
  onSessionChange: (sessionId: string) => void
  onNewChat: () => void
  onReloadSessions?: () => void
}

// Export reload function for external use
export interface SidebarHandle {
  reloadSessions: () => void
}

export default function Sidebar({
  currentWorkspaceId,
  currentSessionId,
  onWorkspaceChange,
  onSessionChange,
  onNewChat,
  onReloadSessions,
}: SidebarProps) {
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [contextMenuSessionId, setContextMenuSessionId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Load workspaces
  useEffect(() => {
    loadWorkspaces()
  }, [])

  // Load chat history when workspace changes
  useEffect(() => {
    if (currentWorkspaceId) {
      loadChatHistory(currentWorkspaceId, searchQuery)
    }
  }, [currentWorkspaceId])

  // Reload when search query changes (with debounce)
  useEffect(() => {
    if (!currentWorkspaceId) return

    const timeoutId = setTimeout(() => {
      loadChatHistory(currentWorkspaceId, searchQuery)
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchQuery, currentWorkspaceId])

  // Reload workspaces when workspace is updated
  useEffect(() => {
    const handleWorkspaceUpdated = () => {
      loadWorkspaces()
    }
    
    window.addEventListener('workspace-updated', handleWorkspaceUpdated)
    return () => window.removeEventListener('workspace-updated', handleWorkspaceUpdated)
  }, [])

  const loadWorkspaces = async () => {
    try {
      const response = await fetch("/api/workspaces")
      if (response.ok) {
        const data = await response.json()
        setWorkspaces(data.workspaces || [])
      }
    } catch (error) {
      console.error("Error loading workspaces:", error)
    }
  }

  const loadChatHistory = async (workspaceId: string, search?: string) => {
    setIsLoadingSessions(true)
    try {
      const url = new URL(`/api/workspaces/${workspaceId}/chat`, window.location.origin)
      if (search && search.trim()) {
        url.searchParams.set('search', search.trim())
      }
      const response = await fetch(url.toString())
      if (response.ok) {
        const data = await response.json()
        setChatSessions(data.sessions || [])
      }
    } catch (error) {
      console.error("Error loading chat history:", error)
    } finally {
      setIsLoadingSessions(false)
    }
  }

  // Reload chat history when a new session is created or messages are added
  const reloadChatHistory = () => {
    if (currentWorkspaceId) {
      loadChatHistory(currentWorkspaceId, searchQuery)
    }
  }

  // Expose reload function to parent
  useEffect(() => {
    if (onReloadSessions) {
      (window as any).__reloadSidebarSessions = reloadChatHistory
    }
  }, [onReloadSessions, currentWorkspaceId])

  const deleteSession = async (sessionId: string) => {
    if (!currentWorkspaceId) return

    try {
      const response = await fetch(
        `/api/workspaces/${currentWorkspaceId}/chat/${sessionId}`,
        { method: "DELETE" }
      )

      if (response.ok) {
        // Remove from list
        setChatSessions((prev) => prev.filter((s) => s._id !== sessionId))
        
        // If we deleted the current session, start a new chat
        if (sessionId === currentSessionId) {
          onNewChat()
        }
      } else {
        console.error("Failed to delete session")
      }
    } catch (error) {
      console.error("Error deleting session:", error)
    }
  }

  const startEditingSession = (session: ChatSession) => {
    setEditingSessionId(session._id)
    setEditingTitle(session.title || "New Chat")
  }

  const saveSessionTitle = async (sessionId: string) => {
    if (!currentWorkspaceId || !editingTitle.trim()) {
      setEditingSessionId(null)
      return
    }

    try {
      const response = await fetch(
        `/api/workspaces/${currentWorkspaceId}/chat/${sessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: editingTitle.trim() }),
        }
      )

      if (response.ok) {
        // Update in list
        setChatSessions((prev) =>
          prev.map((s) =>
            s._id === sessionId ? { ...s, title: editingTitle.trim() } : s
          )
        )
      }
    } catch (error) {
      console.error("Error updating session title:", error)
    } finally {
      setEditingSessionId(null)
    }
  }

  const currentWorkspace = workspaces.find((w) => w._id === currentWorkspaceId)

  const groupSessionsByDate = (sessions: ChatSession[]) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const lastWeek = new Date(today)
    lastWeek.setDate(lastWeek.getDate() - 7)

    const groups: { [key: string]: ChatSession[] } = {
      Today: [],
      Yesterday: [],
      "Last 7 Days": [],
      Older: [],
    }

    sessions.forEach((session) => {
      const sessionDate = new Date(session.updatedAt)
      if (sessionDate >= today) {
        groups.Today.push(session)
      } else if (sessionDate >= yesterday) {
        groups.Yesterday.push(session)
      } else if (sessionDate >= lastWeek) {
        groups["Last 7 Days"].push(session)
      } else {
        groups.Older.push(session)
      }
    })

    return groups
  }

  const sessionGroups = groupSessionsByDate(chatSessions)

  if (isCollapsed) {
    return (
      <div className="w-16 bg-gray-50 border-r border-gray-200 p-4 flex flex-col items-center gap-4">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 hover:bg-gray-200 rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>
        <button
          onClick={onNewChat}
          className="p-2 hover:bg-gray-200 rounded-lg"
          title="New Chat"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Trace</h1>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-gray-200 rounded"
          title="Collapse sidebar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Workspace Selector */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative flex gap-2">
          <button
            onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
            className="flex-1 flex items-center justify-between p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FolderOpen className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-sm font-medium truncate">
                {currentWorkspace?.name || "Select Workspace"}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
          </button>
          
          {currentWorkspaceId && (
            <Link
              href={`/workspaces/${currentWorkspaceId}/documents`}
              className="p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
              title="Edit Workspace"
            >
              <Settings className="w-4 h-4 text-gray-500" />
            </Link>
          )}

          {/* Dropdown */}
          {showWorkspaceDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
              {workspaces.map((workspace) => (
                <button
                  key={workspace._id}
                  onClick={() => {
                    onWorkspaceChange(workspace._id)
                    setShowWorkspaceDropdown(false)
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 ${
                    workspace._id === currentWorkspaceId ? "bg-blue-50" : ""
                  }`}
                >
                  <FolderOpen className="w-4 h-4 text-gray-500" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {workspace.name}
                    </div>
                    {workspace.description && (
                      <div className="text-xs text-gray-500 truncate">
                        {workspace.description}
                      </div>
                    )}
                  </div>
                </button>
              ))}
              <button
                onClick={() => {
                  router.push("/workspaces/new")
                  setShowWorkspaceDropdown(false)
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-200 text-blue-600"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">New Workspace</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-4 pb-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">New Chat</span>
        </button>
      </div>

      {/* Search Chat History */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-xs text-gray-500 mt-1">
            Showing up to 50 results
          </p>
        )}
      </div>

      {/* Admin Link */}
      <div className="px-4 pb-3">
        <Link
          href="/admin/users"
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition"
        >
          <Users className="w-4 h-4" />
          <span>Manage Users</span>
        </Link>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {!currentWorkspaceId ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            Select a workspace to view chat history
          </div>
        ) : isLoadingSessions ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : chatSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            {searchQuery ? (
              <>
                <p className="mb-2">No conversations found</p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-blue-600 hover:text-blue-700 text-xs"
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                No chat history yet
                <br />
                Start a new conversation
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(sessionGroups).map(([group, sessions]) => {
              if (sessions.length === 0) return null
              return (
                <div key={group}>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    {group}
                  </h3>
                  <div className="space-y-1">
                    {sessions.map((session) => (
                      <div
                        key={session._id}
                        className={`relative group rounded-lg hover:bg-white ${
                          session._id === currentSessionId
                            ? "bg-white shadow-sm"
                            : ""
                        }`}
                      >
                        {editingSessionId === session._id ? (
                          <div className="flex items-center gap-2 px-3 py-2">
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  saveSessionTitle(session._id)
                                } else if (e.key === "Escape") {
                                  setEditingSessionId(null)
                                }
                              }}
                              className="flex-1 text-sm px-2 py-1 border border-blue-500 rounded focus:outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => saveSessionTitle(session._id)}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              <Check className="w-4 h-4 text-green-600" />
                            </button>
                            <button
                              onClick={() => setEditingSessionId(null)}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              <X className="w-4 h-4 text-gray-500" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <button
                              onClick={() => onSessionChange(session._id)}
                              className="flex-1 flex items-start gap-2 px-3 py-2 text-left"
                            >
                              <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-gray-900 line-clamp-2">
                                  {session.title || "New Chat"}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {formatRelativeTime(session.updatedAt)}
                                </div>
                              </div>
                            </button>
                            <div className="flex items-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startEditingSession(session)
                                }}
                                className="p-1 hover:bg-gray-100 rounded"
                                title="Rename"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                              </button>
                              <ConfirmButton
                                onConfirm={(e) => {
                                  e?.stopPropagation()
                                  deleteSession(session._id)
                                }}
                                className="p-1 hover:bg-gray-100 rounded"
                                confirmText="Delete chat?"
                                cancelText="No"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </ConfirmButton>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

