import { ObjectId } from "mongodb"
import { getWorkspacesCollection } from "./db"
import type { Role } from "@trace/shared"

export async function getWorkspaceRole(
  workspaceId: string,
  userId: string
): Promise<Role | null> {
  const workspaces = await getWorkspacesCollection()
  
  const workspace = await workspaces.findOne({
    _id: new ObjectId(workspaceId),
  })

  if (!workspace) {
    return null
  }

  // Check if user is owner
  if (workspace.ownerId.toString() === userId) {
    return "owner"
  }

  // Check if user is a member (viewer)
  const isMember = workspace.members?.some(
    (member: any) => member.userId.toString() === userId
  )

  if (isMember) {
    return "viewer"
  }

  return null
}

export async function requireWorkspaceAccess(
  workspaceId: string,
  userId: string
): Promise<Role> {
  const role = await getWorkspaceRole(workspaceId, userId)
  
  if (!role) {
    throw new Error("Access denied")
  }
  
  return role
}

export async function requireOwnerAccess(
  workspaceId: string,
  userId: string
): Promise<void> {
  const role = await getWorkspaceRole(workspaceId, userId)
  
  if (role !== "owner") {
    throw new Error("Owner access required")
  }
}

