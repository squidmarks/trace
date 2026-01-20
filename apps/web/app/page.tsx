"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import LandingPage from "@/components/LandingPage"
import Dashboard from "@/components/Dashboard"

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Redirect inactive users to pending approval page
  useEffect(() => {
    if (status === "authenticated" && session?.user && !session.user.isActive) {
      router.push("/pending-approval")
    }
  }, [status, session, router])

  // Show loading state while checking auth
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  // Show dashboard for authenticated and active users, landing for everyone else
  if (status === "authenticated" && session?.user?.isActive) {
    return <Dashboard />
  }

  // Show loading while redirecting inactive users
  if (status === "authenticated" && !session?.user?.isActive) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Redirecting...</div>
      </div>
    )
  }

  return <LandingPage />
}
