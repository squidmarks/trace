import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getPagesCollection } from "@/lib/db"
import { ObjectId } from "mongodb"

/**
 * GET /api/workspaces/[id]/pages/[pageId]/thumbnail
 * Returns a page thumbnail as a JPEG image
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; pageId: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get page from database
    const pages = await getPagesCollection()
    const page = await pages.findOne({
      _id: new ObjectId(params.pageId),
      workspaceId: new ObjectId(params.id),
    })

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 })
    }

    // Use thumbnail if available, otherwise fall back to full image
    const imageData = page.thumbnailData || page.imageData
    
    if (!imageData) {
      return NextResponse.json({ error: "No image data available" }, { status: 404 })
    }

    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")

    // Return image with caching headers
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error: any) {
    console.error("Error fetching thumbnail:", error)
    return NextResponse.json(
      { error: "Failed to fetch thumbnail" },
      { status: 500 }
    )
  }
}

