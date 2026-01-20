# Trace Deployment Guide

Deploy Trace using Docker Compose for a complete, production-ready setup.

## 🚀 Quick Start

### 1. Prerequisites

- Docker & Docker Compose installed
- Google OAuth credentials ([Get them here](https://console.cloud.google.com/apis/credentials))
- OpenAI API key ([Get it here](https://platform.openai.com/api-keys))

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and set your values:

```bash
# Generate secrets
openssl rand -base64 32  # For NEXTAUTH_SECRET
openssl rand -base64 32  # For INDEXER_SERVICE_TOKEN

# Set your values
NEXTAUTH_SECRET=<generated-secret>
INDEXER_SERVICE_TOKEN=<generated-secret>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
OPENAI_API_KEY=<your-openai-api-key>
ADMIN_EMAIL=<your-email@example.com>

# Production URL (change for production)
NEXTAUTH_URL=http://localhost:3000
```

### 3. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. For production, add: `https://yourdomain.com/api/auth/callback/google`

### 4. Start the Application

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

The application will be available at:
- **Web App**: http://localhost:3000
- **Indexer Service**: http://localhost:3001
- **MongoDB**: localhost:27017

### 5. First Sign-In

1. Navigate to http://localhost:3000
2. Click "Sign in with Google"
3. If your email matches `ADMIN_EMAIL`, you'll be automatically activated
4. Otherwise, you'll see a "Pending Approval" page

### 6. Activate Users (Admin)

As an admin:
1. Sign in with your admin email
2. Navigate to `/admin/users` or click "Manage Users" in the sidebar
3. Click "Activate" to approve pending users

## 📋 Docker Commands

### Start Services
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f web
docker-compose logs -f indexer
docker-compose logs -f mongodb
```

### Rebuild After Code Changes
```bash
docker-compose up -d --build
```

### Restart a Service
```bash
docker-compose restart web
docker-compose restart indexer
```

### Execute Commands in Container
```bash
# Access web app container
docker-compose exec web sh

# Access MongoDB
docker-compose exec mongodb mongosh trace
```

## 🔧 Management Tasks

### Activate Existing Users

If you have users that need activation:

```bash
# Run migration script
docker-compose exec web node scripts/activate-existing-users.js
```

### Database Backup

```bash
# Backup MongoDB
docker-compose exec mongodb mongodump --db=trace --out=/tmp/backup
docker cp trace-mongodb:/tmp/backup ./backup
```

### Database Restore

```bash
# Restore MongoDB
docker cp ./backup trace-mongodb:/tmp/backup
docker-compose exec mongodb mongorestore --db=trace /tmp/backup/trace
```

### View Database

```bash
# Access MongoDB shell
docker-compose exec mongodb mongosh trace

# List collections
> show collections

# View users
> db.users.find().pretty()

# Activate a user manually
> db.users.updateOne(
    { email: "user@example.com" },
    { $set: { isActive: true } }
  )
```

## 🌐 Production Deployment

### Environment Variables

Update `.env` for production:

```bash
NEXTAUTH_URL=https://yourdomain.com
MONGODB_URI=mongodb://mongodb:27017/trace  # Or use MongoDB Atlas
```

### Using MongoDB Atlas (Recommended for Production)

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Get your connection string
3. Update `.env`:
   ```bash
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trace?retryWrites=true&w=majority
   ```
4. Remove MongoDB service from `docker-compose.yml` or comment it out

### Reverse Proxy (nginx)

Example nginx configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### SSL with Let's Encrypt

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is set up automatically
```

## 🔒 Security Considerations

### Production Checklist

- [ ] Use strong, unique secrets (32+ characters)
- [ ] Set `ADMIN_EMAIL` to your email
- [ ] Use MongoDB Atlas or secure your MongoDB instance
- [ ] Enable SSL/HTTPS in production
- [ ] Set up firewall rules (only expose ports 80/443)
- [ ] Regularly backup your database
- [ ] Keep Docker images updated
- [ ] Monitor logs for suspicious activity
- [ ] Use environment variables (never commit secrets)

### Firewall Rules (ufw example)

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

## 📊 Monitoring

### Health Checks

All services have health checks configured:

```bash
# Check service health
docker-compose ps

# Should show "(healthy)" for all services
```

### Resource Usage

```bash
# View resource usage
docker stats

# View specific container
docker stats trace-web
```

### Logs

```bash
# Follow all logs
docker-compose logs -f

# Filter by service
docker-compose logs -f web | grep ERROR

# Last 100 lines
docker-compose logs --tail=100
```

## 🐛 Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs

# Check if ports are in use
sudo lsof -i :3000
sudo lsof -i :3001
sudo lsof -i :27017

# Remove containers and rebuild
docker-compose down
docker-compose up -d --build
```

### Database Connection Issues

```bash
# Check MongoDB is running
docker-compose ps mongodb

# Test connection
docker-compose exec mongodb mongosh trace --eval "db.runCommand({ ping: 1 })"

# Check logs
docker-compose logs mongodb
```

### Web App Issues

```bash
# Check environment variables
docker-compose exec web env | grep -E "MONGODB|NEXTAUTH|GOOGLE"

# Restart web service
docker-compose restart web

# View detailed logs
docker-compose logs -f web
```

### Build Issues

```bash
# Clean everything and rebuild
docker-compose down -v
docker system prune -a
docker-compose up -d --build
```

## 🔄 Updates

### Updating the Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# View logs to ensure everything started
docker-compose logs -f
```

### Database Migrations

After updates, check if any migrations are needed:

```bash
# Run migration scripts
docker-compose exec web node scripts/migrate.js

# Or access the database directly
docker-compose exec mongodb mongosh trace
```

## 📚 Additional Resources

- **Account Approval**: Users must be activated by admin (except `ADMIN_EMAIL`)
- **User Management**: Access at `/admin/users` when signed in as admin
- **Migration Script**: Activate all existing users with `scripts/activate-existing-users.ts`
- **Delete User**: Remove user with `scripts/delete-user.ts`

## 🆘 Support

### Common Issues

**Issue**: Can't sign in  
**Solution**: Check `ADMIN_EMAIL` matches your Google account email

**Issue**: "Pending Approval" page  
**Solution**: Your account needs activation by an admin, or set your email as `ADMIN_EMAIL`

**Issue**: WebSocket connection failed  
**Solution**: Ensure indexer service is running (`docker-compose ps indexer`)

**Issue**: MongoDB connection refused  
**Solution**: Wait for MongoDB to be healthy (`docker-compose ps mongodb`)

### Getting Help

1. Check logs: `docker-compose logs -f`
2. Check service status: `docker-compose ps`
3. Check environment variables: `docker-compose config`
4. Review this guide for troubleshooting steps

---

**Ready to deploy!** 🚀

Start with: `docker-compose up -d` and access your app at http://localhost:3000
