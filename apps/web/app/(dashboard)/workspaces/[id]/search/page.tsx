"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Search, FileText, Loader2, AlertCircle, X, ZoomIn, ZoomOut, Maximize2 } from "lucide-react"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import WorkspaceLayout from "@/components/WorkspaceLayout"

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
  const [selectedPage, setSelectedPage] = useState<SearchResult | null>(null)

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
                  onClick={() => setSelectedPage(result)}
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

      {/* Page Viewer Modal with Zoom */}
      {selectedPage && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPage(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold mb-1">{selectedPage.document.filename}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Page {selectedPage.pageNumber}</p>
              </div>
              <button
                onClick={() => setSelectedPage(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content with Zoom */}
            <div className="overflow-hidden max-h-[calc(90vh-8rem)]">
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
                    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2">
                      <button
                        onClick={() => zoomIn()}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => zoomOut()}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => resetTransform()}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
                        title="Reset Zoom"
                      >
                        <Maximize2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Scrollable Container */}
                    <div className="overflow-y-auto max-h-[calc(90vh-8rem)] p-4">
                      <TransformComponent
                        wrapperStyle={{ width: "100%", height: "100%" }}
                        contentStyle={{ width: "100%" }}
                      >
                        <img
                          src={`data:image/jpeg;base64,${selectedPage.imageData}`}
                          alt={`Page ${selectedPage.pageNumber}`}
                          className="w-full rounded-lg shadow-lg mb-4 cursor-move"
                        />
                      </TransformComponent>

                      {/* Analysis Section */}
                      <div className="space-y-3 mt-4">
                        <div>
                          <h4 className="font-semibold text-sm mb-1">Summary</h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{selectedPage.analysis.summary}</p>
                        </div>

                        {selectedPage.analysis.topics.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-1">Topics</h4>
                            <div className="flex flex-wrap gap-2">
                              {selectedPage.analysis.topics.map((topic, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded"
                                >
                                  {topic}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedPage.analysis.entities.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-sm mb-1">Entities</h4>
                            <div className="space-y-1">
                              {selectedPage.analysis.entities.map((entity, idx) => (
                                <div key={idx} className="text-sm">
                                  <span className="font-medium">{entity.type}:</span>{" "}
                                  <span className="text-gray-600 dark:text-gray-400">{entity.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </TransformWrapper>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </WorkspaceLayout>
  )
}

