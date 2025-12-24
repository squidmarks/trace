"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Search, FileText, Loader2, AlertCircle } from "lucide-react"
import WorkspaceLayout from "@/components/WorkspaceLayout"
import PageViewerModal from "@/components/PageViewerModal"
import type { Page } from "@trace/shared"

interface SearchResult {
  _id: string
  documentId: string
  document: {
    _id: string
    filename: string
  }
  pageNumber: number
  imageData: string
  analysis: {
    summary: string
    topics: string[]
    entities: Array<{ type: string; value: string }>
    confidence: number
  }
  score: number
}

interface SearchResponse {
  query: string
  results: SearchResult[]
  pagination: {
    total: number
    offset: number
    limit: number
    hasMore: boolean
  }
}

export default function SearchPage() {
  const params = useParams()
  const { data: session, status } = useSession()
  const router = useRouter()

  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewerPages, setViewerPages] = useState<Page[]>([])
  const [viewerInitialPageId, setViewerInitialPageId] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/api/auth/signin")
    }
  }, [status, router])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!query.trim()) return

    setIsSearching(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/workspaces/${params.id}/search?q=${encodeURIComponent(query)}&limit=20`
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Search failed")
      }

      const data: SearchResponse = await response.json()
      setSearchResults(data)
    } catch (err: any) {
      console.error("Search error:", err)
      setError(err.message || "Failed to search")
    } finally {
      setIsSearching(false)
    }
  }

  const handlePageClick = async (result: SearchResult) => {
    try {
      // Fetch full page data
      const response = await fetch(`/api/workspaces/${params.id}/pages/${result._id}`)
      if (response.ok) {
        const page: Page = await response.json()
        setViewerPages([page])
        setViewerInitialPageId(page._id.toString())
      }
    } catch (error) {
      console.error("Error loading page:", error)
    }
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" size={32} />
      </div>
    )
  }

  return (
    <WorkspaceLayout>
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <Link
              href={`/workspaces/${params.id}/documents`}
              className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <div className="flex items-center gap-2">
                <FileText size={18} />
                Documents
              </div>
            </Link>
            <Link
              href={`/workspaces/${params.id}/search`}
              className="border-b-2 border-blue-500 py-4 px-1 text-sm font-medium text-blue-600 dark:text-blue-400"
            >
              <div className="flex items-center gap-2">
                <Search size={18} />
                Search
              </div>
            </Link>
          </nav>
        </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for topics, parts, specifications..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSearching ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Searching...
              </>
            ) : (
              <>
                <Search size={18} />
                Search
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-medium text-red-900 dark:text-red-100">Search Error</p>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {searchResults && (
        <div>
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Found {searchResults.pagination.total} result{searchResults.pagination.total !== 1 ? 's' : ''} for "{searchResults.query}"
          </div>

          {searchResults.results.length === 0 ? (
            <div className="text-center py-12">
              <Search className="mx-auto mb-4 text-gray-400" size={48} />
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">No results found</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Try different keywords or check your spelling
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {searchResults.results.map((result) => (
                <div
                  key={result._id}
                  onClick={() => handlePageClick(result)}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer transition bg-white dark:bg-gray-800"
                >
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="flex-shrink-0">
                      <img
                        src={`data:image/jpeg;base64,${result.imageData}`}
                        alt={`Page ${result.pageNumber}`}
                        className="w-32 h-32 object-contain border border-gray-200 dark:border-gray-700 rounded"
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <FileText size={16} />
                          <span className="font-medium truncate">{result.document.filename}</span>
                          <span>•</span>
                          <span>Page {result.pageNumber}</span>
                        </div>
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                          Score: {result.score.toFixed(2)}
                        </span>
                      </div>

                      {/* Summary */}
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-2">
                        {result.analysis.summary}
                      </p>

                      {/* Topics */}
                      {result.analysis.topics.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {result.analysis.topics.slice(0, 5).map((topic, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Entities */}
                      {result.analysis.entities.length > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          {result.analysis.entities.slice(0, 3).map((entity, idx) => (
                            <span key={idx}>
                              {entity.value}
                              {idx < Math.min(2, result.analysis.entities.length - 1) && ", "}
                            </span>
                          ))}
                          {result.analysis.entities.length > 3 && (
                            <span> +{result.analysis.entities.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Page Viewer Modal */}
      <PageViewerModal
        pages={viewerPages}
        initialPageId={viewerInitialPageId}
        onClose={() => {
          setViewerPages([])
          setViewerInitialPageId(undefined)
        }}
      />
        </div>
      </div>
    </WorkspaceLayout>
  )
}

