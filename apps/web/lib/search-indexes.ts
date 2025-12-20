/**
 * Automatic MongoDB text search index initialization
 * Ensures search indexes exist when needed
 */

import { getPagesCollection } from "./db"

let indexesInitialized = false

/**
 * Ensure text search indexes exist on the pages collection
 * This runs once per application startup and is idempotent
 */
export async function ensureSearchIndexes(): Promise<void> {
  if (indexesInitialized) {
    return // Already initialized in this process
  }

  try {
    console.log("🔍 Checking MongoDB text search indexes...")
    const pages = await getPagesCollection()

    // Check if text index already exists
    const indexes = await pages.indexes()
    const textIndexExists = indexes.some(
      (idx) =>
        idx.name === "search_text" ||
        Object.values(idx.key || {}).includes("text")
    )

    if (textIndexExists) {
      console.log("✅ Text search indexes already exist")
      indexesInitialized = true
      return
    }

    // Create text search index
    console.log("📝 Creating text search index on pages collection...")
    await pages.createIndex(
      {
        "analysis.summary": "text",
        "analysis.topics": "text",
        "analysis.entities.value": "text",
        "analysis.anchors.label": "text",
        "analysis.relations.note": "text",
      },
      {
        name: "search_text",
        weights: {
          "analysis.summary": 10, // Highest priority
          "analysis.topics": 8, // High priority
          "analysis.entities.value": 6, // Medium-high priority
          "analysis.anchors.label": 4, // Medium priority
          "analysis.relations.note": 2, // Lower priority
        },
        default_language: "english",
      }
    )

    console.log("✅ Text search index created")

    // Create additional indexes for filtering (if they don't exist)
    try {
      await pages.createIndex({ workspaceId: 1 })
      await pages.createIndex({ workspaceId: 1, documentId: 1 })
      await pages.createIndex({ documentId: 1, pageNumber: 1 })
      console.log("✅ Filter indexes created")
    } catch (error: any) {
      // Ignore errors if indexes already exist
      if (error.code !== 85 && error.codeName !== "IndexOptionsConflict") {
        throw error
      }
    }

    indexesInitialized = true
    console.log("✨ Search indexes initialized successfully")
  } catch (error: any) {
    // Log error but don't crash the app
    console.error("⚠️  Failed to initialize search indexes:", error.message)
    console.error("   Search functionality may not work until indexes are created")
    console.error("   Run: npm run setup:search")
  }
}

/**
 * Reset the initialization flag (useful for testing)
 */
export function resetIndexInitialization(): void {
  indexesInitialized = false
}


