"use client"

import { useState, useEffect } from "react"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { X, ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight } from "lucide-react"
import type { Page } from "@trace/shared"

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
          {/* Zoomable Page Image */}
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={4}
            doubleClick={{ mode: "toggle" }}
            wheel={{ step: 0.1 }}
            pinch={{ step: 5 }}
            panning={{ velocityDisabled: true }}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <div className="relative h-full">
                {/* Zoom Controls */}
                <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white rounded-lg shadow-lg border border-gray-200 p-2">
                  <button
                    onClick={() => zoomIn()}
                    className="p-2 hover:bg-gray-100 rounded transition"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-5 h-5 text-gray-700" />
                  </button>
                  <button
                    onClick={() => zoomOut()}
                    className="p-2 hover:bg-gray-100 rounded transition"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-5 h-5 text-gray-700" />
                  </button>
                  <button
                    onClick={() => resetTransform()}
                    className="p-2 hover:bg-gray-100 rounded transition"
                    title="Reset Zoom"
                  >
                    <Maximize2 className="w-5 h-5 text-gray-700" />
                  </button>
                </div>

                {/* Scrollable Container */}
                <div className="overflow-y-auto max-h-[calc(90vh-8rem)] p-4">
                  <TransformComponent
                    wrapperStyle={{ width: "100%", height: "100%" }}
                    contentStyle={{ width: "100%" }}
                  >
                    <img
                      src={`data:image/jpeg;base64,${currentPage.imageData}`}
                      alt={`Page ${currentPage.pageNumber}`}
                      className="w-full rounded-lg shadow-lg mb-4 cursor-move"
                    />
                  </TransformComponent>

                  {/* Analysis Section */}
                  {currentPage.analysis && (
                    <div className="space-y-3 mt-4">
                      <div>
                        <h4 className="font-semibold text-sm mb-1">Summary</h4>
                        <p className="text-sm text-gray-700">{currentPage.analysis.summary}</p>
                      </div>

                      {currentPage.analysis.topics && currentPage.analysis.topics.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-1">Topics</h4>
                          <div className="flex flex-wrap gap-1">
                            {currentPage.analysis.topics.map((topic, idx) => (
                              <span
                                key={idx}
                                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {currentPage.analysis.entities && currentPage.analysis.entities.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-1">Entities</h4>
                          <div className="flex flex-wrap gap-1">
                            {currentPage.analysis.entities.slice(0, 20).map((entity, idx) => (
                              <span
                                key={idx}
                                className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                              >
                                {entity.text}
                              </span>
                            ))}
                            {currentPage.analysis.entities.length > 20 && (
                              <span className="text-xs text-gray-500 px-2 py-1">
                                +{currentPage.analysis.entities.length - 20} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {currentPage.analysis.connections && currentPage.analysis.connections.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-1">Connections</h4>
                          <div className="flex flex-wrap gap-1">
                            {currentPage.analysis.connections.slice(0, 10).map((conn, idx) => (
                              <span
                                key={idx}
                                className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded"
                                title={`${conn.type} - ${conn.direction}`}
                              >
                                {conn.label}
                              </span>
                            ))}
                            {currentPage.analysis.connections.length > 10 && (
                              <span className="text-xs text-gray-500 px-2 py-1">
                                +{currentPage.analysis.connections.length - 10} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </TransformWrapper>
        </div>
      </div>
    </div>
  )
}

