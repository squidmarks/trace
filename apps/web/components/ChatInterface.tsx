"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Loader2, FileText, X } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { ChatMessage, Citation } from "@trace/shared"

interface PageData {
  imageData: string
  pageNumber: number
  analysis: {
    summary: string
    topics: string[]
  }
}

interface ChatInterfaceProps {
  workspaceId: string
  sessionId: string | null
  onSessionCreated?: (sessionId: string) => void
}

export default function ChatInterface({ workspaceId, sessionId, onSessionCreated }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId)
  const [selectedPage, setSelectedPage] = useState<PageData | null>(null)
  const [isLoadingPage, setIsLoadingPage] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load messages when session changes
  useEffect(() => {
    if (currentSessionId) {
      loadMessages()
    }
  }, [currentSessionId])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const loadMessages = async () => {
    if (!currentSessionId) return

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/chat/${currentSessionId}/messages`
      )
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error("Error loading messages:", error)
    }
  }

  const createSession = async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      if (response.ok) {
        const data = await response.json()
        const newSessionId = data.session._id
        setCurrentSessionId(newSessionId)
        onSessionCreated?.(newSessionId)
        return newSessionId
      }
    } catch (error) {
      console.error("Error creating session:", error)
    }
    return null
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    // Create session if needed
    let sid = currentSessionId
    if (!sid) {
      sid = await createSession()
      if (!sid) {
        alert("Failed to create chat session")
        return
      }
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: input.trim(),
      createdAt: new Date(),
    }

    // Optimistically add user message
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/chat/${sid}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: userMessage.content }),
        }
      )

      if (response.ok) {
        const data = await response.json()
        setMessages((prev) => [...prev, data.message])
      } else {
        throw new Error("Failed to send message")
      }
    } catch (error) {
      console.error("Error sending message:", error)
      alert("Failed to send message. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleCitationClick = async (citation: Citation) => {
    setIsLoadingPage(true)
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/documents/${citation.documentId}/pages/${citation.pageNumber}`
      )
      if (response.ok) {
        const data = await response.json()
        setSelectedPage(data)
      }
    } catch (error) {
      console.error("Error loading page:", error)
    } finally {
      setIsLoadingPage(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-white rounded-lg border">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <p className="text-lg">Start a conversation</p>
            <p className="text-sm mt-2">Ask questions about your documents</p>
          </div>
        )}

        {messages.map((message, idx) => (
          <div
            key={idx}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              <div className={`prose prose-sm max-w-none ${
                message.role === "user" 
                  ? "prose-invert" 
                  : "prose-gray"
              }`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>

              {/* Citations */}
              {message.citations && message.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <div className="text-xs font-semibold mb-2">Sources:</div>
                  <div className="flex flex-wrap gap-2">
                    {message.citations.map((citation: Citation, cidx: number) => (
                      <button
                        key={cidx}
                        onClick={() => handleCitationClick(citation)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full text-xs font-medium transition-colors cursor-pointer"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Page {citation.pageNumber}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tool calls (for debugging) */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-300 text-xs opacity-50">
                  {message.toolCalls.map((tc, tcidx) => (
                    <div key={tcidx}>
                      🔧 {tc.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm text-gray-600">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your documents..."
            className="flex-1 resize-none border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Page Modal */}
      {selectedPage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedPage(null)}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                Page {selectedPage.pageNumber}
              </h3>
              <button
                onClick={() => setSelectedPage(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-8rem)] p-4">
              {/* Page Image */}
              <img
                src={`data:image/jpeg;base64,${selectedPage.imageData}`}
                alt={`Page ${selectedPage.pageNumber}`}
                className="w-full rounded-lg shadow-lg mb-4"
              />

              {/* Analysis */}
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Summary</h4>
                  <p className="text-sm text-gray-700">{selectedPage.analysis.summary}</p>
                </div>

                {selectedPage.analysis.topics && selectedPage.analysis.topics.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Topics</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedPage.analysis.topics.map((topic, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoadingPage && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading page...</span>
          </div>
        </div>
      )}
    </div>
  )
}


