/**
 * Migration script to activate existing users
 * 
 * This script sets isActive=true for all existing users in the database.
 * Run this once after deploying the account approval feature to ensure
 * existing users can continue to access the system.
 * 
 * Usage:
 *   npx tsx scripts/activate-existing-users.ts
 */

import { MongoClient } from "mongodb"

async function main() {
  const mongoUri = process.env.MONGODB_URI
  
  if (!mongoUri) {
    console.error("❌ MONGODB_URI environment variable is not set")
    process.exit(1)
  }

  console.log("🔌 Connecting to MongoDB...")
  const client = new MongoClient(mongoUri)
  
  try {
    await client.connect()
    console.log("✅ Connected to MongoDB")

    const db = client.db()
    const users = db.collection("users")

    // Count users without isActive field
    const inactiveCount = await users.countDocuments({
      $or: [
        { isActive: { $exists: false } },
        { isActive: false }
      ]
    })

    console.log(`\n📊 Found ${inactiveCount} users to activate`)

    if (inactiveCount === 0) {
      console.log("✅ All users are already active!")
      return
    }

    // Update all users to be active
    const result = await users.updateMany(
      {
        $or: [
          { isActive: { $exists: false } },
          { isActive: false }
        ]
      },
      {
        $set: {
          isActive: true,
          updatedAt: new Date()
        }
      }
    )

    console.log(`\n✅ Activated ${result.modifiedCount} users`)
    
    // Show updated user list
    const allUsers = await users.find({}).toArray()
    console.log("\n📋 User Status:")
    console.log("─".repeat(80))
    for (const user of allUsers) {
      const status = user.isActive ? "✅ Active" : "⏳ Pending"
      console.log(`${status} | ${user.email} | ${user.name}`)
    }
    console.log("─".repeat(80))

  } catch (error) {
    console.error("❌ Error:", error)
    process.exit(1)
  } finally {
    await client.close()
    console.log("\n🔌 Disconnected from MongoDB")
  }
}

main()
