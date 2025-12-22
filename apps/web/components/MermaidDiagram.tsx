"use client"

import { useEffect, useRef, useState } from "react"
import mermaid from "mermaid"

interface MermaidDiagramProps {
  chart: string
}

export default function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [isRendering, setIsRendering] = useState(false)
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Initialize mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      fontFamily: "inherit",
      logLevel: 'error', // Suppress info/debug logs
    })

    const renderDiagram = async () => {
      // Don't try to render very short/incomplete charts
      if (!chart || chart.trim().length < 20) {
        setSvg("")
        setError("")
        return
      }

      // Additional validation for Mermaid syntax basics
      const lines = chart.trim().split('\n')
      const hasValidStart = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4Context)/.test(lines[0])
      
      if (!hasValidStart || lines.length < 3) {
        // Not enough content yet - don't render
        setSvg("")
        setError("")
        return
      }

      setIsRendering(true)
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
        const { svg } = await mermaid.render(id, chart)
        setSvg(svg)
        setError("")
      } catch (err: any) {
        // Silently handle errors during streaming (incomplete diagrams)
        // Only show errors if the diagram looks reasonably complete
        const looksComplete = lines.length > 5 // At least 5 lines suggests it's not just streaming
        
        if (looksComplete) {
          console.error("Mermaid rendering error:", err)
          setError(err.message || "Failed to render diagram")
        } else {
          // Incomplete diagram during streaming - just don't render yet
          setSvg("")
          setError("")
        }
      } finally {
        setIsRendering(false)
      }
    }

    renderDiagram()
  }, [chart])

  if (error) {
    return (
      <div className="border border-red-300 bg-red-50 dark:bg-red-900/20 rounded p-4">
        <p className="text-sm text-red-600 dark:text-red-400">
          Failed to render diagram: {error}
        </p>
        <details className="mt-2">
          <summary className="text-xs text-red-500 cursor-pointer">Show diagram code</summary>
          <pre className="mt-2 text-xs overflow-auto bg-red-100 dark:bg-red-900/30 p-2 rounded">{chart}</pre>
        </details>
      </div>
    )
  }

  if (!svg) {
    // Don't show "Rendering..." for very short/incomplete content
    if (chart.trim().length < 20) {
      return null // Streaming incomplete content
    }
    
    // Only show rendering indicator if we're actively rendering
    if (isRendering) {
      return (
        <div className="border border-gray-300 dark:border-gray-700 rounded p-4">
          <p className="text-sm text-gray-500">Rendering diagram...</p>
        </div>
      )
    }
    
    // Not rendering and no SVG - likely waiting for more content
    return null
  }

  return (
    <div
      ref={elementRef}
      className="border border-gray-300 dark:border-gray-700 rounded p-4 bg-white dark:bg-gray-800 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

