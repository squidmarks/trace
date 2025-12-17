import Link from "next/link"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col gap-8">
        <h1 className="text-6xl font-bold text-center">
          Trace
        </h1>
        <p className="text-xl text-center text-gray-600 dark:text-gray-400">
          AI-powered system for exploring and understanding large sets of visual PDF documents
        </p>
        
        <div className="flex gap-4">
          <Link
            href="/signin"
            className="px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            Get Started
          </Link>
          <a
            href="https://github.com/squidmarks/trace"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            View on GitHub
          </a>
        </div>

        <div className="mt-16 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-3 lg:text-left gap-4">
          <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
            <h2 className="mb-3 text-2xl font-semibold">
              Visual-First
            </h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-50">
              PDFs converted to AI-optimized page images for accurate analysis of diagrams and schematics
            </p>
          </div>

          <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
            <h2 className="mb-3 text-2xl font-semibold">
              Hybrid Search
            </h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-50">
              Vector similarity and lexical matching for precise page-level results
            </p>
          </div>

          <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
            <h2 className="mb-3 text-2xl font-semibold">
              AI Chat
            </h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-50">
              Ask questions about your documents and get answers with citations
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

