"use client"

import { X, FileText } from "lucide-react"
import type { Page } from "@trace/shared"

interface SelectedPagePillProps {
  page: Page
  documentName: string
  onRemove: () => void
  onClick?: () => void
}

export default function SelectedPagePill({ page, documentName, onRemove, onClick }: SelectedPagePillProps) {
  // Truncate document name if too long
  const truncatedName = documentName.length > 25 
    ? documentName.substring(0, 22) + "..." 
    : documentName

  return (
    <div 
      className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-sm group hover:bg-blue-100 transition-colors"
      title={`${documentName} - Page ${page.pageNumber}`}
    >
      <FileText className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
      <button
        type="button"
        onClick={onClick}
        className="text-blue-800 hover:text-blue-900 font-medium"
      >
        {truncatedName} p.{page.pageNumber}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="text-blue-400 hover:text-blue-600 ml-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

