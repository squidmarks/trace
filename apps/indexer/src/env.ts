import dotenv from "dotenv"

// Load environment variables first, before any other imports
dotenv.config()

// Validate required environment variables
const required = [
  "MONGODB_URI",
  "INDEXER_SERVICE_TOKEN",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "WEB_APP_URL",
]

const missing: string[] = []
for (const key of required) {
  if (!process.env[key]) {
    missing.push(key)
  }
}

if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
}

console.log("✅ Environment variables loaded and validated")

