import { NextResponse } from "next/server"
import { initializeApp } from "@/lib/bootstrap"

/**
 * GET /api/bootstrap
 * Initialize the application (create admin user, etc.)
 * This is called automatically or can be called manually
 */
export async function GET() {
  try {
    await initializeApp()
    
    return NextResponse.json({ 
      success: true,
      message: "Application initialized successfully" 
    })
  } catch (error: any) {
    console.error("[Bootstrap API] Error:", error)
    return NextResponse.json(
      { error: "Bootstrap failed", details: error.message },
      { status: 500 }
    )
  }
}

