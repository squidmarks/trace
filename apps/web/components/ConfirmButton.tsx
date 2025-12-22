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
      <div className="relative inline-block">
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 shadow-lg animate-in fade-in zoom-in-95 duration-200 z-50"
          style={{ minWidth: 'max-content' }}
          onBlur={handleBlur}
        >
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap mr-1">
            {confirmText}
          </span>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-2 py-1 text-xs font-medium rounded border transition ${
              confirmClassName ||
              "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 border-red-700"
            }`}
            autoFocus
          >
            {isLoading ? "..." : "Yes"}
          </button>
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="px-2 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            {cancelText}
          </button>
        </div>
        {/* Invisible placeholder maintains button size */}
        <div className="opacity-0 pointer-events-none">{children}</div>
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

