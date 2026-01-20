import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUsersCollection } from "@/lib/db"
import { ObjectId } from "mongodb"

/**
 * PATCH /api/admin/users/[userId]
 * Update user status (activate/deactivate)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const users = await getUsersCollection()
    const currentUser = await users.findOne({ _id: new ObjectId(session.user.id) })
    
    if (!currentUser?.isActive) {
      return NextResponse.json(
        { error: "Forbidden: Account not active" },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { isActive } = body

    if (typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "Invalid request: isActive must be a boolean" },
        { status: 400 }
      )
    }

    // Validate userId
    if (!ObjectId.isValid(params.userId)) {
      return NextResponse.json(
        { error: "Invalid user ID" },
        { status: 400 }
      )
    }

    // Prevent users from deactivating themselves
    if (params.userId === session.user.id && !isActive) {
      return NextResponse.json(
        { error: "Cannot deactivate your own account" },
        { status: 400 }
      )
    }

    // Update user status
    const result = await users.updateOne(
      { _id: new ObjectId(params.userId) },
      { 
        $set: { 
          isActive,
          updatedAt: new Date()
        } 
      }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Fetch updated user
    const updatedUser = await users.findOne({ _id: new ObjectId(params.userId) })

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser?._id.toString(),
        email: updatedUser?.email,
        name: updatedUser?.name,
        avatar: updatedUser?.image,
        isActive: updatedUser?.isActive ?? false,
        createdAt: updatedUser?.createdAt,
        updatedAt: updatedUser?.updatedAt,
      }
    })
  } catch (error) {
    console.error("[Admin API] Error updating user:", error)
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    )
  }
}
