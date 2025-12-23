"use client"

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

export default function IndexingProgress({ progress }: IndexingProgressProps) {
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

  // Processing phase
  const percentage =
    progress.analyzedPages && progress.totalPages && progress.analyzedPages > 0
      ? Math.round((progress.analyzedPages / progress.totalPages) * 100)
      : progress.processedPages && progress.totalPages
      ? Math.round((progress.processedPages / progress.totalPages) * 100)
      : 0

  // Determine current document progress
  const currentDoc = progress.currentDocument
  const docPercentage = currentDoc
    ? currentDoc.analyzedPages > 0
      ? Math.round((currentDoc.analyzedPages / currentDoc.totalPages) * 100)
      : currentDoc.processedPages > 0
      ? Math.round((currentDoc.processedPages / currentDoc.totalPages) * 100)
      : 0
    : 0

  const phaseText = progress.analyzedPages && progress.analyzedPages > 0 ? "Analyzing" : "Rendering"

  return (
    <div className="mb-6 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg shadow-lg p-5">
      <div className="flex items-start gap-4">
        <div className="mt-1">
          <Sparkles className="animate-pulse" size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg">Indexing Workspace</h3>
            <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">
              {percentage}%
            </span>
          </div>

          {/* Current Document */}
          {currentDoc && (
            <div className="mb-3 bg-white/10 rounded-lg p-3 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/90 mb-0.5">
                    {phaseText} Document {currentDoc.current} of {currentDoc.total}
                  </p>
                  <p className="text-sm text-white truncate" title={currentDoc.filename}>
                    {currentDoc.filename}
                  </p>
                </div>
                <span className="ml-3 text-sm font-semibold text-white">{docPercentage}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-300 ease-out rounded-full"
                  style={{
                    width: `${Math.min(100, docPercentage)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Overall Progress */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-white/90">
                Overall: {progress.processedDocuments || 0} / {progress.totalDocuments || 0} documents
                {" • "}
                {progress.analyzedPages && progress.analyzedPages > 0
                  ? `${progress.analyzedPages} / ${progress.totalPages || 0} pages analyzed`
                  : `${progress.processedPages || 0} / ${progress.totalPages || 0} pages rendered`}
              </span>
            </div>
            <div className="w-full h-2.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300 ease-out rounded-full shadow-sm"
                style={{
                  width: `${Math.min(100, percentage)}%`,
                }}
              />
            </div>
            {progress.etaSeconds && progress.etaSeconds > 0 && (
              <div className="text-xs text-white/80 mt-2 text-right">
                ⏱️ Est. {formatEta(progress.etaSeconds)} remaining
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

