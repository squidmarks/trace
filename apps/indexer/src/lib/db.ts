import { MongoClient, Db, Collection } from "mongodb"
import type { Document, Page, IndexJob, Workspace } from "@trace/shared"

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is not set")
}

const uri = process.env.MONGODB_URI
const dbName = "trace"

let client: MongoClient
let db: Db

export async function connectToDatabase(): Promise<Db> {
  if (db) {
    return db
  }

  client = new MongoClient(uri)
  await client.connect()
  db = client.db(dbName)

  return db
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
