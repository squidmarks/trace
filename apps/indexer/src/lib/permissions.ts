import { ObjectId } from "mongodb"
import { getWorkspacesCollection } from "./db.js"
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

