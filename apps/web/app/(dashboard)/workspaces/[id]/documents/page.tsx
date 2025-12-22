"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { FileSearch, FileText, Search, XCircle, X } from "lucide-react"
import type { Document as TraceDocument, Workspace, Role } from "@trace/shared"
import DocumentUpload from "@/components/DocumentUpload"
import AddFromUrlModal from "@/components/AddFromUrlModal"
import ConfirmButton from "@/components/ConfirmButton"
import IndexingProgress from "@/components/IndexingProgress"
import DocumentsList from "@/components/DocumentsList"
import WorkspaceLayout from "@/components/WorkspaceLayout"
import { useIndexEvents, useEvents } from "@/contexts/EventContext"

export default function DocumentsPage() {
  const params = useParams()
  const router = useRouter()
  const events = useEvents()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [documents, setDocuments] = useState<TraceDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showUrlModal, setShowUrlModal] = useState(false)
  const [isIndexing, setIsIndexing] = useState(false)
  const [indexProgress, setIndexProgress] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchWorkspace()
    fetchDocuments()
  }, [params.id])

  // Subscribe to index events
  useIndexEvents(params.id as string, {
    onProgress: (data) => {
      setIsIndexing(true)
      setIndexProgress(data)
    },
    onComplete: (data) => {
      setIsIndexing(false)
      setIndexProgress({ phase: "complete", ...data })
      fetchDocuments()
      setTimeout(() => {
        setIndexProgress(null)
        window.dispatchEvent(new Event("workspace-updated"))
      }, 5000)
    },
    onError: (data) => {
      setIsIndexing(false)
      if (data.error?.includes("cancelled") || data.error?.includes("Cancelled")) {
        setIndexProgress(null)
      } else {
        setIndexProgress({ phase: "error", error: data.error || "Indexing failed" })
        setTimeout(() => setIndexProgress(null), 10000)
      }
    },
  })

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

  const handleDeleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${params.id}/documents/${documentId}`,
        { method: "DELETE" }
      )

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || "Failed to delete document")
        return
      }

      console.log("Document deleted successfully")
      fetchDocuments()
    } catch (error) {
      console.error("Error deleting document:", error)
      setError("Failed to delete document")
    }
  }

  const handleStartIndex = () => {
    try {
      console.log("Starting index for workspace:", params.id)
      
      // Emit index start request over socket
      events.emit("index:start", {
        workspaceId: params.id,
      })

      // The index:started event will be received via the regular event flow
      // Progress updates will come through useIndexEvents
    } catch (error) {
      console.error("Error starting index:", error)
      setError("Failed to start indexing")
    }
  }

  const handleAbortIndex = async () => {
    try {
      const INDEXER_SERVICE_URL = process.env.NEXT_PUBLIC_INDEXER_URL || "http://localhost:3001"
      const INDEXER_SERVICE_TOKEN = process.env.NEXT_PUBLIC_INDEXER_TOKEN

      const response = await fetch(`${INDEXER_SERVICE_URL}/jobs/${params.id}/abort`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(INDEXER_SERVICE_TOKEN && { Authorization: `Bearer ${INDEXER_SERVICE_TOKEN}` }),
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || "Failed to abort indexing")
        return
      }

      console.log("Indexing aborted successfully")
      setIsIndexing(false)
      setIndexProgress(null)
      fetchDocuments()
    } catch (error) {
      console.error("Error aborting index:", error)
      setError("Failed to abort indexing")
    }
  }

  const handleRenameWorkspace = async (name: string) => {
    try {
      const response = await fetch(`/api/workspaces/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || "Failed to update workspace name")
        return
      }

      const data = await response.json()
      setWorkspace(data.workspace)
      window.dispatchEvent(new Event("workspace-updated"))
    } catch (error) {
      console.error("Error updating workspace name:", error)
      setError("Failed to update workspace name")
    }
  }

  const handleDeleteWorkspace = async () => {
    try {
      const response = await fetch(`/api/workspaces/${params.id}`, { method: "DELETE" })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || "Failed to delete workspace")
        return
      }

      console.log("Workspace deleted successfully")
      router.push("/")
    } catch (error) {
      console.error("Error deleting workspace:", error)
      setError("Failed to delete workspace")
    }
  }

  if (isLoading) {
    return (
      <WorkspaceLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-lg">Loading...</div>
        </div>
      </WorkspaceLayout>
    )
  }

  if (!workspace || !role) {
    return null
  }

  return (
    <WorkspaceLayout>
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start justify-between">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Workspace Actions */}
          {role === "owner" && (
            <div className="flex justify-end mb-4">
              <ConfirmButton
                onConfirm={handleDeleteWorkspace}
                className="text-red-600 hover:text-red-700 dark:text-red-400 flex items-center gap-2 px-3 py-2"
                confirmText="Yes, delete"
                cancelText="Cancel"
              >
                <XCircle size={18} />
                Delete Workspace
              </ConfirmButton>
            </div>
          )}

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

          {/* Upload Documents Section */}
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

          {/* Documents List Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Documents ({documents.length})</h2>

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
                    >
                      <XCircle size={18} />
                      Abort
                    </ConfirmButton>
                  )}
                </div>
              )}
            </div>

            {indexProgress && <IndexingProgress progress={indexProgress} />}

            <DocumentsList
              documents={documents}
              role={role}
              onDelete={handleDeleteDocument}
            />
          </div>

          <AddFromUrlModal
            workspaceId={params.id as string}
            isOpen={showUrlModal}
            onClose={() => setShowUrlModal(false)}
            onSuccess={fetchDocuments}
          />
        </div>
      </div>
    </WorkspaceLayout>
  )
}

