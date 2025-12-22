"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from "react"
import { Send, Loader2, FileText, X, MessageSquare, Copy, Check, ZoomIn, ZoomOut, Maximize2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch"
import type { ChatMessage, Citation } from "@trace/shared"
import MermaidDiagram from "./MermaidDiagram"

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
  onMessageSent?: () => void
}

// Memoized Message Component to prevent unnecessary re-renders
const MessageBubble = memo(({ 
  message, 
  idx, 
  copiedMessageIndex, 
  onCopy, 
  onCitationClick,
  onPageLinkClick 
}: { 
  message: ChatMessage
  idx: number
  copiedMessageIndex: number | null
  onCopy: (content: string, idx: number) => void
  onCitationClick: (citation: Citation) => void
  onPageLinkClick: (href: string, citations?: Citation[]) => void
}) => {
  // Memoized markdown components to prevent recreation on every render
  const markdownComponents = useMemo(() => ({
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || "")
      const language = match ? match[1] : ""
      const code = String(children).replace(/\n$/, "")
      
      // Render Mermaid diagrams
      if (!inline && language === "mermaid") {
        return <MermaidDiagram chart={code} />
      }
      
      // Regular code blocks
      if (!inline) {
        return (
          <code className={className} {...props}>
            {children}
          </code>
        )
      }
      
      // Inline code
      return <code className={className} {...props}>{children}</code>
    },
    a({ node, href, children, ...props }: any) {
      // Handle #page-XXX fragment links - render as button to open modal
      if (href?.match(/^#page-\d+$/)) {
        return (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onPageLinkClick(href, message.citations)
            }}
            className="text-blue-600 hover:text-blue-800 underline decoration-dotted cursor-pointer font-medium inline"
          >
            {children}
          </button>
        )
      }
      // Regular external links - open in new tab
      if (href?.startsWith('http')) {
        return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
      }
      // Other links - render as styled text to prevent navigation
      return <span className="text-blue-600 underline decoration-dotted">{children}</span>
    }
  }), [message.citations, onPageLinkClick])

  return (
    <div
      className={`flex ${
        message.role === "user" ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-[80%] rounded-lg p-3 relative group ${
          message.role === "user"
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-900"
        }`}
      >
        {/* Copy button - only show for assistant messages */}
        {message.role === "assistant" && (
          <button
            onClick={() => onCopy(message.content, idx)}
            className="absolute top-2 right-2 p-1.5 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copy to clipboard"
          >
            {copiedMessageIndex === idx ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4 text-gray-600" />
            )}
          </button>
        )}
        
        <div className={`prose prose-sm max-w-none ${
          message.role === "user" 
            ? "prose-invert" 
            : "prose-gray"
        }`}>
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Citations */}
        {message.role === "assistant" && message.citations && message.citations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-300">
            <p className="text-xs text-gray-600 mb-2 font-medium">Sources:</p>
            <div className="flex flex-wrap gap-2">
              {message.citations.map((citation, cidx) => (
                <button
                  key={cidx}
                  onClick={() => onCitationClick(citation)}
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
  )
})

MessageBubble.displayName = 'MessageBubble'

// Memoized Streaming Content Component
const StreamingMessage = memo(({ 
  progressMessage, 
  streamingContent 
}: { 
  progressMessage: string
  streamingContent: string
}) => {
  // Check if a Mermaid code block appears complete in the raw markdown
  // This prevents trying to render incomplete diagrams during streaming
  const isMermaidBlockComplete = useMemo(() => {
    const mermaidBlockRegex = /```mermaid\n([\s\S]*?)```/g
    const matches = streamingContent.match(mermaidBlockRegex)
    return !!matches // If we can match a complete block, it's safe to render
  }, [streamingContent])

  // Memoized streaming markdown components
  const streamingMarkdownComponents = useMemo(() => ({
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || "")
      const language = match ? match[1] : ""
      if (!inline && language === "mermaid") {
        const code = String(children).trim()
        
        // More robust checks for completeness during streaming
        const hasMinimumContent = code.length > 20 // Minimum viable diagram
        const hasMultipleLines = code.split('\n').length >= 3 // At least 3 lines
        const hasValidStart = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4Context)/.test(code)
        
        // Only attempt to render if the diagram looks reasonably complete
        if (hasMinimumContent && hasMultipleLines && hasValidStart && isMermaidBlockComplete) {
          return <MermaidDiagram chart={code} />
        }
        
        // Otherwise, show as regular code during streaming
        return (
          <code className={`${className} block`} {...props}>
            {children}
          </code>
        )
      }
      return <code className={className} {...props}>{children}</code>
    },
    a({ node, href, children, ...props }: any) {
      if (href?.match(/^#page-\d+$/)) {
        return (
          <span className="text-blue-600 underline decoration-dotted font-medium inline">
            {children}
          </span>
        )
      }
      if (href?.startsWith('http')) {
        return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
      }
      return <span className="text-blue-600 underline">{children}</span>
    }
  }), [isMermaidBlockComplete])

  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 rounded-lg p-3 space-y-2 max-w-[80%]">
        {/* Progress indicator */}
        {progressMessage && (
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin mt-0.5 flex-shrink-0" />
            <span>{progressMessage}</span>
          </div>
        )}
        
        {/* Streaming content as it comes in */}
        {streamingContent && (
          <div className="prose prose-sm max-w-none prose-gray border-t pt-2">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={streamingMarkdownComponents}
            >
              {streamingContent}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
})

StreamingMessage.displayName = 'StreamingMessage'

export default function ChatInterface({ workspaceId, sessionId, onSessionCreated, onMessageSent }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId)
  const [selectedPage, setSelectedPage] = useState<PageData | null>(null)
  const [isLoadingPage, setIsLoadingPage] = useState(false)
  const [progressMessage, setProgressMessage] = useState<string>("")
  const [streamingContent, setStreamingContent] = useState<string>("")
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null)
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
      const response = await fetch(
        `/api/workspaces/${workspaceId}/chat/${sid}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: userMessage.content }),
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

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n\n")

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue

          try {
            const data = JSON.parse(line.slice(6)) // Remove "data: " prefix

            if (data.type === "progress") {
              setProgressMessage(data.message)
            } else if (data.type === "content") {
              // Once we start receiving content, update status to show we're writing
              if (streamingAssistantMessage.content === "") {
                setProgressMessage("✍️ Writing response...")
              }
              streamingAssistantMessage.content += data.content
              setStreamingContent((prev) => prev + data.content)
            } else if (data.type === "done") {
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
              
              // Clear the first message flag
              isSendingFirstMessage.current = false
              
              // Notify parent that message was sent
              onMessageSent?.()
              
              // Poll for title update
              setTimeout(() => {
                onMessageSent?.()
              }, 3000)
            } else if (data.type === "error") {
              throw new Error(data.error)
            }
          } catch (e) {
            console.error("Error parsing SSE data:", e)
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error)
      setError("Failed to send message. Please try again.")
      setProgressMessage("")
      setStreamingContent("")
      isSendingFirstMessage.current = false
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

  const handleCitationClick = useCallback(async (citation: Citation) => {
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
    if (match) {
      const pageNumber = parseInt(match[1], 10)
      const citation = citations?.find(c => c.pageNumber === pageNumber)
      
      if (citation) {
        handleCitationClick(citation)
      } else {
        console.warn(`No citation found for page ${pageNumber}. Available citations:`, citations)
        // Still try to open the page if we can find it in any citation
        // This handles cases where the AI mentions a page that was retrieved but not in the final citations list
        if (citations && citations.length > 0) {
          // Try using the first citation's document to fetch this page
          const anyCitation = citations[0]
          handleCitationClick({
            pageId: anyCitation.pageId,
            documentId: anyCitation.documentId,
            pageNumber: pageNumber,
            excerpt: '',
          })
        }
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
            <div className="overflow-hidden max-h-[calc(90vh-8rem)]">
              {/* Zoomable Page Image */}
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={4}
                doubleClick={{ mode: "toggle" }}
                wheel={{ step: 0.1 }}
                pinch={{ step: 5 }}
                panning={{ velocityDisabled: true }}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <div className="relative h-full">
                    {/* Zoom Controls */}
                    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white rounded-lg shadow-lg border border-gray-200 p-2">
                      <button
                        onClick={() => zoomIn()}
                        className="p-2 hover:bg-gray-100 rounded transition"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-5 h-5 text-gray-700" />
                      </button>
                      <button
                        onClick={() => zoomOut()}
                        className="p-2 hover:bg-gray-100 rounded transition"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-5 h-5 text-gray-700" />
                      </button>
                      <button
                        onClick={() => resetTransform()}
                        className="p-2 hover:bg-gray-100 rounded transition"
                        title="Reset Zoom"
                      >
                        <Maximize2 className="w-5 h-5 text-gray-700" />
                      </button>
                    </div>

                    {/* Scrollable Container */}
                    <div className="overflow-y-auto max-h-[calc(90vh-8rem)] p-4">
                      <TransformComponent
                        wrapperStyle={{ width: "100%", height: "100%" }}
                        contentStyle={{ width: "100%" }}
                      >
                        <img
                          src={`data:image/jpeg;base64,${selectedPage.imageData}`}
                          alt={`Page ${selectedPage.pageNumber}`}
                          className="w-full rounded-lg shadow-lg mb-4 cursor-move"
                        />
                      </TransformComponent>

                      {/* Analysis Section */}
                      <div className="space-y-3 mt-4">
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
                )}
              </TransformWrapper>
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


