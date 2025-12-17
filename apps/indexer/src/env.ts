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

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Invalid/Missing environment variable: "${key}"`)
  }
}

console.log("[Indexer] Environment variables loaded successfully")

