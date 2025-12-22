"use client"

import { AlertCircle, CheckCircle2, Sparkles, XCircle } from "lucide-react"

interface IndexProgressData {
  phase: string
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
  // Progress is based on analyzedPages (AI analysis is the long/expensive part)
  // But show some progress during rendering too
  const percentage =
    progress.analyzedPages && progress.totalPages
      ? Math.round((progress.analyzedPages / progress.totalPages) * 100)
      : progress.processedPages && progress.totalPages
      ? Math.min(5, Math.round((progress.processedPages / progress.totalPages) * 100)) // Cap rendering progress at 5%
      : 0

  return (
    <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" size={20} />
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            Indexing in Progress...
          </h3>
          <div className="mb-2">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
              <span>
                {progress.analyzedPages && progress.analyzedPages > 0
                  ? `${progress.analyzedPages} / ${progress.totalPages || 0} analyzed`
                  : `${progress.processedPages || 0} / ${progress.totalPages || 0} rendered`}
              </span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">{percentage}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-out rounded-full"
                style={{
                  width: `${Math.min(100, percentage)}%`,
                }}
              />
            </div>
            {progress.etaSeconds && progress.etaSeconds > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 text-right">
                Est. {formatEta(progress.etaSeconds)} remaining
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

