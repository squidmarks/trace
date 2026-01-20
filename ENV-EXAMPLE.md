# Environment Variables Example

Copy these to your `apps/web/.env.local` file and fill in your values:

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/trace

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-generate-with-openssl-rand-base64-32

# Indexer Service
INDEXER_SERVICE_URL=http://localhost:3001
INDEXER_SERVICE_TOKEN=your-shared-secret-token-between-web-and-indexer

# OpenAI API
OPENAI_API_KEY=sk-your-openai-api-key-here

# Admin Configuration
# This email will be automatically activated when signing in (bypasses approval requirement)
ADMIN_EMAIL=admin@example.com

# Postmark Email Service
# Get your API token from: https://account.postmarkapp.com/servers/YOUR_SERVER/credentials
POSTMARK_API_TOKEN=your-postmark-server-api-token-here
POSTMARK_FROM_EMAIL=noreply@yourdomain.com
```

## Quick Setup Guide

### 1. MongoDB
- Install locally or use MongoDB Atlas (free tier)
- Default local URI: `mongodb://localhost:27017/trace`

### 2. NextAuth Secret
Generate a secure secret:
```bash
openssl rand -base64 32
```

### 3. Indexer Service Token
Generate a shared secret (both web and indexer need the same token):
```bash
openssl rand -base64 32
```

### 4. OpenAI API Key
- Sign up at https://platform.openai.com
- Create an API key in the dashboard
- Add billing information (required for API access)

### 5. Admin Email
- Use your email address
- This email will be automatically activated when signing in
- Bypasses the account approval requirement

### 6. Postmark
- Sign up at https://postmarkapp.com
- Create a server
- Copy the "Server API token"
- Verify your sender email address or domain
- Use verified email as `POSTMARK_FROM_EMAIL`

## Development vs Production

### Development (.env.local)
```bash
NEXTAUTH_URL=http://localhost:3000
INDEXER_SERVICE_URL=http://localhost:3001
```

### Production (.env.production)
```bash
NEXTAUTH_URL=https://yourdomain.com
INDEXER_SERVICE_URL=https://indexer.yourdomain.com
```

## Security Notes

⚠️ **Never commit `.env.local` or `.env.production` to git!**

These files are already in `.gitignore`, but double-check:
- Don't share API keys publicly
- Use different secrets for dev/staging/production
- Rotate keys if compromised
- Use environment variables in deployment platforms (Vercel, Railway, etc.)

