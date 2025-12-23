"use client"

import { useState, useRef } from "react"

interface DocumentUploadProps {
  workspaceId: string
  onUploadComplete: () => void
}

export default function DocumentUpload({ workspaceId, onUploadComplete }: DocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{current: number; total: number; filename: string} | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList) => {
    const fileArray = Array.from(files)
    
    // Validate all files first
    for (const file of fileArray) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError(`${file.name} is not a PDF file. Only PDF files are supported.`)
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
        setError(`${file.name} (${sizeMB}MB) exceeds the 10MB browser upload limit. Please use "Add from URL" for larger files.`)
        return
      }
    }

    setError("")
    setIsUploading(true)
    
    // Upload files sequentially
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]
      setUploadProgress({ current: i + 1, total: fileArray.length, filename: file.name })
      
      try {
        // Convert to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            const base64 = result.split(",")[1]
            resolve(base64)
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        // Upload
        const response = await fetch(`/api/workspaces/${workspaceId}/documents`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: file.name,
            file: base64,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to upload document")
        }
      } catch (err: any) {
        setError(`Failed to upload ${file.name}: ${err.message}`)
        setIsUploading(false)
        setUploadProgress(null)
        return
      }
    }
    
    setIsUploading(false)
    setUploadProgress(null)
    onUploadComplete()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
    // Reset input so same files can be selected again
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-gray-300 dark:border-gray-700"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="py-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            {uploadProgress ? (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                  Uploading {uploadProgress.current} of {uploadProgress.total}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 truncate px-4">
                  {uploadProgress.filename}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">Uploading...</p>
            )}
          </div>
        ) : (
          <>
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Drag and drop PDF files here, or click to select
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Select PDF Files
            </button>
            <p className="mt-2 text-xs text-gray-500">
              Maximum file size: 10MB for browser uploads
            </p>
            <p className="mt-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
              💡 For larger files, use "Add from URL" below
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}

