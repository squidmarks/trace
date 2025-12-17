import clientPromise from "./mongodb"

export async function getDb() {
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

