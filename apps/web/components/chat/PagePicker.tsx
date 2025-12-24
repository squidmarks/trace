"use client"

import { useState, useEffect } from "react"
import { X, Eye } from "lucide-react"
import type { Document, Page } from "@trace/shared"
import PageViewerModal from "../PageViewerModal"

interface PagePickerProps {
  workspaceId: string
  onPageSelected: (page: Page, documentName: string) => void
  onClose: () => void
}

export default function PagePicker({ workspaceId, onPageSelected, onClose }: PagePickerProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string>("")
  const [pages, setPages] = useState<Page[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(true)
  const [isLoadingPages, setIsLoadingPages] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewPages, setPreviewPages] = useState<Page[]>([])
  const [previewInitialPageId, setPreviewInitialPageId] = useState<string | undefined>(undefined)

  // Load documents on mount
  useEffect(() => {
    loadDocuments()
  }, [workspaceId])

  // Load pages when document changes
  useEffect(() => {
    if (selectedDocId) {
      loadPages(selectedDocId)
    }
  }, [selectedDocId])

  const loadDocuments = async () => {
    setIsLoadingDocs(true)
    setError(null)
    try {
      console.log('[PagePicker] Loading documents for workspace:', workspaceId)
      const response = await fetch(`/api/workspaces/${workspaceId}/documents`)
      if (response.ok) {
        const data = await response.json()
        console.log('[PagePicker] Documents loaded:', data.documents?.length || 0)
        const docs = data.documents || []
        setDocuments(docs)
        // Auto-select first indexed document if available
        const indexedDoc = docs.find((d: Document) => d.status === 'ready')
        if (indexedDoc) {
          setSelectedDocId(indexedDoc._id)
          console.log('[PagePicker] Auto-selected indexed document:', indexedDoc.filename)
        } else if (docs.length > 0) {
          setSelectedDocId(docs[0]._id)
          console.log('[PagePicker] Auto-selected first document:', docs[0].filename)
        } else {
          setError("No documents found in workspace. Please add documents first.")
        }
      } else {
        const errorText = await response.text()
        console.error('[PagePicker] Failed to load documents:', response.status, errorText)
        setError(`Failed to load documents: ${response.status}`)
      }
    } catch (error) {
      console.error("[PagePicker] Error loading documents:", error)
      setError("Failed to load documents")
    } finally {
      setIsLoadingDocs(false)
    }
  }

  const loadPages = async (documentId: string) => {
    setIsLoadingPages(true)
    setError(null)
    try {
      console.log('[PagePicker] Loading pages for document:', documentId)
      const response = await fetch(`/api/workspaces/${workspaceId}/documents/${documentId}/pages`)
      if (response.ok) {
        const data = await response.json()
        console.log('[PagePicker] Page summaries loaded:', data.pages?.length || 0)
        
        if (!data.pages || data.pages.length === 0) {
          setPages([])
          setError("This document has no indexed pages. Please index the workspace first.")
          return
        }
        
        // Fetch full page data for each page
        console.log('[PagePicker] Fetching full page data...')
        const pagePromises = data.pages.map((p: any) =>
          fetch(`/api/workspaces/${workspaceId}/pages/${p._id}`).then(r => {
            if (!r.ok) throw new Error(`Failed to fetch page ${p._id}`)
            return r.json()
          })
        )
        const fullPages = await Promise.all(pagePromises)
        console.log('[PagePicker] Full pages loaded:', fullPages.length)
        setPages(fullPages)
      } else {
        const errorText = await response.text()
        console.error('[PagePicker] Failed to load pages:', response.status, errorText)
        setError(`Failed to load pages: ${response.status}`)
      }
    } catch (error) {
      console.error("[PagePicker] Error loading pages:", error)
      setError("Failed to load pages: " + (error instanceof Error ? error.message : String(error)))
    } finally {
      setIsLoadingPages(false)
    }
  }

  const handleAddPage = (page: Page) => {
    const doc = documents.find(d => d._id === selectedDocId)
    if (doc) {
      onPageSelected(page, doc.filename)
      // Don't close modal - allow adding multiple pages
    }
  }

  const handlePreviewPage = (page: Page) => {
    setPreviewPages(pages)
    setPreviewInitialPageId(page._id.toString())
  }

  const selectedDoc = documents.find(d => d._id === selectedDocId)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Add Page to Chat</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Document Selector */}
        <div className="p-4 border-b flex items-center gap-3">
          <label className="text-sm font-medium whitespace-nowrap">Document:</label>
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoadingDocs || documents.length === 0}
          >
            {documents.length === 0 && !isLoadingDocs ? (
              <option value="">No documents found</option>
            ) : (
              documents.map((doc) => (
                <option key={doc._id} value={doc._id}>
                  {doc.filename} ({doc.pageCount} pages)
                </option>
              ))
            )}
          </select>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            {error}
          </div>
        )}

        {/* Page Thumbnails Grid */}
        <div className="flex-1 overflow-auto p-4 bg-gray-50">
          {isLoadingPages ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Loading pages...</div>
            </div>
          ) : pages.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {pages.map((page) => (
                <div
                  key={page._id.toString()}
                  className="flex flex-col gap-2 bg-white rounded-lg border shadow-sm p-3 hover:shadow-md transition-shadow"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-[3/4] bg-gray-100 rounded overflow-hidden">
                    <img
                      src={`/api/workspaces/${workspaceId}/pages/${page._id}/thumbnail`}
                      alt={`Page ${page.pageNumber}`}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => handlePreviewPage(page)}
                      loading="lazy"
                    />
                    <button
                      onClick={() => handlePreviewPage(page)}
                      className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-full shadow-sm"
                      title="Preview page"
                    >
                      <Eye className="w-4 h-4 text-gray-700" />
                    </button>
                  </div>
                  
                  {/* Page Info and Add Button */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      Page {page.pageNumber}
                    </span>
                    <button
                      onClick={() => handleAddPage(page)}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center">
              <p className="text-lg font-medium mb-2">No pages available</p>
              <p className="text-sm">
                {documents.length === 0 
                  ? "No documents in this workspace" 
                  : "This document may not be indexed yet. Please index the workspace from the Documents page."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Page Viewer Modal for Preview */}
      <PageViewerModal
        pages={previewPages}
        initialPageId={previewInitialPageId}
        onClose={() => {
          setPreviewPages([])
          setPreviewInitialPageId(undefined)
        }}
      />
    </div>
  )
}

