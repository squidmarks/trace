"use client"

import { useState, useEffect } from "react"
import { FileText, Link as LinkIcon, CheckCircle2, Clock, AlertCircle, Loader2, RefreshCw } from "lucide-react"
import ConfirmButton from "./ConfirmButton"
import PageViewerModal from "./PageViewerModal"
import { useEvents } from "@/contexts/EventContext"
import type { Document as TraceDocument, Role, Page } from "@trace/shared"

interface DocumentsListProps {
  documents: TraceDocument[]
  role: Role
  onDelete: (documentId: string) => Promise<void>
  onReindex: (documentId: string) => void
  workspaceId: string
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function DocumentStatusBadge({ doc }: { doc: TraceDocument }) {
  if (doc.status === "ready" && doc.indexedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-1 rounded-full border border-green-200 dark:border-green-800">
        <CheckCircle2 size={12} />
        Indexed {formatRelativeTime(new Date(doc.indexedAt))}
      </span>
    )
  }
  
  if (doc.status === "processing") {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full border border-blue-200 dark:border-blue-800">
        <Loader2 size={12} className="animate-spin" />
        Indexing...
      </span>
    )
  }
  
  if (doc.status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-2 py-1 rounded-full border border-red-200 dark:border-red-800">
        <AlertCircle size={12} />
        Failed
      </span>
    )
  }
  
  // queued or no status
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700">
      <Clock size={12} />
      Not indexed
    </span>
  )
}

interface PageSummary {
  _id: string
  pageNumber: number
}

function DocumentItem({ 
  doc, 
  role, 
  workspaceId, 
  onDelete,
  onReindex,
  onPageClick 
}: { 
  doc: TraceDocument
  role: Role
  workspaceId: string
  onDelete: (documentId: string) => Promise<void>
  onReindex: (documentId: string) => void
  onPageClick: (pageId: string, allPageIds: string[]) => void
}) {
  const [pages, setPages] = useState<PageSummary[]>([])
  const [isLoadingPages, setIsLoadingPages] = useState(false)

  useEffect(() => {
    // Only fetch pages if document is indexed
    if (doc.status === "ready" && doc.indexedAt) {
      fetchPages()
    }
  }, [doc.status, doc.indexedAt])

  const fetchPages = async () => {
    setIsLoadingPages(true)
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/documents/${doc._id.toString()}/pages`
      )
      if (response.ok) {
        const data = await response.json()
        setPages(data.pages || [])
      }
    } catch (error) {
      console.error("Error fetching pages:", error)
    } finally {
      setIsLoadingPages(false)
    }
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition">
      {/* Document Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex-1">
          <h3 className="font-medium mb-1">{doc.filename}</h3>
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
            <DocumentStatusBadge doc={doc} />
          </div>
        </div>

        {role === "owner" && (
          <div className="flex items-center gap-2">
            <ConfirmButton
              onConfirm={() => onReindex(doc._id.toString())}
              confirmText="Re-index document?"
              className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition flex items-center gap-1"
            >
              <RefreshCw size={14} />
              Re-index
            </ConfirmButton>
            <ConfirmButton
              onConfirm={() => onDelete(doc._id.toString())}
              confirmText="Delete document?"
              className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
            >
              Delete
            </ConfirmButton>
          </div>
        )}
      </div>

      {/* Page Thumbnails */}
      {doc.status === "ready" && doc.indexedAt && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50">
          {isLoadingPages ? (
            <div className="flex items-center justify-center py-4 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin mr-2" />
              Loading pages...
            </div>
          ) : pages.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="flex gap-2">
                {pages.map((page) => (
                  <button
                    key={page._id}
                    onClick={() => onPageClick(page._id, pages.map(p => p._id))}
                    className="flex-shrink-0 group relative"
                    title={`Page ${page.pageNumber}`}
                  >
                    <div className="w-20 h-24 border-2 border-gray-300 dark:border-gray-600 rounded overflow-hidden group-hover:border-blue-500 transition-colors bg-white">
                      <img
                        src={`/api/workspaces/${workspaceId}/pages/${page._id}/thumbnail`}
                        alt={`Page ${page.pageNumber}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5">
                      <span className="text-white text-xs font-medium">{page.pageNumber}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-sm text-gray-500">
              No pages available
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DocumentsList({ documents, role, onDelete, onReindex, workspaceId }: DocumentsListProps) {
  const [modalPages, setModalPages] = useState<Page[]>([])
  const [initialPageId, setInitialPageId] = useState<string | undefined>(undefined)
  const [isLoadingPages, setIsLoadingPages] = useState(false)

  const handlePageClick = async (pageId: string, allPageIds: string[]) => {
    setIsLoadingPages(true)
    try {
      // Fetch all pages for this document
      const pagePromises = allPageIds.map(id =>
        fetch(`/api/workspaces/${workspaceId}/pages/${id}`).then(r => r.json())
      )
      const pages = await Promise.all(pagePromises)
      setModalPages(pages)
      setInitialPageId(pageId)
    } catch (error) {
      console.error("Error fetching pages:", error)
    } finally {
      setIsLoadingPages(false)
    }
  }

  const handleCloseModal = () => {
    setModalPages([])
    setInitialPageId(undefined)
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600 dark:text-gray-400">
        <p>No documents yet</p>
        <p className="text-sm mt-2">Upload a PDF to get started</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {documents.map((doc) => (
          <DocumentItem
            key={doc._id.toString()}
            doc={doc}
            role={role}
            workspaceId={workspaceId}
            onDelete={onDelete}
            onReindex={onReindex}
            onPageClick={handlePageClick}
          />
        ))}
      </div>

      {/* Page Viewer Modal */}
      <PageViewerModal
        pages={modalPages}
        initialPageId={initialPageId}
        onClose={handleCloseModal}
      />
    </>
  )
}

