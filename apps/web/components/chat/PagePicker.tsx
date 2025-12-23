"use client"

import { useState, useEffect } from "react"
import { X, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import type { Document, Page } from "@trace/shared"

interface PagePickerProps {
  workspaceId: string
  onPageSelected: (page: Page) => void
  onClose: () => void
}

export default function PagePicker({ workspaceId, onPageSelected, onClose }: PagePickerProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string>("")
  const [pages, setPages] = useState<Page[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [isLoadingDocs, setIsLoadingDocs] = useState(true)
  const [isLoadingPages, setIsLoadingPages] = useState(false)

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
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`)
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.workspace.documents || [])
        // Auto-select first document if available
        if (data.workspace.documents?.length > 0) {
          setSelectedDocId(data.workspace.documents[0]._id)
        }
      }
    } catch (error) {
      console.error("Error loading documents:", error)
    } finally {
      setIsLoadingDocs(false)
    }
  }

  const loadPages = async (documentId: string) => {
    setIsLoadingPages(true)
    setCurrentPageIndex(0)
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/documents/${documentId}/pages`)
      if (response.ok) {
        const data = await response.json()
        // Fetch full page data for each page
        const pagePromises = data.pages.map((p: any) =>
          fetch(`/api/workspaces/${workspaceId}/pages/${p._id}`).then(r => r.json())
        )
        const fullPages = await Promise.all(pagePromises)
        setPages(fullPages)
      }
    } catch (error) {
      console.error("Error loading pages:", error)
    } finally {
      setIsLoadingPages(false)
    }
  }

  const handleAddPage = () => {
    if (pages[currentPageIndex]) {
      onPageSelected(pages[currentPageIndex])
      // Don't close modal - allow adding multiple pages
    }
  }

  const currentPage = pages[currentPageIndex]
  const selectedDoc = documents.find(d => d._id === selectedDocId)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
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

        {/* Document Selector + Add Button */}
        <div className="p-4 border-b flex items-center gap-3">
          <label className="text-sm font-medium whitespace-nowrap">Document:</label>
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoadingDocs}
          >
            {documents.map((doc) => (
              <option key={doc._id} value={doc._id}>
                {doc.name} ({doc.pageCount} pages)
              </option>
            ))}
          </select>
          <button
            onClick={handleAddPage}
            disabled={!currentPage}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Page
          </button>
        </div>

        {/* Page Viewer */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoadingPages ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-500">Loading pages...</div>
            </div>
          ) : currentPage ? (
            <>
              {/* Page Image */}
              <div className="flex-1 overflow-auto bg-gray-100 p-4">
                <div className="max-w-3xl mx-auto">
                  <img
                    src={`data:image/png;base64,${currentPage.imageData}`}
                    alt={`Page ${currentPage.pageNumber}`}
                    className="w-full border shadow-lg bg-white"
                  />
                </div>
              </div>

              {/* Navigation */}
              <div className="p-4 border-t bg-white flex items-center justify-between">
                <button
                  onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentPageIndex === 0}
                  className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                <span className="text-sm font-medium">
                  Page {currentPage.pageNumber} of {selectedDoc?.pageCount || pages.length}
                </span>

                <button
                  onClick={() => setCurrentPageIndex(prev => Math.min(pages.length - 1, prev + 1))}
                  disabled={currentPageIndex >= pages.length - 1}
                  className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              No pages available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

