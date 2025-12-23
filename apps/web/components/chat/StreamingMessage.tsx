"use client"

import { memo, useMemo } from "react"
import { Loader2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import MermaidDiagram from "../MermaidDiagram"

interface StreamingMessageProps {
  progressMessage: string
  streamingContent: string
}

const StreamingMessage = memo(({ 
  progressMessage, 
  streamingContent 
}: StreamingMessageProps) => {
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

export default StreamingMessage

