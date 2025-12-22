import { getUsersCollection } from "./db"

/**
 * Bootstrap the application by ensuring the admin user exists
 * This should be called once when the application starts
 */
export async function bootstrapAdminUser(): Promise<void> {
  try {
    const adminEmail = process.env.ADMIN_EMAIL

    if (!adminEmail) {
      console.warn(
        "[Bootstrap] ADMIN_EMAIL not configured in environment variables. Skipping admin user creation."
      )
      return
    }

    const users = await getUsersCollection()

    // Check if admin user already exists
    const existingAdmin = await users.findOne({ email: adminEmail })

    if (existingAdmin) {
      console.log(`[Bootstrap] Admin user already exists: ${adminEmail}`)
      
      // Ensure the user has admin role
      if (existingAdmin.role !== "admin") {
        await users.updateOne(
          { email: adminEmail },
          { $set: { role: "admin", updatedAt: new Date() } }
        )
        console.log(`[Bootstrap] Updated ${adminEmail} to admin role`)
      }
      
      return
    }

    // Create admin user
    const adminUser = {
      email: adminEmail,
      name: "Admin User",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await users.insertOne(adminUser as any)

    console.log(
      `[Bootstrap] Created admin user: ${adminEmail} (ID: ${result.insertedId})`
    )
  } catch (error) {
    console.error("[Bootstrap] Error creating admin user:", error)
    // Don't throw - allow app to start even if bootstrap fails
  }
}

/**
 * Initialize the application
 * Call this once when the app starts (e.g., in middleware or API route)
 */
let isInitialized = false

export async function initializeApp(): Promise<void> {
  if (isInitialized) {
    return
  }

  console.log("[Bootstrap] Initializing Trace application...")

  await bootstrapAdminUser()

  isInitialized = true
  console.log("[Bootstrap] Application initialized successfully")
}

