"use client"

import { useState, useEffect } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import type { Page } from "@trace/shared"
import PageDisplay from "./PageDisplay"

interface PageViewerModalProps {
  pages: Page[]
  initialPageId?: string
  onClose: () => void
}

export default function PageViewerModal({ pages, initialPageId, onClose }: PageViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  // Set initial page index
  useEffect(() => {
    if (initialPageId && pages.length > 0) {
      const index = pages.findIndex(p => p._id?.toString() === initialPageId)
      if (index >= 0) {
        setCurrentIndex(index)
      }
    }
  }, [initialPageId, pages])

  if (pages.length === 0) return null

  const currentPage = pages[currentIndex]
  if (!currentPage) return null

  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex < pages.length - 1

  const goToPrevious = () => {
    if (hasPrevious) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const goToNext = () => {
    if (hasNext) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && hasPrevious) {
      goToPrevious()
    } else if (e.key === 'ArrowRight' && hasNext) {
      goToNext()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Navigation Arrows */}
        {hasPrevious && (
          <button
            onClick={goToPrevious}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white rounded-full p-3 shadow-lg border border-gray-200 hover:bg-gray-50 transition"
            title="Previous page (←)"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
        )}
        {hasNext && (
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white rounded-full p-3 shadow-lg border border-gray-200 hover:bg-gray-50 transition"
            title="Next page (→)"
          >
            <ChevronRight className="w-6 h-6 text-gray-700" />
          </button>
        )}

        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">
            Page {currentPage.pageNumber}
            {pages.length > 1 && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({currentIndex + 1} of {pages.length})
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="overflow-hidden max-h-[calc(90vh-8rem)]">
          <PageDisplay page={currentPage} showMetadata={true} />
        </div>
      </div>
    </div>
  )
}

