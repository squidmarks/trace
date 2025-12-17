import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { ObjectId } from "mongodb"
import crypto from "crypto"
import { authOptions } from "@/lib/auth"
import { getDocumentsCollection } from "@/lib/db"
import { getWorkspaceRole, requireOwnerAccess } from "@/lib/permissions"
import type { UploadDocumentRequest } from "@trace/shared"

// GET /api/workspaces/:id/documents - List documents
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const documents = await getDocumentsCollection()

    const workspaceDocuments = await documents
      .find({ workspaceId: new ObjectId(params.id) })
      .sort({ createdAt: -1 })
      .toArray()

    // Remove pdfData from response (too large)
    const documentsWithoutData = workspaceDocuments.map(
      ({ pdfData, ...doc }) => doc
    )

    return NextResponse.json({ documents: documentsWithoutData })
  } catch (error) {
    console.error("Error fetching documents:", error)
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    )
  }
}

// POST /api/workspaces/:id/documents - Upload document
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

    const body: UploadDocumentRequest = await request.json()

    // Validate input
    if (!body.filename || !body.file) {
      return NextResponse.json(
        { error: "filename and file are required" },
        { status: 400 }
      )
    }

    // Validate filename
    if (!body.filename.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      )
    }

    // Validate base64
    if (!body.file.match(/^[A-Za-z0-9+/]+={0,2}$/)) {
      return NextResponse.json({ error: "Invalid base64 data" }, { status: 400 })
    }

    // Check size (10MB limit - MongoDB has 16MB document limit, base64 adds ~33% overhead)
    const sizeInBytes = (body.file.length * 3) / 4
    const maxSize = 10 * 1024 * 1024 // 10MB PDF ≈ 13.3MB base64 + metadata < 16MB MongoDB limit
    if (sizeInBytes > maxSize) {
      return NextResponse.json(
        { 
          error: "File size exceeds 10MB limit (MongoDB constraint). For larger files, we'll add object storage in a future update." 
        },
        { status: 400 }
      )
    }

    // Calculate hash
    const hash = crypto.createHash("sha256").update(body.file, "base64").digest("hex")

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
      filename: body.filename.trim(),
      sourceType: "upload" as const,
      pdfData: body.file,
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
    console.error("Error uploading document:", error)

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
      { error: "Failed to upload document" },
      { status: 500 }
    )
  }
}

