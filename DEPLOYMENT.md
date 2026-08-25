# Production Deployment Guide

This guide covers deploying the ClickUp Clone application to a production environment.

## 1. Pre-deployment Checklist

Before deploying, ensure you have completed the following:

- [ ] **Environment Variables:** All required environment variables are set.
- [ ] **Database Migrations:** Prisma migrations are applied.
- [ ] **Build Optimization:** Frontend is built for production (`npm run build`).
- [ ] **Security Checks:** SSL/TLS is configured, and secure HTTP headers are in place (Helmet).
- [ ] **Caching:** Redis is running and reachable by the backend.

### Environment Variables (.env)

```env
# Backend
PORT=4000
NODE_ENV=production
DATABASE_URL=postgresql://user:password@hostname:5432/dbname
REDIS_URL=redis://hostname:6379
JWT_SECRET=your_secure_jwt_secret
JWT_REFRESH_SECRET=your_secure_refresh_secret
CORS_ORIGIN=https://your-frontend-domain.com

# Frontend
VITE_API_URL=https://api.your-backend-domain.com/api
VITE_SOCKET_URL=https://api.your-backend-domain.com
```

## 2. Deployment Options

### Option A: Virtual Private Server (VPS) via Docker Compose

This is the recommended approach for a single-node deployment (e.g., DigitalOcean, AWS EC2, Linode).

1. **Provision a Server:** Create a Linux VPS (Ubuntu 22.04 recommended) with at least 2GB RAM.
2. **Install Dependencies:** Install Docker and Docker Compose on the VPS.
3. **Copy Architecture:** Clone your repository to the server.
   ```bash
   git clone <your-repo-url> /opt/clickup-clone
   cd /opt/clickup-clone
   ```
4. **Configure Environment:** Copy `.env.example` to `.env` and fill in your production values.
   ```bash
   cp .env.example .env
   # Edit .env with your favorite editor
   ```
5. **Start Services:** Start the application using Docker Compose.
   ```bash
   docker compose -f docker-compose.yml up -d --build
   ```
6. **Reverse Proxy (Nginx/Caddy):** Set up a reverse proxy on the host machine to handle SSL termination and route traffic to the Frontend (port 80) and Backend (port 4000) containers.

### Option B: Platform as a Service (PaaS) - Render / Railway

1. **Database:** Provision a managed PostgreSQL and Redis instance on the platform.
2. **Backend Service:**
   - Link your GitHub repository.
   - Set Build Command: `npm install && npx prisma generate && npm run build`
   - Set Start Command: `npx prisma migrate deploy && npm start`
   - Add all Backend Environment Variables.
3. **Frontend Service:**
   - Link your GitHub repository.
   - Select "Static Site" or "Node" environment.
   - Set Build Command: `npm install && npm run build`
   - Set Publish Directory: `dist`
   - Add all Frontend Environment Variables (ensure they start with `VITE_`).

## 3. CI/CD Pipeline (GitHub Actions)

To automate deployments, you can use GitHub Actions. Create a file at `.github/workflows/deploy.yml`:

```yaml
name: Deploy Next production

on:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      # Backend Tests
      - name: Install Backend Deps
        run: cd backend && npm ci
      - name: Run Backend Tests
        run: cd backend && npm test

      # Frontend Tests
      - name: Install Frontend Deps
        run: cd frontend && npm ci
      - name: Run Frontend Tests
        run: cd frontend && npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to VPS
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/clickup-clone
            git pull origin main
            docker compose down
            docker compose up -d --build
            docker system prune -f
```

## 4. Monitoring & Maintenance

### Health Checks

The backend provides a basic health check endpoint for load balancers or monitoring tools:
- **Endpoint:** `GET /` (or implement a specific `/api/health` route).

### Error Tracking

Consider integrating a tool like **Sentry** for real-time error tracking.

1.  Create an account at Sentry.io.
2.  Install the Sentry SDK in both frontend and backend.
3.  Initialize Sentry in your entry files (`App.tsx` and `backend/src/index.ts`) using your DSN.

### Database Backups

Ensure automated backups are configured for your PostgreSQL database. If using a managed database provider, enable automated daily snapshots. If self-hosting, configure a cron job using `pg_dump` to backup to an external storage service (e.g., AWS S3).
