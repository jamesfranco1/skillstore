# Deployment Guide

## Local Development

```bash
npm install
npm start
```

Server runs at http://localhost:3000

## Docker

### Build and run

```bash
docker build -t skillstore .
docker run -p 3000:3000 skillstore
```

### Docker Compose

```bash
docker-compose up -d
```

## Environment Variables

Copy `env.example` to `.env` and configure:

```bash
cp env.example .env
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 3000 | Server port |
| NODE_ENV | No | development | Environment |
| SOLANA_NETWORK | No | devnet | Solana network |
| SOLANA_RPC_URL | No | devnet URL | RPC endpoint |
| PLATFORM_WALLET | Yes* | - | Platform fee wallet |
| PLATFORM_FEE_PERCENT | No | 5 | Fee percentage |

*Required for production payments

## Production Deployment

### Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Vercel (Serverless)

Not recommended - requires refactoring for serverless architecture.

### VPS (DigitalOcean, Linode, etc.)

1. SSH into server
2. Install Node.js 20+
3. Clone repository
4. Install dependencies
5. Set up systemd service or use PM2

```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start server.js --name skillstore

# Save PM2 config
pm2 save
pm2 startup
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name skillstoremd.xyz;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## SSL Certificate

Use Certbot for free SSL:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d skillstoremd.xyz
```

## Database Migration (Future)

When moving from file storage to PostgreSQL:

1. Export existing data from `data/skills.json`
2. Set up PostgreSQL database
3. Run migration script
4. Update `DATABASE_URL` environment variable
5. Restart server

## Monitoring

Recommended tools:

- **Uptime:** UptimeRobot, Pingdom
- **Logs:** PM2 logs, Papertrail
- **Metrics:** Grafana, Datadog

