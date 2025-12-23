"use client"

import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react"
import type { Page } from "@trace/shared"

interface PageDisplayProps {
  page: Page
  showMetadata?: boolean
  className?: string
}

export default function PageDisplay({ page, showMetadata = true, className = "" }: PageDisplayProps) {
  return (
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
        <div className={`relative h-full ${className}`}>
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
                src={`data:image/jpeg;base64,${page.imageData}`}
                alt={`Page ${page.pageNumber}`}
                className="w-full rounded-lg shadow-lg mb-4 cursor-move"
              />
            </TransformComponent>

            {/* Analysis Section */}
            {showMetadata && page.analysis && (
              <div className="space-y-3 mt-4">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Summary</h4>
                  <p className="text-sm text-gray-700">{page.analysis.summary}</p>
                </div>

                {page.analysis.topics && page.analysis.topics.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Topics</h4>
                    <div className="flex flex-wrap gap-1">
                      {page.analysis.topics.map((topic, idx) => (
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

                {page.analysis.entities && page.analysis.entities.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Entities</h4>
                    <div className="flex flex-wrap gap-1">
                      {page.analysis.entities.slice(0, 20).map((entity, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                        >
                          {entity.text}
                        </span>
                      ))}
                      {page.analysis.entities.length > 20 && (
                        <span className="text-xs text-gray-500 px-2 py-1">
                          +{page.analysis.entities.length - 20} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {page.analysis.connections && page.analysis.connections.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Connections</h4>
                    <div className="flex flex-wrap gap-1">
                      {page.analysis.connections.slice(0, 10).map((conn, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded"
                          title={`${conn.type} - ${conn.direction}`}
                        >
                          {conn.label}
                        </span>
                      ))}
                      {page.analysis.connections.length > 10 && (
                        <span className="text-xs text-gray-500 px-2 py-1">
                          +{page.analysis.connections.length - 10} more
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
  )
}

