import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUsersCollection } from "@/lib/db"
import { ObjectId } from "mongodb"

/**
 * GET /api/admin/users
 * List all users (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if user is admin (for now, we'll check if they have any workspaces or are the first user)
    const users = await getUsersCollection()
    const currentUser = await users.findOne({ _id: new ObjectId(session.user.id) })
    
    if (!currentUser?.isActive) {
      return NextResponse.json(
        { error: "Forbidden: Account not active" },
        { status: 403 }
      )
    }

    // For now, any active user can see the user list (you may want to add a specific isAdmin field later)
    const allUsers = await users
      .find({})
      .sort({ createdAt: -1 })
      .toArray()

    // Return user list with sensitive data removed
    const userList = allUsers.map(user => ({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatar: user.image,
      isActive: user.isActive ?? false,
      createdAt: user.createdAt,
    }))

    return NextResponse.json({ users: userList })
  } catch (error) {
    console.error("[Admin API] Error listing users:", error)
    return NextResponse.json(
      { error: "Failed to list users" },
      { status: 500 }
    )
  }
}
