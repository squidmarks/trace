"use client"

import { useEffect, useRef, useState } from "react"
import mermaid from "mermaid"

interface MermaidDiagramProps {
  chart: string
}

export default function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>("")
  const [error, setError] = useState<string>("")
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Initialize mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      fontFamily: "inherit",
    })

    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
        const { svg } = await mermaid.render(id, chart)
        setSvg(svg)
        setError("")
      } catch (err: any) {
        console.error("Mermaid rendering error:", err)
        setError(err.message || "Failed to render diagram")
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
        <pre className="mt-2 text-xs overflow-auto">{chart}</pre>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="border border-gray-300 dark:border-gray-700 rounded p-4">
        <p className="text-sm text-gray-500">Rendering diagram...</p>
      </div>
    )
  }

  return (
    <div
      ref={elementRef}
      className="border border-gray-300 dark:border-gray-700 rounded p-4 bg-white dark:bg-gray-800 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

