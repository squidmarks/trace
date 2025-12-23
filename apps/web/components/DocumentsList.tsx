"use client"

import { FileText, Link as LinkIcon, CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react"
import ConfirmButton from "./ConfirmButton"
import type { Document as TraceDocument, Role } from "@trace/shared"

interface DocumentsListProps {
  documents: TraceDocument[]
  role: Role
  onDelete: (documentId: string) => Promise<void>
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

export default function DocumentsList({ documents, role, onDelete }: DocumentsListProps) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600 dark:text-gray-400">
        <p>No documents yet</p>
        <p className="text-sm mt-2">Upload a PDF to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div
          key={doc._id.toString()}
          className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition"
        >
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
            <ConfirmButton
              onConfirm={() => onDelete(doc._id.toString())}
              confirmText="Delete document?"
              className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
            >
              Delete
            </ConfirmButton>
          )}
        </div>
      ))}
    </div>
  )
}

