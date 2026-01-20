"use client"

import { useSession, signOut } from "next-auth/react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function PendingApproval() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Redirect to home if user is active
  useEffect(() => {
    if (status === "authenticated" && session?.user?.isActive) {
      router.push("/")
    }
  }, [status, session, router])

  // Show loading while checking auth status
  if (status === "loading") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-gray-500">Loading...</div>
      </main>
    )
  }

  // Redirect to sign-in if not authenticated
  if (status === "unauthenticated") {
    router.push("/signin")
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-gray-500">Redirecting...</div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-md w-full items-center justify-center flex flex-col gap-8 p-8 border border-gray-200 dark:border-gray-800 rounded-lg">
        <div className="w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-yellow-600 dark:text-yellow-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-center">Account Pending Approval</h1>
        
        <div className="text-center space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Thank you for signing in! Your account has been created but needs to be activated by an administrator before you can access Trace.
          </p>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Signed in as:</strong><br />
              {session?.user?.email}
            </p>
          </div>

          <p className="text-sm text-gray-500">
            You'll receive an email notification once your account has been activated. Please contact your administrator if you have any questions.
          </p>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/signin" })}
          className="w-full px-6 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        >
          Sign Out
        </button>
      </div>
    </main>
  )
}
