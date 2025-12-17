import { ObjectId } from "mongodb"
import { getDocumentsCollection } from "./db.js"
import logger from "./logger.js"

export interface FetchedDocument {
  _id: ObjectId
  filename: string
  sourceType: "upload" | "url"
  buffer: Buffer
}

/**
 * Fetch a document's PDF data
 * - For URL documents: Fetches fresh from URL
 * - For uploaded documents: Retrieves base64 from MongoDB
 * 
 * @param documentId - Document ID in MongoDB
 * @returns Document with PDF buffer
 */
export async function fetchDocument(documentId: string): Promise<FetchedDocument> {
  const documents = await getDocumentsCollection()

  logger.info(`📥 Fetching document: ${documentId}`)

  // Get document from MongoDB
  const document = await documents.findOne({ _id: new ObjectId(documentId) })

  if (!document) {
    throw new Error(`Document not found: ${documentId}`)
  }

  logger.info(`   Source type: ${document.sourceType}`)
  logger.info(`   Filename: ${document.filename}`)

  let buffer: Buffer

  if (document.sourceType === "url") {
    // Fetch fresh from URL
    if (!document.sourceUrl) {
      throw new Error(`Document ${documentId} is URL type but has no sourceUrl`)
    }

    logger.info(`   Fetching from URL: ${document.sourceUrl}`)

    try {
      const response = await fetch(document.sourceUrl)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get("content-type")
      if (contentType && !contentType.includes("application/pdf")) {
        logger.warn(`   ⚠️  Unexpected content-type: ${contentType}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)

      logger.info(`   ✅ Fetched: ${Math.round(buffer.length / 1024 / 1024)}MB`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      logger.error(`   ❌ Failed to fetch from URL: ${message}`)
      throw new Error(`Failed to fetch document from URL: ${message}`)
    }
  } else if (document.sourceType === "upload") {
    // Get base64 from MongoDB
    if (!document.pdfData) {
      throw new Error(`Document ${documentId} is upload type but has no pdfData`)
    }

    logger.info(`   Decoding base64 from MongoDB...`)

    try {
      buffer = Buffer.from(document.pdfData, "base64")
      logger.info(`   ✅ Decoded: ${Math.round(buffer.length / 1024 / 1024)}MB`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      logger.error(`   ❌ Failed to decode base64: ${message}`)
      throw new Error(`Failed to decode PDF data: ${message}`)
    }
  } else {
    throw new Error(`Unknown source type: ${document.sourceType}`)
  }

  return {
    _id: document._id,
    filename: document.filename,
    sourceType: document.sourceType,
    buffer,
  }
}

/**
 * Fetch multiple documents
 * @param documentIds - Array of document IDs
 * @returns Array of fetched documents
 */
export async function fetchDocuments(documentIds: string[]): Promise<FetchedDocument[]> {
  logger.info(`📥 Fetching ${documentIds.length} documents...`)

  const results: FetchedDocument[] = []

  for (const id of documentIds) {
    try {
      const doc = await fetchDocument(id)
      results.push(doc)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      logger.error(`❌ Failed to fetch document ${id}: ${message}`)
      // Continue with other documents
    }
  }

  logger.info(`✅ Successfully fetched ${results.length}/${documentIds.length} documents`)

  return results
}

