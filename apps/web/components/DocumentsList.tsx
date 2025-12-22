"use client"

import { FileText, Link as LinkIcon } from "lucide-react"
import ConfirmButton from "./ConfirmButton"
import type { Document as TraceDocument, Role } from "@trace/shared"

interface DocumentsListProps {
  documents: TraceDocument[]
  role: Role
  onDelete: (documentId: string) => Promise<void>
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

