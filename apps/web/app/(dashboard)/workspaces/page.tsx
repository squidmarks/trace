"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { WorkspaceWithRole } from "@trace/shared"

export default function WorkspacesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<WorkspaceWithRole[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin")
    }
  }, [status, router])

  useEffect(() => {
    if (status === "authenticated") {
      fetchWorkspaces()
    }
  }, [status])

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch("/api/workspaces")
      if (!response.ok) throw new Error("Failed to fetch workspaces")
      
      const data = await response.json()
      
      // Fetch stats for each workspace
      const workspacesWithStats = await Promise.all(
        data.workspaces.map(async (ws: any) => {
          try {
            const statsRes = await fetch(`/api/workspaces/${ws._id}/stats`)
            if (statsRes.ok) {
              const stats = await statsRes.json()
              return { ...ws, ...stats }
            }
          } catch (error) {
            console.error(`Error fetching stats for ${ws._id}:`, error)
          }
          return ws
        })
      )
      
      setWorkspaces(workspacesWithStats)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Workspaces</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage your document collections
            </p>
          </div>
          
          <Link
            href="/workspaces/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + New Workspace
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {workspaces.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-2">No workspaces yet</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first workspace to get started
            </p>
            <Link
              href="/workspaces/new"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Create Workspace
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => (
              <Link
                key={workspace._id.toString()}
                href={`/workspaces/${workspace._id}/documents`}
                className="block p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {workspace.name}
                  </h3>
                  <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    {workspace.role}
                  </span>
                </div>

                {workspace.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                    {workspace.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
                  <div className="flex items-center gap-2">
                    {(workspace as any).documentCount > 0 && (
                      <span>📄 {(workspace as any).documentCount}</span>
                    )}
                    {(workspace as any).pageCount > 0 && (
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        ✅ {(workspace as any).pageCount} pages
                      </span>
                    )}
                  </div>
                  <span>
                    {new Date(workspace.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

