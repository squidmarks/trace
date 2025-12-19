"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Trash2, FileSearch, XCircle, CheckCircle2, AlertCircle, Cog, FileText, Link as LinkIcon, Sparkles, Search } from "lucide-react"
import type { Document as TraceDocument, Workspace, Role } from "@trace/shared"
import DocumentUpload from "@/components/DocumentUpload"
import AddFromUrlModal from "@/components/AddFromUrlModal"
import ConfirmButton from "@/components/ConfirmButton"

export default function DocumentsPage() {
  const params = useParams()
  const router = useRouter()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [documents, setDocuments] = useState<TraceDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showUrlModal, setShowUrlModal] = useState(false)
  const [isIndexing, setIsIndexing] = useState(false)
  const [indexProgress, setIndexProgress] = useState<any>(null)

  useEffect(() => {
    fetchWorkspace()
    fetchDocuments()
  }, [params.id])

  // Separate effect for Socket.io (only once)
  useEffect(() => {
    let hasJoined = false // Track if we've already joined to prevent duplicates
    
    // Set up Socket.io connection and listeners
    const setupSocket = async () => {
      const { getSocket, connectSocket, joinWorkspace } = await import("@/lib/socket")
      
      const socket = getSocket()
      
      // Connect socket
      connectSocket()
      
      const handleConnect = async () => {
        // Only join once per component mount
        if (hasJoined) {
          console.log("[Socket.io] Already joined, skipping duplicate join")
          return
        }
        
        console.log("[Socket.io] Connected to Indexer, joining workspace...")
        try {
          await joinWorkspace(params.id as string)
          hasJoined = true
        } catch (error) {
          console.error("[Socket.io] Failed to join workspace:", error)
        }
      }

      const handleDisconnect = (reason: string) => {
        console.log(`[Socket.io] Disconnected: ${reason}`)
        hasJoined = false // Reset on disconnect so we can rejoin on reconnect
      }

      // Index progress events
      const handleIndexProgress = (data: any) => {
        if (data.workspaceId === params.id) {
          console.log("[Socket.io] Index progress:", data)
          setIndexProgress(data)
        }
      }

      const handleIndexComplete = (data: any) => {
        if (data.workspaceId === params.id) {
          console.log("[Socket.io] Index complete:", data)
          setIsIndexing(false)
          setIndexProgress({ phase: "complete", ...data })
          fetchDocuments() // Refresh to show page counts
          // Also refresh workspace info to update stats everywhere
          setTimeout(() => {
            setIndexProgress(null)
            window.dispatchEvent(new Event("workspace-updated"))
          }, 5000)
        }
      }

      const handleIndexError = (data: any) => {
        if (data.workspaceId === params.id) {
          console.error("[Socket.io] Index error:", data)
          setIsIndexing(false)
          
          // If user cancelled, just clear progress immediately
          if (data.error?.includes("cancelled") || data.error?.includes("Cancelled")) {
            console.log("[Socket.io] Indexing cancelled, clearing progress")
            setIndexProgress(null)
          } else {
            // For actual errors, show error panel
            setIndexProgress({
              phase: "error",
              error: data.error || "Indexing failed",
            })
            setTimeout(() => setIndexProgress(null), 10000)
          }
        }
      }

      // Set up listeners FIRST
      socket.on("connect", handleConnect)
      socket.on("disconnect", handleDisconnect)
      socket.on("index:progress", handleIndexProgress)
      socket.on("index:complete", handleIndexComplete)
      socket.on("index:error", handleIndexError)
      
      // Then check if already connected and join
      if (socket.connected) {
        handleConnect()
      }

      return () => {
        socket.off("connect", handleConnect)
        socket.off("disconnect", handleDisconnect)
        socket.off("index:progress", handleIndexProgress)
        socket.off("index:complete", handleIndexComplete)
        socket.off("index:error", handleIndexError)
      }
    }

    let cleanup: (() => void) | undefined

    if (typeof window !== "undefined") {
      setupSocket().then((cleanupFn) => {
        cleanup = cleanupFn
      })
    }

    return () => {
      cleanup?.()
    }
  }, [params.id])

  const fetchWorkspace = async () => {
    try {
      const response = await fetch(`/api/workspaces/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setWorkspace(data.workspace)
        setRole(data.role)
      }
    } catch (error) {
      console.error("Error fetching workspace:", error)
    }
  }

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/workspaces/${params.id}/documents`)
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents)
      }
    } catch (error) {
      console.error("Error fetching documents:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (documentId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${params.id}/documents/${documentId}`,
        {
          method: "DELETE",
        }
      )

      if (response.ok) {
        fetchDocuments()
      }
    } catch (error) {
      console.error("Error deleting document:", error)
    }
  }

  const handleStartIndex = async () => {
    setIsIndexing(true)
    setIndexProgress(null)

    try {
      const response = await fetch(`/api/workspaces/${params.id}/index`, {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        console.error("Failed to start indexing:", error)
        setIsIndexing(false)
        setIndexProgress({
          phase: "error",
          error: error.error || "Failed to start indexing",
        })
      }
      // Progress will be updated via Socket.io events
    } catch (error) {
      console.error("Error starting index:", error)
      setIsIndexing(false)
      setIndexProgress({
        phase: "error",
        error: "Failed to start indexing",
      })
    }
  }

  const handleAbortIndex = async () => {
    try {
      const response = await fetch(`/api/workspaces/${params.id}/index/abort`, {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        console.error("Failed to abort indexing:", error)
        return
      }

      console.log("Indexing aborted successfully")
      setIsIndexing(false)
      setIndexProgress(null)
      fetchDocuments() // Refresh to show current state
    } catch (error) {
      console.error("Error aborting index:", error)
    }
  }

  const handleDeleteWorkspace = async () => {
    try {
      const response = await fetch(`/api/workspaces/${params.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        console.error("Failed to delete workspace:", error)
        alert(error.error || "Failed to delete workspace")
        return
      }

      console.log("Workspace deleted successfully")
      // Navigate back to workspaces list
      router.push("/workspaces")
    } catch (error) {
      console.error("Error deleting workspace:", error)
      alert("Failed to delete workspace")
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link
            href="/workspaces"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Back to Workspaces
          </Link>
        </div>

        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{workspace?.name}</h1>
              {workspace?.description && (
                <p className="text-gray-600 dark:text-gray-400">{workspace.description}</p>
              )}
            </div>
            <ConfirmButton
              onConfirm={handleDeleteWorkspace}
              className="text-red-600 hover:text-red-700 dark:text-red-400 flex items-center gap-2 px-3 py-2"
              confirmText="Yes, delete"
              cancelText="Cancel"
            >
              <Trash2 size={18} />
              Delete Workspace
            </ConfirmButton>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <Link
              href={`/workspaces/${params.id}/documents`}
              className="border-b-2 border-blue-500 py-4 px-1 text-sm font-medium text-blue-600 dark:text-blue-400"
            >
              <div className="flex items-center gap-2">
                <FileText size={18} />
                Documents
              </div>
            </Link>
            <Link
              href={`/workspaces/${params.id}/search`}
              className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <div className="flex items-center gap-2">
                <Search size={18} />
                Search
              </div>
            </Link>
          </nav>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Upload Documents</h2>
          
          {role === "owner" ? (
            <>
              <DocumentUpload
                workspaceId={params.id as string}
                onUploadComplete={fetchDocuments}
              />

              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowUrlModal(true)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Or add a document from URL
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Only workspace owners can upload documents
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              Documents ({documents.length})
            </h2>

            {role === "owner" && documents.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={handleStartIndex}
                  disabled={isIndexing}
                  className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                    isIndexing
                      ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  <FileSearch size={18} />
                  {isIndexing ? "Indexing..." : "Index Workspace"}
                </button>
                
                {isIndexing && (
                  <ConfirmButton
                    onConfirm={handleAbortIndex}
                    confirmText="Yes, Abort"
                    className="px-4 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition flex items-center gap-2"
                    confirmClassName="text-sm bg-red-600 text-white hover:bg-red-700 px-3 py-1 rounded"
                    cancelClassName="text-sm bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500 px-3 py-1 rounded"
                  >
                    <XCircle size={18} />
                    Abort
                  </ConfirmButton>
                )}
              </div>
            )}
          </div>

          {/* Index Progress */}
          {indexProgress && (
            <div className={`mb-4 p-4 rounded-lg border ${
              indexProgress.phase === "error"
                ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                : indexProgress.phase === "complete"
                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
            }`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-lg flex items-center gap-2">
                  {indexProgress.phase === "complete" && (
                    <>
                      <CheckCircle2 size={20} className="text-green-600 dark:text-green-400" />
                      Indexing complete!
                    </>
                  )}
                  {indexProgress.phase === "error" && (
                    <>
                      <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
                      Indexing failed
                    </>
                  )}
                  {indexProgress.phase === "processing" && (
                    <>
                      <Cog size={20} className="animate-spin" />
                      Processing document...
                    </>
                  )}
                </span>
                {indexProgress.totalDocuments && indexProgress.phase === "processing" && (
                  <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                    Doc {indexProgress.processedDocuments + 1}/{indexProgress.totalDocuments}
                  </span>
                )}
              </div>

              {/* Current Document */}
              {indexProgress.currentDocument && indexProgress.phase === "processing" && (
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-3 flex items-center gap-1">
                  <FileText size={14} />
                  {indexProgress.currentDocument.filename}
                </p>
              )}

              {/* Progress Bar */}
              {indexProgress.totalPages > 0 && indexProgress.phase === "processing" && (() => {
                const currentProgress = indexProgress.analyzedPages > 0 
                  ? indexProgress.analyzedPages 
                  : indexProgress.processedPages
                const percentage = Math.round((currentProgress / indexProgress.totalPages) * 100)
                
                return (
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                      <span>
                        {indexProgress.analyzedPages > 0 
                          ? `${indexProgress.analyzedPages} analyzed`
                          : `${indexProgress.processedPages} rendered`
                        } / {indexProgress.totalPages} pages
                      </span>
                      <span className="font-mono">
                        {percentage}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-out rounded-full"
                        style={{
                          width: `${Math.min(100, percentage)}%`
                        }}
                      />
                    </div>
                  </div>
                )
              })()}

              {/* Error Message */}
              {indexProgress.phase === "error" && indexProgress.error && (
                <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                  {indexProgress.error}
                </p>
              )}

              {/* Success Message with Cost */}
              {indexProgress.phase === "complete" && (
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <p className="flex items-center gap-1">
                    <Sparkles size={14} />
                    Indexed {indexProgress.pageCount} pages across {indexProgress.documentCount} document(s)
                  </p>
                  {indexProgress.cost && (
                    <p className="font-mono">
                      💰 Cost: ${indexProgress.cost.toFixed(4)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {documents.length === 0 ? (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              <p>No documents yet</p>
              <p className="text-sm mt-2">Upload a PDF to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc._id.toString()}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition"
                >
                  <div className="flex-1">
                    <h3 className="font-medium">{doc.filename}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        {doc.sourceType === "url" ? (
                          <>
                            <LinkIcon size={14} />
                            From URL
                          </>
                        ) : (
                          <>
                            <FileText size={14} />
                            Uploaded
                          </>
                        )}
                      </span>
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                      {doc.pageCount && <span>{doc.pageCount} pages</span>}
                    </div>
                  </div>

                  {role === "owner" && (
                    <ConfirmButton
                      onConfirm={() => handleDelete(doc._id.toString())}
                      confirmText="Delete document?"
                      className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                    >
                      Delete
                    </ConfirmButton>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AddFromUrlModal
        workspaceId={params.id as string}
        isOpen={showUrlModal}
        onClose={() => setShowUrlModal(false)}
        onSuccess={fetchDocuments}
      />
    </div>
  )
}

