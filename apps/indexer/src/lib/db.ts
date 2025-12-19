import { MongoClient, Db, Collection } from "mongodb"
import type { Document, Page, IndexJob, Workspace } from "@trace/shared"

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is not set")
}

const uri = process.env.MONGODB_URI
const dbName = "trace"

// Connection options to limit pool size and prevent connection leaks
const options = {
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 60000, // Close idle connections after 60 seconds
  serverSelectionTimeoutMS: 5000,
}

let client: MongoClient | null = null
let db: Db | null = null
let isConnecting = false
let connectionPromise: Promise<Db> | null = null

export async function connectToDatabase(): Promise<Db> {
  // Return existing connection
  if (db) {
    return db
  }

  // If already connecting, wait for that connection
  if (isConnecting && connectionPromise) {
    return connectionPromise
  }

  // Create new connection
  isConnecting = true
  connectionPromise = (async () => {
    try {
      // Only create a new client if one doesn't exist
      if (!client) {
        client = new MongoClient(uri, options)
        await client.connect()
        console.log("[MongoDB] Connected with pool size:", options.maxPoolSize)
      }
      
      db = client.db(dbName)
      return db
    } finally {
      isConnecting = false
    }
  })()

  return connectionPromise
}

export async function getDb(): Promise<Db> {
  if (!db) {
    await connectToDatabase()
  }
  return db
}

export async function getDocumentsCollection(): Promise<Collection<Document>> {
  const database = await getDb()
  return database.collection<Document>("documents")
}

export async function getPagesCollection(): Promise<Collection<Page>> {
  const database = await getDb()
  return database.collection<Page>("pages")
}

export async function getIndexJobsCollection(): Promise<Collection<IndexJob>> {
  const database = await getDb()
  return database.collection<IndexJob>("indexJobs")
}

export async function getWorkspacesCollection(): Promise<Collection<Workspace>> {
  const database = await getDb()
  return database.collection<Workspace>("workspaces")
}

// Graceful shutdown - close MongoDB connection
export async function closeDatabase(): Promise<void> {
  if (client) {
    console.log("[MongoDB] Closing connection...")
    await client.close()
    client = null
    db = null
    console.log("[MongoDB] Connection closed")
  }
}
