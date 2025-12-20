"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { FileText, Search, MessageSquare } from "lucide-react"
import ChatInterface from "@/components/ChatInterface"

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const workspaceId = params.id as string

  const handleSessionCreated = (sessionId: string) => {
    // Optional: Update URL with session ID if needed
    console.log("Chat session created:", sessionId)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/workspaces"
            className="text-blue-600 hover:text-blue-700 text-sm mb-2 inline-block"
          >
            ← Back to Workspaces
          </Link>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-6 border-b">
          <Link
            href={`/workspaces/${workspaceId}/documents`}
            className="px-4 py-2 flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <FileText className="w-4 h-4" />
            Documents
          </Link>
          <Link
            href={`/workspaces/${workspaceId}/search`}
            className="px-4 py-2 flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <Search className="w-4 h-4" />
            Search
          </Link>
          <Link
            href={`/workspaces/${workspaceId}/chat`}
            className="px-4 py-2 flex items-center gap-2 text-blue-600 border-b-2 border-blue-600"
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </Link>
        </div>

        {/* Chat Interface */}
        <ChatInterface
          workspaceId={workspaceId}
          sessionId={null}
          onSessionCreated={handleSessionCreated}
        />
      </div>
    </div>
  )
}


