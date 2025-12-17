import { getToken } from "next-auth/jwt"
import type { Socket } from "socket.io"
import { getWorkspaceRole } from "./permissions.js"

/**
 * Socket.io authentication middleware
 * Validates NextAuth JWT from cookie and extracts user ID
 */
export async function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  try {
    // Extract cookies from request
    const cookieHeader = socket.request.headers.cookie
    if (!cookieHeader) {
      return next(new Error("Unauthorized"))
    }

    // Parse cookies manually
    const cookies: Record<string, string> = {}
    cookieHeader.split(';').forEach(cookie => {
      const [name, ...valueParts] = cookie.trim().split('=')
      cookies[name] = decodeURIComponent(valueParts.join('='))
    })

    const isProduction = process.env.NODE_ENV === "production"
    const cookieName = isProduction 
      ? "__Secure-next-auth.session-token" 
      : "next-auth.session-token"
    
    const sessionToken = cookies[cookieName]
    
    if (!sessionToken) {
      return next(new Error("Unauthorized"))
    }

    // Create a proper request object for getToken
    const req = {
      headers: {
        cookie: cookieHeader,
      },
      cookies: cookies,
    } as any

    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET!,
      secureCookie: isProduction,
      cookieName,
    })

    if (!token?.sub) {
      return next(new Error("Unauthorized"))
    }

    // Store user ID in socket data
    socket.data.userId = token.sub
    next()
  } catch (error) {
    console.error("[Socket.io Auth] Error:", error)
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

