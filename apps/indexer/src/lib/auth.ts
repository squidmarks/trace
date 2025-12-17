import { getToken } from "next-auth/jwt"
import type { Socket } from "socket.io"
import { getWorkspaceRole } from "./permissions.js"

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('Invalid/Missing environment variable: "NEXTAUTH_SECRET"')
}

/**
 * Socket.io authentication middleware
 * Validates NextAuth JWT from cookie and extracts user ID
 */
export async function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  try {
    const token = await getToken({
      req: socket.request as any,
      secret: process.env.NEXTAUTH_SECRET!,
    })

    if (!token?.sub) {
      return next(new Error("Unauthorized"))
    }

    // Store user ID in socket data
    socket.data.userId = token.sub
    next()
  } catch (error) {
    console.error("Socket auth error:", error)
    next(new Error("Authentication failed"))
  }
}

/**
 * Verify user has access to workspace before joining room
 */
export async function verifyWorkspaceAccess(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const role = await getWorkspaceRole(workspaceId, userId)
  return role !== null
}

