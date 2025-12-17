"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import type { Workspace, Role } from "@trace/shared"

export default function WorkspaceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchWorkspace()
  }, [params.id])

  const fetchWorkspace = async () => {
    try {
      const response = await fetch(`/api/workspaces/${params.id}`)
      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
          router.push("/workspaces")
          return
        }
        throw new Error("Failed to fetch workspace")
      }

      const data = await response.json()
      setWorkspace(data.workspace)
      setRole(data.role)
    } catch (error) {
      console.error("Error fetching workspace:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!workspace) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link
            href="/workspaces"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Back to Workspaces
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{workspace.name}</h1>
              {workspace.description && (
                <p className="text-gray-600 dark:text-gray-400">
                  {workspace.description}
                </p>
              )}
            </div>
            <span className="px-3 py-1 text-sm rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              {role}
            </span>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h2 className="text-lg font-semibold mb-2">✅ Workspace Created Successfully!</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your workspace has been created. The full workspace interface with document management, 
                search, and chat will be available in Phase 1.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="font-semibold mb-2">Status</h3>
                <p className="text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Index Status: </span>
                  <span className={
                    workspace.indexStatus === "ready"
                      ? "text-green-600 dark:text-green-400"
                      : "text-gray-600 dark:text-gray-400"
                  }>
                    {workspace.indexStatus}
                  </span>
                </p>
              </div>

              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="font-semibold mb-2">Created</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {new Date(workspace.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold mb-3">Coming in Phase 1:</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>📄 Document upload and management</li>
                <li>⚡ Real-time indexing progress via Socket.io</li>
                <li>🔍 Search and explore (Phase 4)</li>
                <li>💬 AI chat assistant (Phase 5)</li>
                <li>🧠 Workspace ontology (Phase 6)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

