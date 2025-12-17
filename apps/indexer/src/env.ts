import dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from apps/indexer/.env
// (go up from src/ to apps/indexer/)
dotenv.config({ path: join(__dirname, "../.env") })

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

