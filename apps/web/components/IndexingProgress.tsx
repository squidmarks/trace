"use client"

import { memo } from "react"
import { AlertCircle, CheckCircle2, Sparkles, XCircle } from "lucide-react"

interface IndexProgressData {
  phase: string
  currentDocument?: {
    id: string
    filename: string
    current: number
    total: number
    totalPages: number
    processedPages: number
    analyzedPages: number
  }
  totalDocuments?: number
  processedDocuments?: number
  totalPages?: number
  processedPages?: number
  analyzedPages?: number
  etaSeconds?: number
  pageCount?: number
  documentCount?: number
  cost?: number
  error?: string
}

interface IndexingProgressProps {
  progress: IndexProgressData
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return `${minutes}m ${remainingSeconds}s`
}

function IndexingProgressComponent({ progress }: IndexingProgressProps) {
  if (progress.phase === "error") {
    return (
      <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <XCircle className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" size={20} />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">
              Indexing Failed
            </h3>
            <p className="text-sm text-red-600 dark:text-red-400">{progress.error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (progress.phase === "complete") {
    return (
      <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0"
            size={20}
          />
          <div className="flex-1">
            <h3 className="font-semibold text-green-900 dark:text-green-200 mb-1">
              Indexing Complete!
            </h3>
            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <p className="flex items-center gap-1">
                <Sparkles size={14} />
                Indexed {progress.pageCount} pages across {progress.documentCount} document(s)
              </p>
              {progress.cost && <p className="font-mono">💰 Cost: ${progress.cost.toFixed(4)}</p>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Processing phase - use current document progress
  const currentDoc = progress.currentDocument
  const docPercentage = currentDoc
    ? currentDoc.analyzedPages > 0
      ? Math.round((currentDoc.analyzedPages / currentDoc.totalPages) * 100)
      : currentDoc.processedPages > 0
      ? Math.round((currentDoc.processedPages / currentDoc.totalPages) * 100)
      : 0
    : 0

  const phaseText = currentDoc?.analyzedPages && currentDoc.analyzedPages > 0 ? "Analyzing" : "Rendering"

  return (
    <div className="mb-6 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg shadow-lg p-5">
      <div className="flex items-start gap-4">
        <div className="mt-1">
          <Sparkles className="animate-pulse" size={24} />
        </div>
        <div className="flex-1 min-w-0">
          {/* Current Document Progress */}
          {currentDoc && (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg mb-1">
                    {phaseText} Document {currentDoc.current} of {currentDoc.total}
                  </h3>
                  <p className="text-sm text-white/90 truncate" title={currentDoc.filename}>
                    {currentDoc.filename}
                  </p>
                </div>
                <span className="ml-3 text-lg font-semibold text-white">{docPercentage}%</span>
              </div>
              
              <div className="mb-2">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-white/90">
                    {currentDoc.analyzedPages > 0
                      ? `${currentDoc.analyzedPages} / ${currentDoc.totalPages} pages analyzed`
                      : currentDoc.processedPages > 0
                      ? `${currentDoc.processedPages} / ${currentDoc.totalPages} pages rendered`
                      : `0 / ${currentDoc.totalPages} pages`}
                  </span>
                  {progress.etaSeconds && progress.etaSeconds > 0 && (
                    <span className="text-white/80 text-xs">
                      ⏱️ Est. {formatEta(progress.etaSeconds)} remaining
                    </span>
                  )}
                </div>
                <div className="w-full h-2.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full shadow-sm"
                    style={{
                      width: `${Math.min(100, docPercentage)}%`,
                      transition: "width 0.3s ease-out",
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Custom comparison to only re-render when meaningful values change
const IndexingProgress = memo(IndexingProgressComponent, (prev, next) => {
  // Always re-render for phase changes
  if (prev.progress.phase !== next.progress.phase) return false
  
  // For error/complete phases, compare error messages
  if (next.progress.phase === "error" && prev.progress.error !== next.progress.error) return false
  if (next.progress.phase === "complete") return true // Don't re-render complete state
  
  // For processing phase, only re-render if meaningful values changed
  const prevDoc = prev.progress.currentDocument
  const nextDoc = next.progress.currentDocument
  
  if (!prevDoc && !nextDoc) return true // No change
  if (!prevDoc || !nextDoc) return false // One is missing, re-render
  
  // Re-render if document changed
  if (prevDoc.id !== nextDoc.id) return false
  
  // Re-render if page counts changed
  if (prevDoc.analyzedPages !== nextDoc.analyzedPages) return false
  if (prevDoc.processedPages !== nextDoc.processedPages) return false
  if (prevDoc.totalPages !== nextDoc.totalPages) return false
  
  // Re-render if percentage changed by more than 1%
  const prevPercentage = prevDoc.analyzedPages > 0
    ? Math.round((prevDoc.analyzedPages / prevDoc.totalPages) * 100)
    : Math.round((prevDoc.processedPages / prevDoc.totalPages) * 100)
  const nextPercentage = nextDoc.analyzedPages > 0
    ? Math.round((nextDoc.analyzedPages / nextDoc.totalPages) * 100)
    : Math.round((nextDoc.processedPages / nextDoc.totalPages) * 100)
  
  if (Math.abs(prevPercentage - nextPercentage) >= 1) return false
  
  // Don't re-render for minor ETA fluctuations
  return true
})

IndexingProgress.displayName = "IndexingProgress"

export default IndexingProgress
