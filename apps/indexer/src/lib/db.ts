import { MongoClient, Db } from "mongodb"

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
}

const uri = process.env.MONGODB_URI
const options = {}

let client: MongoClient
let clientPromise: Promise<MongoClient>

// Create single MongoDB client
client = new MongoClient(uri, options)
clientPromise = client.connect()

export async function getDb(): Promise<Db> {
  const client = await clientPromise
  return client.db("trace")
}

export async function getWorkspacesCollection() {
  const db = await getDb()
  return db.collection("workspaces")
}

export async function getDocumentsCollection() {
  const db = await getDb()
  return db.collection("documents")
}

export async function getPagesCollection() {
  const db = await getDb()
  return db.collection("pages")
}

export async function getOntologiesCollection() {
  const db = await getDb()
  return db.collection("ontologies")
}

export async function getChatSessionsCollection() {
  const db = await getDb()
  return db.collection("chatSessions")
}

export default clientPromise

