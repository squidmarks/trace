"use client"

import { memo, useMemo } from "react"
import { Copy, Check } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { ChatMessage, Citation } from "@trace/shared"
import MermaidDiagram from "../MermaidDiagram"

interface MessageBubbleProps {
  message: ChatMessage
  idx: number
  copiedMessageIndex: number | null
  onCopy: (content: string, idx: number) => void
  onCitationClick: (citation: Citation, allCitations: Citation[]) => void
  onPageLinkClick: (href: string, citations?: Citation[]) => void
  workspaceId: string
}

const MessageBubble = memo(({ 
  message, 
  idx, 
  copiedMessageIndex, 
  onCopy, 
  onCitationClick,
  onPageLinkClick,
  workspaceId
}: MessageBubbleProps) => {
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
            <div className="flex flex-wrap gap-3">
              {message.citations.map((citation, cidx) => {
                // Truncate document name if too long
                const docName = citation.documentName || "Unknown"
                const truncatedDocName = docName.length > 20 ? docName.substring(0, 17) + "..." : docName
                
                return (
                  <button
                    key={cidx}
                    onClick={() => onCitationClick(citation, message.citations || [])}
                    className="flex flex-col items-center gap-1 group"
                    title={`${docName} - Page ${citation.pageNumber}`}
                  >
                    <div className="relative border-2 border-gray-300 rounded shadow-sm group-hover:border-blue-500 group-hover:shadow-md transition-all overflow-hidden bg-white">
                      <img
                        src={`/api/workspaces/${workspaceId}/pages/${citation.pageId}/thumbnail`}
                        alt={`Page ${citation.pageNumber}`}
                        className="w-20 h-24 object-cover"
                        loading="lazy"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-1">
                        <div className="text-white text-[9px] font-medium leading-tight">
                          <div className="truncate">{truncatedDocName}</div>
                          <div>Page {citation.pageNumber}</div>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
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

export default MessageBubble

