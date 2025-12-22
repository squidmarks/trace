"use client"

import { useState } from "react"
import { Trash2, Edit2, Check, X } from "lucide-react"
import ConfirmButton from "./ConfirmButton"
import type { Workspace, Role } from "@trace/shared"

interface WorkspaceHeaderProps {
  workspace: Workspace
  role: Role
  onRename: (name: string) => Promise<void>
  onDelete: () => Promise<void>
}

export default function WorkspaceHeader({
  workspace,
  role,
  onRename,
  onDelete,
}: WorkspaceHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState("")

  const startEditingName = () => {
    setEditedName(workspace.name)
    setIsEditingName(true)
  }

  const saveWorkspaceName = async () => {
    if (!editedName.trim() || editedName === workspace.name) {
      setIsEditingName(false)
      return
    }

    await onRename(editedName.trim())
    setIsEditingName(false)
  }

  const cancelEditingName = () => {
    setIsEditingName(false)
    setEditedName("")
  }

  return (
    <div className="mb-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {isEditingName ? (
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    saveWorkspaceName()
                  } else if (e.key === "Escape") {
                    cancelEditingName()
                  }
                }}
                className="text-3xl font-bold px-2 py-1 border-2 border-blue-500 rounded focus:outline-none"
                autoFocus
              />
              <button
                onClick={saveWorkspaceName}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Save"
              >
                <Check className="w-5 h-5 text-green-600" />
              </button>
              <button
                onClick={cancelEditingName}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Cancel"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-2 group">
              <h1 className="text-3xl font-bold">{workspace.name}</h1>
              {role === "owner" && (
                <button
                  onClick={startEditingName}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-opacity"
                  title="Rename workspace"
                >
                  <Edit2 className="w-5 h-5 text-gray-500" />
                </button>
              )}
            </div>
          )}
          {workspace.description && (
            <p className="text-gray-600 dark:text-gray-400">{workspace.description}</p>
          )}
        </div>
        {role === "owner" && (
          <ConfirmButton
            onConfirm={onDelete}
            className="text-red-600 hover:text-red-700 dark:text-red-400 flex items-center gap-2 px-3 py-2"
            confirmText="Yes, delete"
            cancelText="Cancel"
          >
            <Trash2 size={18} />
            Delete Workspace
          </ConfirmButton>
        )}
      </div>
    </div>
  )
}

