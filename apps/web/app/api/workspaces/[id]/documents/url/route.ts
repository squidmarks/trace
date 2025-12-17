import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { ObjectId } from "mongodb"
import crypto from "crypto"
import { authOptions } from "@/lib/auth"
import { getDocumentsCollection } from "@/lib/db"
import { requireOwnerAccess } from "@/lib/permissions"
import type { AddDocumentByUrlRequest } from "@trace/shared"

// POST /api/workspaces/:id/documents/url - Add document from URL
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await requireOwnerAccess(params.id, session.user.id)

    const body: AddDocumentByUrlRequest = await request.json()

    // Validate input
    if (!body.url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 })
    }

    // Validate URL
    let url: URL
    try {
      url = new URL(body.url)
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    // Only allow http/https
    if (!["http:", "https:"].includes(url.protocol)) {
      return NextResponse.json(
        { error: "Only HTTP/HTTPS URLs are supported" },
        { status: 400 }
      )
    }

    // Fetch the PDF
    console.log(`Fetching PDF from: ${body.url}`)
    const response = await fetch(body.url)

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.statusText}` },
        { status: 400 }
      )
    }

    // Check content type
    const contentType = response.headers.get("content-type")
    if (!contentType?.includes("application/pdf")) {
      return NextResponse.json(
        { error: "URL does not point to a PDF file" },
        { status: 400 }
      )
    }

    // Get file data
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Check size (10MB limit - MongoDB has 16MB document limit, base64 adds ~33% overhead)
    const maxSize = 10 * 1024 * 1024 // 10MB PDF ≈ 13.3MB base64 + metadata < 16MB MongoDB limit
    if (buffer.length > maxSize) {
      return NextResponse.json(
        { 
          error: "File size exceeds 10MB limit (MongoDB constraint). For larger files, we'll add object storage in a future update." 
        },
        { status: 400 }
      )
    }

    // Convert to base64
    const base64 = buffer.toString("base64")

    // Calculate hash
    const hash = crypto.createHash("sha256").update(buffer).digest("hex")

    // Determine filename
    let filename = body.filename?.trim()
    if (!filename) {
      // Extract from URL
      const pathname = url.pathname
      filename = pathname.substring(pathname.lastIndexOf("/") + 1) || "document.pdf"
    }

    if (!filename.toLowerCase().endsWith(".pdf")) {
      filename += ".pdf"
    }

    const documents = await getDocumentsCollection()

    // Check for duplicate (same hash in workspace)
    const existing = await documents.findOne({
      workspaceId: new ObjectId(params.id),
      pdfHash: hash,
    })

    if (existing) {
      return NextResponse.json(
        { error: "Document already exists in workspace" },
        { status: 409 }
      )
    }

    const document = {
      workspaceId: new ObjectId(params.id),
      uploadedBy: new ObjectId(session.user.id),
      filename,
      sourceType: "url" as const,
      sourceUrl: body.url,
      pdfData: base64,
      pdfHash: hash,
      status: "ready" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await documents.insertOne(document)

    // Return without pdfData
    const { pdfData, ...documentWithoutData } = document

    return NextResponse.json(
      {
        document: {
          ...documentWithoutData,
          _id: result.insertedId,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Error adding document from URL:", error)

    if (error.message === "Owner access required") {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    // Check for MongoDB size limit error
    if (error.code === "ERR_OUT_OF_RANGE" || error.message?.includes("offset")) {
      return NextResponse.json(
        { 
          error: "Document too large for MongoDB (16MB limit). Please use a smaller file or wait for object storage support." 
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to add document from URL" },
      { status: 500 }
    )
  }
}

