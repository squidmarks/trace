"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import type { Document as TraceDocument, Workspace, Role } from "@trace/shared"
import DocumentUpload from "@/components/DocumentUpload"
import AddFromUrlModal from "@/components/AddFromUrlModal"

export default function DocumentsPage() {
  const params = useParams()
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

    // Set up Socket.io connection and listeners
    const setupSocket = async () => {
      const { getSocket, connectSocket, joinWorkspace } = await import("@/lib/socket")
      
      const socket = getSocket()
      
      // Connect and join workspace room
      connectSocket()
      
      socket.on("connect", () => {
        console.log("[Socket.io] Connected to Indexer")
        joinWorkspace(params.id as string).catch(console.error)
      })

      socket.on("disconnect", (reason) => {
        console.log(`[Socket.io] Disconnected: ${reason}`)
      })

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
          setIndexProgress({
            phase: "error",
            error: data.error || "Indexing failed",
          })
          setTimeout(() => setIndexProgress(null), 10000)
        }
      }

      socket.on("index:progress", handleIndexProgress)
      socket.on("index:complete", handleIndexComplete)
      socket.on("index:error", handleIndexError)

      return () => {
        socket.off("connect")
        socket.off("disconnect")
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
    if (!confirm("Are you sure you want to delete this document?")) {
      return
    }

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
          <h1 className="text-3xl font-bold mb-2">{workspace?.name}</h1>
          {workspace?.description && (
            <p className="text-gray-600 dark:text-gray-400">{workspace.description}</p>
          )}
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
              <button
                onClick={handleStartIndex}
                disabled={isIndexing}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  isIndexing
                    ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {isIndexing ? "Indexing..." : "📑 Index Workspace"}
              </button>
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
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">
                  {indexProgress.phase === "fetching" && "📥 Fetching documents..."}
                  {indexProgress.phase === "rendering" && "🎨 Rendering PDFs..."}
                  {indexProgress.phase === "storing" && "💾 Storing pages..."}
                  {indexProgress.phase === "complete" && "✅ Indexing complete!"}
                  {indexProgress.phase === "error" && "❌ Indexing failed"}
                </span>
                {indexProgress.totalDocuments && (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {indexProgress.processedDocuments}/{indexProgress.totalDocuments} docs
                  </span>
                )}
              </div>

              {indexProgress.phase === "error" && indexProgress.error && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {indexProgress.error}
                </p>
              )}

              {indexProgress.currentDocument && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Processing: {indexProgress.currentDocument.filename}
                </p>
              )}

              {indexProgress.processedPages > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {indexProgress.processedPages} pages created
                </p>
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
                      <span>
                        {doc.sourceType === "url" ? "📎 From URL" : "📄 Uploaded"}
                      </span>
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                      {doc.pageCount && <span>{doc.pageCount} pages</span>}
                    </div>
                  </div>

                  {role === "owner" && (
                    <button
                      onClick={() => handleDelete(doc._id.toString())}
                      className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                    >
                      Delete
                    </button>
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

