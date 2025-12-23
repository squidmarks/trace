import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getWorkspaceRole } from "@/lib/permissions"
import { getPagesCollection } from "@/lib/db"
import { ObjectId } from "mongodb"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; pageId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = await getWorkspaceRole(params.id, session.user.id)
    if (!role) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const pages = await getPagesCollection()
    const page = await pages.findOne({
      _id: new ObjectId(params.pageId),
      workspaceId: new ObjectId(params.id),
    })

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 })
    }

    return NextResponse.json({
      _id: page._id.toString(),
      pageNumber: page.pageNumber,
      imageData: page.imageData,
      width: page.width,
      height: page.height,
      analysis: page.analysis,
    })
  } catch (error: any) {
    console.error("Error fetching page:", error)
    return NextResponse.json(
      { error: "Failed to fetch page" },
      { status: 500 }
    )
  }
}

