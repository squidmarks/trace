"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { Send, Loader2, X, MessageSquare, Plus } from "lucide-react"
import type { ChatMessage, Citation, Page } from "@trace/shared"
import PageViewerModal from "./PageViewerModal"
import MessageBubble from "./chat/MessageBubble"
import StreamingMessage from "./chat/StreamingMessage"
import PagePicker from "./chat/PagePicker"
import SelectedPagePill from "./chat/SelectedPagePill"

interface ChatInterfaceProps {
  workspaceId: string
  sessionId: string | null
  onSessionCreated?: (sessionId: string) => void
  onMessageSent?: () => void
}

export default function ChatInterface({ workspaceId, sessionId, onSessionCreated, onMessageSent }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId)
  const [modalPages, setModalPages] = useState<Page[]>([])
  const [initialPageId, setInitialPageId] = useState<string | undefined>(undefined)
  const [isLoadingPage, setIsLoadingPage] = useState(false)
  const [progressMessage, setProgressMessage] = useState<string>("")
  const [streamingContent, setStreamingContent] = useState<string>("")
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null)
  const [selectedPages, setSelectedPages] = useState<Array<{ page: Page; documentName: string }>>([])
  const [showPagePicker, setShowPagePicker] = useState(false)
  const isSendingFirstMessage = useRef(false) // Track if we're sending the first message
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Sync sessionId prop with state
  useEffect(() => {
    setCurrentSessionId(sessionId)
    // Only clear messages when switching to a different existing session
    // Don't clear if we're in the middle of sending the first message
    if (!isSendingFirstMessage.current) {
      setMessages([]) // Clear messages when switching sessions
    }
  }, [sessionId])

  // Load messages when session changes
  useEffect(() => {
    if (currentSessionId) {
      // Skip loading if we're in the middle of sending the first message
      // (user message is already in state, don't overwrite it)
      if (!isSendingFirstMessage.current) {
        loadMessages()
      }
    } else {
      setMessages([]) // Clear messages for new chat
    }
  }, [currentSessionId])

  // Auto-scroll to bottom when messages, progress, or streaming content changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, progressMessage, streamingContent])

  const loadMessages = async () => {
    if (!currentSessionId) return

    setIsLoadingMessages(true)
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/chat/${currentSessionId}`
      )
      if (response.ok) {
        const data = await response.json()
        setMessages(data.session?.messages || [])
      }
    } catch (error) {
      console.error("Error loading messages:", error)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const createSession = async (skipLoad = false) => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      if (response.ok) {
        const data = await response.json()
        const newSessionId = data.session._id
        
        // Don't trigger loadMessages if we're in the middle of sending a message
        if (!skipLoad) {
          setCurrentSessionId(newSessionId)
        }
        
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

    const userMessage: ChatMessage = {
      role: "user",
      content: input.trim(),
      createdAt: new Date(),
    }

    // Optimistically add user message FIRST
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    // Create session if needed (AFTER adding user message to UI)
    let sid = currentSessionId
    if (!sid) {
      isSendingFirstMessage.current = true // Set flag to prevent loadMessages from clearing our user message
      sid = await createSession(true)
      if (!sid) {
        setError("Failed to create chat session")
        setIsLoading(false)
        isSendingFirstMessage.current = false
        return
      }
      setCurrentSessionId(sid) // This will trigger useEffect, but it will skip loadMessages
    }

    try {
      // Include selected page IDs in the request
      const explicitPageIds = selectedPages.map(sp => sp.page._id.toString())
      
      const response = await fetch(
        `/api/workspaces/${workspaceId}/chat/${sid}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            content: userMessage.content,
            explicitPageIds: explicitPageIds.length > 0 ? explicitPageIds : undefined
          }),
        }
      )

      if (!response.ok) {
        throw new Error("Failed to send message")
      }

      // Handle Server-Sent Events stream
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error("No response body")
      }

      let streamingAssistantMessage: ChatMessage = {
        role: "assistant",
        content: "",
        createdAt: new Date(),
      }

      console.log(`[Chat] Starting SSE stream for session ${sid}`)
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          console.log(`[Chat] Stream complete`)
          break
        }

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n\n")

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue

          try {
            const data = JSON.parse(line.slice(6)) // Remove "data: " prefix

            if (data.type === "progress") {
              console.log(`[Chat] Progress: ${data.message}`)
              setProgressMessage(data.message)
            } else if (data.type === "content") {
              // Once we start receiving content, update status to show we're writing
              if (streamingAssistantMessage.content === "") {
                setProgressMessage("✍️ Writing response...")
              }
              streamingAssistantMessage.content += data.content
              setStreamingContent((prev) => prev + data.content)
            } else if (data.type === "done") {
              console.log(`[Chat] Done event received`)
              console.log(`[Chat] Final message:`, data.message)
              setProgressMessage("")
              setStreamingContent("")
              
              // Add the complete assistant message
              setMessages((prev) => {
                // Check if user message is already there
                const hasUserMessage = prev.some(m => 
                  m.role === 'user' && 
                  m.content === userMessage.content &&
                  Math.abs(new Date(m.createdAt).getTime() - userMessage.createdAt.getTime()) < 1000
                )
                
                if (hasUserMessage) {
                  return [...prev, data.message]
                } else {
                  return [...prev, userMessage, data.message]
                }
              })
              
              // Clear the first message flag and selected pages
              isSendingFirstMessage.current = false
              setSelectedPages([])
              
              // Notify parent that message was sent
              onMessageSent?.()
              
              // Poll for title update
              setTimeout(() => {
                onMessageSent?.()
              }, 3000)
            } else if (data.type === "error") {
              console.error(`[Chat] Error event:`, data.error)
              throw new Error(data.error)
            }
          } catch (e) {
            console.error("[Chat] Error parsing SSE data:", e, "Line:", line)
          }
        }
      }
    } catch (error) {
      console.error("[Chat] Error sending message:", error)
      setError("Failed to send message. Please try again.")
      setProgressMessage("")
      setStreamingContent("")
      isSendingFirstMessage.current = false
    } finally {
      console.log(`[Chat] sendMessage finally block, isLoading = false`)
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleCitationClick = useCallback(async (citation: Citation, allCitations: Citation[]) => {
    setIsLoadingPage(true)
    try {
      // Fetch all cited pages
      const pagePromises = allCitations.map(c =>
        fetch(`/api/workspaces/${workspaceId}/pages/${c.pageId}`).then(r => r.json())
      )
      const pages = await Promise.all(pagePromises)
      setModalPages(pages)
      setInitialPageId(citation.pageId.toString())
    } catch (error) {
      console.error("Error loading pages:", error)
    } finally {
      setIsLoadingPage(false)
    }
  }, [workspaceId])

  // Copy message content to clipboard
  const handleCopyMessage = useCallback(async (content: string, messageIndex: number) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageIndex(messageIndex)
      // Reset after 2 seconds
      setTimeout(() => {
        setCopiedMessageIndex(null)
      }, 2000)
    } catch (error) {
      console.error("Failed to copy to clipboard:", error)
    }
  }, [])

  // Handle markdown links with #page-XXX format to open page viewer
  const handlePageLink = useCallback((href: string, citations?: Citation[]) => {
    // Extract page number from #page-XXX format
    const match = href.match(/^#page-(\d+)$/)
    if (match && citations && citations.length > 0) {
      const pageNumber = parseInt(match[1], 10)
      const citation = citations?.find(c => c.pageNumber === pageNumber)
      
      if (citation) {
        handleCitationClick(citation, citations)
      } else {
        console.warn(`No citation found for page ${pageNumber}. Available citations:`, citations)
        // Still try to open the page if we can find it in any citation
        // Try using the first citation's document to fetch this page
        const anyCitation = citations[0]
        handleCitationClick({
          pageId: anyCitation.pageId,
          documentId: anyCitation.documentId,
          pageNumber: pageNumber,
          excerpt: '',
        }, citations)
      }
    }
  }, [handleCitationClick])

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-white rounded-lg border">
      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200 flex items-start justify-between">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingMessages ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <div className={`h-20 rounded-lg animate-pulse ${
                  i % 2 === 0 ? "w-2/3 bg-blue-100" : "w-3/4 bg-gray-100"
                }`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="max-w-md">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Start a conversation
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Ask questions about your documents and I'll search through them to find answers.
              </p>
              <div className="text-left space-y-2">
                <p className="text-xs text-gray-400">Try asking:</p>
                <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                  <li>"What are the main topics in these documents?"</li>
                  <li>"Find information about [specific topic]"</li>
                  <li>"Summarize the key findings"</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          messages.map((message, idx) => (
            <MessageBubble
              key={`${message.role}-${idx}-${message.content.substring(0, 20)}`}
              message={message}
              idx={idx}
              copiedMessageIndex={copiedMessageIndex}
              onCopy={handleCopyMessage}
              onCitationClick={handleCitationClick}
              onPageLinkClick={handlePageLink}
              workspaceId={workspaceId}
            />
          ))
        )}

        {isLoading && (
          <StreamingMessage 
            progressMessage={progressMessage}
            streamingContent={streamingContent}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        {/* Selected Pages Pills */}
        {selectedPages.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedPages.map((sp, idx) => (
              <SelectedPagePill
                key={`${sp.page._id}-${idx}`}
                page={sp.page}
                documentName={sp.documentName}
                onRemove={() => {
                  setSelectedPages(prev => prev.filter((_, i) => i !== idx))
                }}
                onClick={() => {
                  // Open page viewer for this page
                  setModalPages([sp.page])
                  setInitialPageId(sp.page._id.toString())
                }}
              />
            ))}
          </div>
        )}
        
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
            onClick={() => setShowPagePicker(true)}
            disabled={isLoading}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Add page to chat"
          >
            <Plus className="w-5 h-5" />
          </button>
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
      <PageViewerModal
        pages={modalPages}
        initialPageId={initialPageId}
        onClose={() => {
          setModalPages([])
          setInitialPageId(undefined)
        }}
      />

      {/* Page Picker Modal */}
      {showPagePicker && (
        <PagePicker
          workspaceId={workspaceId}
          onPageSelected={(page) => {
            // Get document name from the page
            fetch(`/api/workspaces/${workspaceId}`)
              .then(r => r.json())
              .then(data => {
                const doc = data.workspace.documents?.find((d: any) => d._id === page.documentId)
                if (doc) {
                  setSelectedPages(prev => {
                    // Avoid duplicates
                    if (prev.some(sp => sp.page._id === page._id)) {
                      return prev
                    }
                    return [...prev, { page, documentName: doc.name }]
                  })
                }
              })
          }}
          onClose={() => setShowPagePicker(false)}
        />
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


