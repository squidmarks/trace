"use client"

import { SessionProvider, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

function ProtectedContent({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Redirect inactive users to pending approval page
  useEffect(() => {
    if (status === "authenticated" && session?.user && !session.user.isActive) {
      router.push("/pending-approval")
    }
  }, [status, session, router])

  // Show loading while checking auth
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  // Show loading while redirecting inactive users
  if (status === "authenticated" && !session?.user?.isActive) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Redirecting...</div>
      </div>
    )
  }

  // Only render children for active users
  if (status === "authenticated" && session?.user?.isActive) {
    return <>{children}</>
  }

  return null
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <ProtectedContent>{children}</ProtectedContent>
    </SessionProvider>
  )
}

