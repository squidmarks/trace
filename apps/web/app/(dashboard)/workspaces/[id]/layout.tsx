"use client"

import { useParams, usePathname } from "next/navigation"
import Link from "next/link"
import { FileText, Search, Settings } from "lucide-react"
import WorkspaceLayout from "@/components/WorkspaceLayout"

export default function WorkspaceIdLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = usePathname()
  const workspaceId = params.id as string

  // Determine active tab based on pathname
  const isDocumentsActive = pathname?.endsWith('/documents')
  const isSearchActive = pathname?.endsWith('/search')
  const isSettingsActive = pathname?.endsWith('/settings')

  return (
    <WorkspaceLayout>
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Tab Navigation */}
          <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <Link
                href={`/workspaces/${workspaceId}/documents`}
                className={`border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
                  isDocumentsActive
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText size={18} />
                  Documents
                </div>
              </Link>
              <Link
                href={`/workspaces/${workspaceId}/search`}
                className={`border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
                  isSearchActive
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Search size={18} />
                  Search
                </div>
              </Link>
              <Link
                href={`/workspaces/${workspaceId}/settings`}
                className={`border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
                  isSettingsActive
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Settings size={18} />
                  Settings
                </div>
              </Link>
            </nav>
          </div>

          {/* Tab Content */}
          {children}
        </div>
      </div>
    </WorkspaceLayout>
  )
}

