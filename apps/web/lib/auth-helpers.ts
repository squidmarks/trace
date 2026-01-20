import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { getUsersCollection } from "./db"
import { ObjectId } from "mongodb"

/**
 * Get the current session and verify the user is active
 * Returns null if not authenticated or not active
 */
export async function getActiveSession() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return null
  }

  // Check if user is active
  if (!session.user.isActive) {
    return null
  }

  return session
}

/**
 * Require an active session for API routes
 * Throws an error with status code if not authenticated or not active
 */
export async function requireActiveSession() {
  const session = await getActiveSession()
  
  if (!session) {
    throw new Error("Unauthorized")
  }

  return session
}

/**
 * Check if a user account is active
 */
export async function isUserActive(userId: string): Promise<boolean> {
  const users = await getUsersCollection()
  const user = await users.findOne({ _id: new ObjectId(userId) })
  return user?.isActive ?? false
}
