"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { FileText, CheckCircle2, Zap, Search, MessageSquare } from "lucide-react"
import type { Workspace, Role } from "@trace/shared"

export default function WorkspaceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchWorkspace()
    fetchStats()
  }, [params.id])

  const fetchWorkspace = async () => {
    try {
      const response = await fetch(`/api/workspaces/${params.id}`)
      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
          router.push("/")
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

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/workspaces/${params.id}/stats`)
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Error fetching stats:", error)
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
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Back to Chat
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{workspace.name}</h1>
              {workspace.description && (
                <p className="text-gray-600 dark:text-gray-400 mb-3">
                  {workspace.description}
                </p>
              )}
              {stats && (stats.documentCount > 0 || stats.pageCount > 0) && (
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  {stats.documentCount > 0 && (
                    <span className="flex items-center gap-1">
                      <FileText size={16} />
                      {stats.documentCount} {stats.documentCount === 1 ? 'document' : 'documents'}
                    </span>
                  )}
                  {stats.pageCount > 0 && (
                    <>
                      <span>•</span>
                      <span className="font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle2 size={16} />
                        {stats.pageCount} {stats.pageCount === 1 ? 'page' : 'pages'} indexed
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
            <span className="px-3 py-1 text-sm rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              {role}
            </span>
          </div>

          <div className="space-y-6">
            {/* Quick Actions */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link
                  href={`/workspaces/${params.id}/documents`}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition"
                >
                  <div className="flex items-start gap-3">
                    <FileText size={24} className="text-blue-600 dark:text-blue-400" />
                    <div>
                      <h3 className="font-semibold mb-1">Documents</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Upload and manage PDF documents
                      </p>
                    </div>
                  </div>
                </Link>

                <Link
                  href={`/workspaces/${params.id}/search`}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition"
                >
                  <div className="flex items-start gap-3">
                    <Search size={24} className="text-blue-600 dark:text-blue-400" />
                    <div>
                      <h3 className="font-semibold mb-1">Search</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Search indexed pages semantically
                      </p>
                    </div>
                  </div>
                </Link>

                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg opacity-50">
                  <div className="flex items-start gap-3">
                    <MessageSquare size={24} className="text-gray-400" />
                    <div>
                      <h3 className="font-semibold mb-1">Chat</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Coming in Phase 5
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid md:grid-cols-3 gap-4">
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
                <h3 className="font-semibold mb-2">Documents</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats?.documentCount || 0}
                </p>
              </div>

              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h3 className="font-semibold mb-2">Indexed Pages</h3>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats?.pageCount || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

