"use client"

import { useSession } from "next-auth/react"
import LandingPage from "@/components/LandingPage"
import Dashboard from "@/components/Dashboard"

export default function HomePage() {
  const { status } = useSession()

  // Show loading state while checking auth
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  // Show dashboard for authenticated users, landing for everyone else
  if (status === "authenticated") {
    return <Dashboard />
  }

  return <LandingPage />
}
