# MenuGo V1.0 — Production Deployment & Operations Guide

This guide provides end-to-end instructions for deploying, migrating, monitoring, and maintaining the MenuGo platform in production.

---

## 1. Production Architecture Overview

```mermaid
flowchart TD
    subgraph Clients["Edge & Clients"]
        Browser["Dine-In Customer (Mobile Safari / Chrome)"]
        StaffBrowser["Restaurant Staff / Kitchen Display (Tablet / Desktop)"]
    end

    subgraph Vercel["Vercel Hosting Platform"]
        Web["Next.js 14 Web Application (apps/web)<br/>Edge CDN & Static Pages"]
        API["Express 5 API (apps/api)<br/>Serverless Function / Container"]
    end

    subgraph Cloudflare["Cloudflare"]
        R2["Cloudflare R2 Object Storage<br/>(Bucket: menugo-media)"]
        CDN["R2 Public CDN (media.yourdomain.com)"]
    end

    subgraph Neon["Neon Serverless PostgreSQL"]
        PgBouncer["Connection Pooler (-pooler on Port 5432)"]
        Postgres["PostgreSQL Database (Compute)"]
    end

    Browser -->|HTTPS| Web
    StaffBrowser -->|HTTPS| Web
    Web -->|API Requests| API
    StaffBrowser -->|Session Auth / Orders| API
    Browser -->|Direct Image Upload (Presigned PUT)| R2
    Browser -->|Fetch Food Photos| CDN
    API -->|Generate Presigned URL / Safe Delete| R2
    API -->|Pooled Queries (SSL)| PgBouncer
    PgBouncer --> Postgres
```

---

## 2. Infrastructure & Hosting Setup

### A. Database: Neon PostgreSQL
1. Create a project in [Neon Console](https://console.neon.tech).
2. Note your pooled connection string:
   ```
   postgresql://[user]:[password]@[endpoint]-pooler.[region].aws.neon.tech/[dbname]?sslmode=require
   ```
3. Ensure `-pooler` is included in the host name. This directs connections to PgBouncer to prevent connection exhaustion.
4. Set `DB_POOL_MAX=10` in serverless environments.

### B. Image Storage: Cloudflare R2
1. Create a bucket named `menugo-media` in Cloudflare Dashboard.
2. In **Bucket Settings** $\to$ **CORS Policy**, apply the policy from `scripts/r2-cors.json`:
   ```json
   [
     {
       "AllowedOrigins": [
         "https://app.yourdomain.com",
         "https://yourdomain.com"
       ],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["Content-Type", "Content-Length"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 86400
     }
   ]
   ```
3. Connect a Custom Domain (e.g. `media.yourdomain.com`) or enable the Managed Public R2 URL (`pub-[hash].r2.dev`).
4. Generate an R2 API Token with **Object Read & Write** permissions scoped to `menugo-media`.

### C. Hosting on Vercel

#### Project 1: Web Frontend (`@menugo/web`)
- **Root Directory**: `apps/web`
- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Environment Variables**:
  ```env
  NEXT_PUBLIC_API_URL="https://api.yourdomain.com"
  NEXT_PUBLIC_APP_URL="https://app.yourdomain.com"
  NODE_ENV="production"
  ```

#### Project 2: Backend API (`@menugo/api`)
- **Root Directory**: `apps/api`
- **Output Directory**: `api` (or Serverless Function via `apps/api/vercel.json`)
- **Build Command**: `npm run build`
- **Environment Variables**:
  ```env
  DATABASE_URL="postgresql://...-pooler.neon.tech/neondb?sslmode=require"
  BETTER_AUTH_SECRET="[secure-random-32-chars-string]"
  BETTER_AUTH_URL="https://api.yourdomain.com"
  AUTH_COOKIE_DOMAIN=".yourdomain.com"
  AUTH_COOKIE_SAME_SITE="lax"
  NEXT_PUBLIC_APP_URL="https://app.yourdomain.com"
  APP_URL="https://app.yourdomain.com"
  TRUSTED_ORIGINS="https://app.yourdomain.com,https://yourdomain.com"
  R2_ACCOUNT_ID="[cloudflare-account-id]"
  R2_ACCESS_KEY_ID="[r2-access-key-id]"
  R2_SECRET_ACCESS_KEY="[r2-secret-access-key]"
  R2_BUCKET_NAME="menugo-media"
  R2_PUBLIC_URL="https://media.yourdomain.com"
  NODE_ENV="production"
  ```

*(Alternatively, if running `@menugo/api` as a persistent container on Railway, Render, Fly.io, or AWS ECS, deploy using `npm run start` in `apps/api`).*

---

## 3. Database Migration Procedure

> [!IMPORTANT]
> **Human Approval Rule**: Never run migrations against the production database without prior review and sign-off. Always create a Neon branch/snapshot before migrating.

### Safe Migration Steps
1. **Create Pre-Migration Branch**:
   In Neon Console, click **New Branch** from `main` named `pre-migration-backup-YYYY-MM-DD`. This creates an instant snapshot for instantaneous rollback.
2. **Review Pending Migrations**:
   Inspect pending SQL scripts in `packages/database/drizzle/migrations`.
3. **Execute Migration**:
   ```bash
   # Run safe, transactional migration runner
   npm run migrate --workspace=@menugo/database
   ```
4. **Verify Database Health**:
   ```bash
   # Verify that DB readiness probe reports healthy
   curl -i https://api.yourdomain.com/api/health/ready
   ```

---

## 4. Rollback Procedures

### Application Rollback
- In Vercel Dashboard, navigate to **Deployments** $\to$ select the previous green deployment $\to$ click **Promote to Production** (instant zero-downtime rollback).

### Database Rollback
- Because Neon supports point-in-time recovery and instant branching:
  1. In Neon Console, restore database state to the point in time immediately before the migration.
  2. Alternatively, switch the connection endpoint to the `pre-migration-backup` branch.

---

## 5. Secret Rotation Procedures

### Better Auth Secret (`BETTER_AUTH_SECRET`)
1. Generate a new secret:
   ```bash
   openssl rand -base64 32
   ```
2. Update `BETTER_AUTH_SECRET` in the Vercel/host dashboard for `apps/api`.
3. Redeploy the API.
4. *Impact*: Active sessions will be invalidated; staff and owners will be prompted to log in again.

### Cloudflare R2 Credentials
1. In Cloudflare Dashboard $\to$ **R2** $\to$ **Manage R2 API Tokens**, create a new token.
2. Update `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` in API environment variables.
3. Verify upload functionality via smoke test.
4. Revoke the previous R2 API token in Cloudflare Dashboard.

### Neon Database Credentials
1. In Neon Console $\to$ **Users / Roles**, rotate the password for the application user.
2. Update `DATABASE_URL` in API environment variables.
3. Test readiness probe: `curl https://api.yourdomain.com/api/health/ready`.

---

## 6. Deployment Smoke Testing

MenuGo includes an automated smoke test suite that verifies critical production operations in under 2 seconds:

```bash
# Run against local API server
npm run smoke

# Run against production or staging endpoint
npx tsx scripts/smoke-test.ts --url https://api.yourdomain.com
```

### Smoke Test Matrix
- ✅ Liveness probe (`/api/health/live`)
- ✅ Readiness probe & DB connectivity (`/api/health/ready`)
- ✅ Unauthenticated session rejection (`/api/auth/me` $\to$ 401)
- ✅ Invalid login sanitization without stack traces (`/api/auth/sign-in/email`)
- ✅ Public menu 404 handling (`/api/restaurants/by-slug/:slug`)
- ✅ Table QR token format rejection (Malformed: 400, Unassigned: 404)
- ✅ Security headers (`X-Content-Type-Options: nosniff`)

