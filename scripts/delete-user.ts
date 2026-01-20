/**
 * Delete a user by email
 * 
 * Usage:
 *   npx tsx scripts/delete-user.ts user@example.com
 */

import { MongoClient } from "mongodb"

async function main() {
  const email = process.argv[2]
  
  if (!email) {
    console.error("❌ Please provide an email address")
    console.log("Usage: npx tsx scripts/delete-user.ts user@example.com")
    process.exit(1)
  }

  const mongoUri = process.env.MONGODB_URI
  
  if (!mongoUri) {
    console.error("❌ MONGODB_URI environment variable is not set")
    process.exit(1)
  }

  console.log(`🔌 Connecting to MongoDB...`)
  const client = new MongoClient(mongoUri)
  
  try {
    await client.connect()
    console.log("✅ Connected to MongoDB")

    const db = client.db()
    const users = db.collection("users")
    const accounts = db.collection("accounts")
    const sessions = db.collection("sessions")

    // Find the user
    const user = await users.findOne({ email })
    
    if (!user) {
      console.log(`ℹ️  No user found with email: ${email}`)
      return
    }

    console.log(`\n📋 Found user:`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Name: ${user.name}`)
    console.log(`   ID: ${user._id}`)
    console.log(`   Active: ${user.isActive ?? 'undefined'}`)

    // Delete associated data
    const accountsDeleted = await accounts.deleteMany({ userId: user._id })
    const sessionsDeleted = await sessions.deleteMany({ userId: user._id })
    const userDeleted = await users.deleteOne({ _id: user._id })

    console.log(`\n✅ Deleted:`)
    console.log(`   User: ${userDeleted.deletedCount}`)
    console.log(`   Accounts: ${accountsDeleted.deletedCount}`)
    console.log(`   Sessions: ${sessionsDeleted.deletedCount}`)
    
    console.log(`\n✨ User "${email}" has been completely removed from the database`)

  } catch (error) {
    console.error("❌ Error:", error)
    process.exit(1)
  } finally {
    await client.close()
    console.log("\n🔌 Disconnected from MongoDB")
  }
}

main()
