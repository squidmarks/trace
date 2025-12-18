"use client"

import { useState } from "react"

interface ConfirmButtonProps {
  onConfirm: () => void | Promise<void>
  confirmText?: string
  cancelText?: string
  children: React.ReactNode
  className?: string
  confirmClassName?: string
  disabled?: boolean
}

/**
 * A button that expands to show inline confirmation when clicked
 * 
 * Usage:
 * <ConfirmButton onConfirm={() => deleteItem()}>
 *   Delete
 * </ConfirmButton>
 */
export default function ConfirmButton({
  onConfirm,
  confirmText = "Confirm?",
  cancelText = "Cancel",
  children,
  className = "",
  confirmClassName = "",
  disabled = false,
}: ConfirmButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleInitialClick = () => {
    setIsConfirming(true)
  }

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      await onConfirm()
    } finally {
      setIsLoading(false)
      setIsConfirming(false)
    }
  }

  const handleCancel = () => {
    setIsConfirming(false)
  }

  // Reset confirmation state when clicking outside
  const handleBlur = (e: React.FocusEvent) => {
    // Only reset if focus moved outside the button group
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsConfirming(false)
    }
  }

  if (isConfirming) {
    return (
      <div
        className="inline-flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200"
        onBlur={handleBlur}
      >
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {confirmText}
        </span>
        <button
          onClick={handleConfirm}
          disabled={isLoading}
          className={`px-3 py-1 text-sm font-medium rounded transition ${
            confirmClassName ||
            "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          }`}
          autoFocus
        >
          {isLoading ? "..." : "Yes"}
        </button>
        <button
          onClick={handleCancel}
          disabled={isLoading}
          className="px-3 py-1 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition"
        >
          {cancelText}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleInitialClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
  )
}

