"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import type { Document as TraceDocument, Workspace, Role } from "@trace/shared"
import DocumentUpload from "@/components/DocumentUpload"
import AddFromUrlModal from "@/components/AddFromUrlModal"
import SocketTest from "@/components/SocketTest"

export default function DocumentsPage() {
  const params = useParams()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [documents, setDocuments] = useState<TraceDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showUrlModal, setShowUrlModal] = useState(false)

  useEffect(() => {
    fetchWorkspace()
    fetchDocuments()
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

        {/* Socket.io Connection Test */}
        <div className="mb-6">
          <SocketTest workspaceId={params.id as string} />
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
          <h2 className="text-xl font-semibold mb-4">
            Documents ({documents.length})
          </h2>

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

