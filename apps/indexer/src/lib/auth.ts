import { getToken } from "next-auth/jwt"
import type { Socket } from "socket.io"
import type { Request, Response, NextFunction } from "express"
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

/**
 * Express middleware to verify service token for inter-service communication
 * Used by tool endpoints that are called by the Web App
 */
export function verifyServiceToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: "Unauthorized: Missing or invalid Authorization header",
      })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    const expectedToken = process.env.INDEXER_SERVICE_TOKEN

    if (!expectedToken) {
      console.error("[Auth] INDEXER_SERVICE_TOKEN not configured")
      return res.status(500).json({
        error: "Service authentication not configured",
      })
    }

    if (token !== expectedToken) {
      return res.status(401).json({
        error: "Unauthorized: Invalid service token",
      })
    }

    // Token is valid, proceed
    next()
  } catch (error) {
    console.error("[Auth] Service token verification error:", error)
    return res.status(500).json({
      error: "Authentication failed",
    })
  }
}

