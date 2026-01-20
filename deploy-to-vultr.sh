#!/bin/bash
# Deployment script for Vultr server
# Run this ON THE VULTR SERVER after SSHing in

set -e  # Exit on any error

echo "🚀 Starting Trace deployment on Vultr..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Docker
echo "🐳 Installing Docker..."
apt install -y curl git ca-certificates gnupg lsb-release

# Add Docker's official GPG key
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start Docker
echo "▶️  Starting Docker service..."
systemctl start docker
systemctl enable docker

# Verify Docker installation
docker --version
docker compose version

# Configure firewall
echo "🔒 Configuring firewall..."
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # Trace web app
ufw --force enable

# Clone repository
echo "📥 Cloning repository..."
cd /opt
if [ -d "trace" ]; then
    echo "Directory exists, pulling latest..."
    cd trace
    git pull origin main
else
    git clone https://github.com/YOUR_GITHUB_USERNAME/trace.git
    cd trace
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚙️  Creating .env file..."
    cat > .env << 'EOF'
MONGODB_URI=mongodb://mongodb:27017/trace
NEXTAUTH_URL=http://45.32.210.66:3000
NEXTAUTH_SECRET=CHANGE_ME
GOOGLE_CLIENT_ID=CHANGE_ME
GOOGLE_CLIENT_SECRET=CHANGE_ME
INDEXER_SERVICE_URL=http://indexer:3001
INDEXER_SERVICE_TOKEN=CHANGE_ME
OPENAI_API_KEY=CHANGE_ME
ADMIN_EMAIL=geoff.gerhardt@gmail.com
EOF
    
    echo ""
    echo "⚠️  IMPORTANT: Edit /opt/trace/.env and set your credentials!"
    echo "Run: nano /opt/trace/.env"
    echo ""
    echo "Generate secrets with: openssl rand -base64 32"
    echo ""
    exit 1
fi

# Start application
echo "🚀 Starting Docker containers..."
docker compose up -d --build

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Check status with: docker compose ps"
echo "📝 View logs with: docker compose logs -f"
echo "🌐 Access app at: http://45.32.210.66:3000"
echo ""
