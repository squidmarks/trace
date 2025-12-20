/**
 * Setup MongoDB text search indexes for semantic search
 * 
 * NOTE: This script is OPTIONAL. The application will automatically create
 * search indexes on first use. This script is provided for:
 * - Pre-creating indexes in production before first search
 * - Manually rebuilding indexes if needed
 * - CI/CD pipelines that want to ensure indexes exist
 * 
 * Run this script:
 * npm run setup:search
 */

import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import path from "path"

// Load environment from web app
dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env.local") })

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI not found in environment variables")
  process.exit(1)
}

async function setupSearchIndexes() {
  console.log("🔧 Setting up MongoDB text search indexes...\n")

  const client = new MongoClient(MONGODB_URI)

  try {
    await client.connect()
    console.log("✅ Connected to MongoDB\n")

    const db = client.db()
    const pagesCollection = db.collection("pages")

    // Check if text index already exists
    const indexes = await pagesCollection.indexes()
    const textIndexExists = indexes.some((idx) => 
      idx.name?.includes("text") || Object.values(idx.key || {}).includes("text")
    )

    if (textIndexExists) {
      console.log("⚠️  Text index already exists. Dropping it first...")
      await pagesCollection.dropIndex("search_text")
      console.log("✅ Dropped old index\n")
    }

    // Create comprehensive text search index
    console.log("📝 Creating text search index on pages collection...")
    await pagesCollection.createIndex(
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
          "analysis.summary": 10,        // Highest priority
          "analysis.topics": 8,           // High priority
          "analysis.entities.value": 6,   // Medium-high priority
          "analysis.anchors.label": 4,    // Medium priority
          "analysis.relations.note": 2,   // Lower priority
        },
        default_language: "english",
      }
    )

    console.log("✅ Text search index created successfully!\n")

    // Create additional indexes for filtering
    console.log("📝 Creating workspace filter index...")
    await pagesCollection.createIndex({ workspaceId: 1 })
    console.log("✅ Workspace filter index created\n")

    console.log("📝 Creating document filter index...")
    await pagesCollection.createIndex({ workspaceId: 1, documentId: 1 })
    console.log("✅ Document filter index created\n")

    console.log("📝 Creating page number sort index...")
    await pagesCollection.createIndex({ documentId: 1, pageNumber: 1 })
    console.log("✅ Page number index created\n")

    // Show all indexes
    const allIndexes = await pagesCollection.indexes()
    console.log("📊 All indexes on pages collection:")
    allIndexes.forEach((idx) => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`)
    })

    console.log("\n✨ Search indexes setup complete!")
  } catch (error) {
    console.error("❌ Error setting up indexes:", error)
    process.exit(1)
  } finally {
    await client.close()
    console.log("\n👋 Disconnected from MongoDB")
  }
}

setupSearchIndexes()

