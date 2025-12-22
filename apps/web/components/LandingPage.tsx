"use client"

import { useState } from "react"
import Link from "next/link"
import { FileSearch, Brain, Network, ArrowRight, Mail, X, Loader2 } from "lucide-react"

export default function LandingPage() {
  const [showRequestDialog, setShowRequestDialog] = useState(false)
  const [formData, setFormData] = useState({ name: "", email: "", message: "" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError("")

    try {
      const response = await fetch("/api/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to submit request")
      }

      setSubmitSuccess(true)
      setFormData({ name: "", email: "", message: "" })
      
      // Close dialog after 2 seconds
      setTimeout(() => {
        setShowRequestDialog(false)
        setSubmitSuccess(false)
      }, 2000)
    } catch (error: any) {
      setSubmitError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Network className="w-8 h-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">Trace</span>
            </div>
            <Link
              href="/api/auth/signin"
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Follow the Path Through
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                Complex Documents
              </span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Trace is an AI-powered document exploration system that follows connections across 
              technical documents to build complete, comprehensive answers. Think of it as a search 
              engine that understands relationships.
            </p>
            <button
              onClick={() => setShowRequestDialog(true)}
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition shadow-lg hover:shadow-xl"
            >
              Request Access
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mt-20">
            <div className="bg-white rounded-xl p-8 shadow-md border border-gray-200">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <FileSearch className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Semantic Search
              </h3>
              <p className="text-gray-600">
                Search documents by meaning, not just keywords. Find relevant information 
                even when it's described differently across pages.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-md border border-gray-200">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Network className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Connected Analysis
              </h3>
              <p className="text-gray-600">
                Automatically discovers connections between pages, following relationships 
                to build a complete picture of how systems work.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-md border border-gray-200">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                AI-Powered Insights
              </h3>
              <p className="text-gray-600">
                Chat with your documents using advanced AI that traces information paths 
                to provide comprehensive, sourced answers.
              </p>
            </div>
          </div>

          {/* How It Works */}
          <div className="mt-24 bg-white rounded-2xl p-12 shadow-lg border border-gray-200">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              How Trace Works
            </h2>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-blue-600">
                  1
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Upload Documents</h4>
                <p className="text-sm text-gray-600">
                  Add PDFs to your workspace
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-purple-600">
                  2
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">AI Analysis</h4>
                <p className="text-sm text-gray-600">
                  Trace indexes and analyzes content
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-green-600">
                  3
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Ask Questions</h4>
                <p className="text-sm text-gray-600">
                  Chat naturally about your documents
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-orange-600">
                  4
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Get Answers</h4>
                <p className="text-sm text-gray-600">
                  Receive comprehensive, sourced responses
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Request Access Dialog */}
      {showRequestDialog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => !isSubmitting && setShowRequestDialog(false)}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Request Access</h3>
              <button
                onClick={() => setShowRequestDialog(false)}
                disabled={isSubmitting}
                className="p-1 hover:bg-gray-100 rounded transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitSuccess ? (
              <div className="py-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-green-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Request Sent!</h4>
                <p className="text-gray-600">
                  We've received your access request and will be in touch soon.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John Doe"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="john@example.com"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                    Message (optional)
                  </label>
                  <textarea
                    id="message"
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Tell us about your use case..."
                    disabled={isSubmitting}
                  />
                </div>

                {submitError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                    {submitError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5" />
                      Send Request
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-600">
          <p>&copy; {new Date().getFullYear()} Trace. AI-powered document exploration.</p>
        </div>
      </footer>
    </div>
  )
}

