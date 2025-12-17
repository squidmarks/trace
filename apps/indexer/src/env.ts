import dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { execSync } from "child_process"

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

// Check for Poppler installation (required for PDF rendering)
try {
  execSync("pdftoppm -v", { stdio: "pipe" })
  console.log("✅ Poppler tools detected (pdftoppm)")
} catch (error) {
  console.error("\n❌ ERROR: Poppler not found!")
  console.error("\nPoppler is required for PDF rendering.")
  console.error("\nInstallation instructions:")
  console.error("  macOS:   brew install poppler")
  console.error("  Ubuntu:  apt-get install poppler-utils")
  console.error("  Alpine:  apk add poppler-utils")
  console.error("  Docker:  Add 'RUN apk add poppler-utils' to Dockerfile\n")
  process.exit(1)
}

