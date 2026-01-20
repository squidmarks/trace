#!/bin/bash
# Helper script to generate secrets and create .env file
# Run this ON THE VULTR SERVER

echo "🔐 Generating secrets for Trace deployment..."
echo ""

NEXTAUTH_SECRET=$(openssl rand -base64 32)
INDEXER_TOKEN=$(openssl rand -base64 32)

echo "Generated secrets:"
echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
echo "INDEXER_SERVICE_TOKEN=$INDEXER_TOKEN"
echo ""

read -p "Enter your Google Client ID: " GOOGLE_CLIENT_ID
read -p "Enter your Google Client Secret: " GOOGLE_CLIENT_SECRET
read -p "Enter your OpenAI API Key: " OPENAI_API_KEY
read -p "Enter admin email [geoff.gerhardt@gmail.com]: " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-geoff.gerhardt@gmail.com}

cat > .env << EOF
MONGODB_URI=mongodb://mongodb:27017/trace
NEXTAUTH_URL=http://45.32.210.66:3000
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
INDEXER_SERVICE_URL=http://indexer:3001
INDEXER_SERVICE_TOKEN=$INDEXER_TOKEN
OPENAI_API_KEY=$OPENAI_API_KEY
ADMIN_EMAIL=$ADMIN_EMAIL
EOF

echo ""
echo "✅ .env file created!"
echo ""
echo "⚠️  Remember to add this to Google OAuth redirect URIs:"
echo "   http://45.32.210.66:3000/api/auth/callback/google"
echo ""
