# MenuGo — Production Deployment & Operations Guide

This guide provides end-to-end instructions for deploying, migrating, monitoring, and maintaining the MenuGo platform in production for both **Restaurant Dine-In** and **Cinema Seat Delivery** operations.

---

## 1. Production Architecture Overview

```mermaid
flowchart TD
    subgraph Clients["Edge & Clients"]
        DineInCust["Restaurant Customer<br/>(Mobile Table QR)"]
        CinemaCust["Cinema Seat Customer<br/>(Mobile Seat QR)"]
        RestStaff["Restaurant Staff / KDS<br/>(Tablet / POS)"]
        CinemaStaff["Cinema Kitchen & Delivery Staff<br/>(KDS & Seat Delivery PWA)"]
    end

    subgraph Hosting["Application Hosting (Vercel / Containers)"]
        Web["Next.js 14 Web Application (apps/web)<br/>Edge CDN, SSR & Static Pages"]
        API["Express 5 API (apps/api)<br/>REST Endpoints & Webhook Handlers"]
    end

    subgraph PaymentGateways["Payment Gateways (Merchant Accounts)"]
        Razorpay["Razorpay Gateway<br/>(S2S Webhooks & Orders API)"]
        Paytm["Paytm Gateway<br/>(S2S Webhooks & InitiateTxn API)"]
    end

    subgraph Cloudflare["Cloudflare"]
        R2["Cloudflare R2 Object Storage<br/>(Bucket: menugo-media)"]
        CDN["R2 Public CDN (media.yourdomain.com)"]
    end

    subgraph Neon["Neon Serverless PostgreSQL"]
        PgBouncer["Connection Pooler (-pooler on Port 5432)"]
        Postgres["PostgreSQL Database (Compute)"]
    end

    DineInCust -->|HTTPS| Web
    CinemaCust -->|HTTPS| Web
    RestStaff -->|Session Auth / Orders| API
    CinemaStaff -->|Session Auth / KDS / Delivery| API
    Web -->|API Requests| API

    CinemaCust -->|UPI / Netbanking / Cards| Razorpay
    CinemaCust -->|UPI / Paytm Wallet| Paytm
    Razorpay -->|POST S2S Webhooks| API
    Paytm -->|POST S2S Webhooks| API

    Web -->|Fetch Photos| CDN
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
4. Set `DB_POOL_MAX=10` in serverless / container environments.

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
  DB_POOL_MAX="10"
  BETTER_AUTH_SECRET="[secure-random-32-chars-string]"
  BETTER_AUTH_URL="https://api.yourdomain.com"
  AUTH_COOKIE_DOMAIN=".yourdomain.com"
  AUTH_COOKIE_SAME_SITE="lax"
  NEXT_PUBLIC_APP_URL="https://app.yourdomain.com"
  APP_URL="https://app.yourdomain.com"
  TRUSTED_ORIGINS="https://app.yourdomain.com,https://yourdomain.com"
  ENCRYPTION_KEY="[64-hex-chars-aes-256-gcm-master-key]"
  R2_ACCOUNT_ID="[cloudflare-account-id]"
  R2_ACCESS_KEY_ID="[r2-access-key-id]"
  R2_SECRET_ACCESS_KEY="[r2-secret-access-key]"
  R2_BUCKET_NAME="menugo-media"
  R2_PUBLIC_URL="https://media.yourdomain.com"
  NODE_ENV="production"
  ```

---

## 3. Environment Variables Reference

| Variable | Scope | Description | Format / Example |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | API | Neon PostgreSQL pooled connection string | `postgresql://...@...-pooler.neon.tech/neondb?sslmode=require` |
| `DB_POOL_MAX` | API | Max DB pool connections | `10` |
| `BETTER_AUTH_SECRET` | API | Cryptographic session signing key | 32+ char random base64 string |
| `BETTER_AUTH_URL` | API | Authoritative API URL for auth | `https://api.yourdomain.com` |
| `AUTH_COOKIE_DOMAIN` | API | Shared domain for cross-subdomain auth | `.yourdomain.com` |
| `AUTH_COOKIE_SAME_SITE`| API | Cookie SameSite attribute | `lax` (or `none` for cross-site) |
| `ENCRYPTION_KEY` | API | AES-256-GCM master key for merchant secrets | 64-hex character string (`openssl rand -hex 32`) |
| `NEXT_PUBLIC_API_URL` | Web & API | Publicly reachable API base URL | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_APP_URL` | Web & API | Publicly reachable Web base URL | `https://app.yourdomain.com` |
| `APP_URL` | API | Canonical web app URL for auth callbacks | `https://app.yourdomain.com` |
| `TRUSTED_ORIGINS` | API | Comma-separated CORS origins | `https://app.yourdomain.com,https://yourdomain.com` |
| `R2_ACCOUNT_ID` | API | Cloudflare account ID | Hex string |
| `R2_ACCESS_KEY_ID` | API | Cloudflare R2 access key ID | String |
| `R2_SECRET_ACCESS_KEY`| API | Cloudflare R2 secret access key | String |
| `R2_BUCKET_NAME` | API | R2 bucket name | `menugo-media` |
| `R2_PUBLIC_URL` | API | Public delivery URL for media | `https://media.yourdomain.com` |
| `NODE_ENV` | All | Application environment | `production` |

> [!CAUTION]
> **Encryption Key Persistence**: `ENCRYPTION_KEY` encrypts theatre Razorpay and Paytm credentials in `cinema_payment_accounts`. If this key is lost or rotated without re-encrypting existing database rows, all existing cinema payment integrations will fail to decrypt. Back up this key securely.

---

## 4. Database Migration Procedure

All cinema migrations (`0005` to `0016`) are **additive and non-destructive**. They add cinema tables (`cinema_screens`, `cinema_seats`, `cinema_shows`, `cinema_payment_accounts`, etc.) and optional cinema columns to `orders` and `restaurants` without altering or locking existing restaurant records.

### Safe Migration Execution Steps
1. **Create Pre-Migration Branch**:
   In the Neon Console, create a new branch from `main` named `pre-migration-backup-YYYY-MM-DD`. This creates an instant point-in-time snapshot.
2. **Review Pending Migrations**:
   Inspect migration SQL files in `packages/database/drizzle/migrations/` (migrations 0005 through 0016).
3. **Execute Transactional Migration**:
   ```bash
   npm run migrate --workspace=@menugo/database
   ```
4. **Verify Database Health**:
   ```bash
   curl -i https://api.yourdomain.com/api/health/ready
   ```

---

## 5. Payment Gateway Webhook Configuration

Each cinema theatre operates its own Razorpay and/or Paytm merchant account. The API dynamically resolves merchant credentials, decrypts secrets, verifies cryptographic signatures, and enforces idempotency.

### Razorpay Webhook Setup
1. Log in to the [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Navigate to **Settings** $\to$ **Webhooks** $\to$ **Add New Webhook**.
3. Set **Webhook URL**:
   ```
   https://api.yourdomain.com/api/cinema/payments/webhook/{theatreId}/razorpay
   ```
   *(Replace `{theatreId}` with the theatre's UUID displayed in Cinema Admin Settings).*
4. Set **Secret**: Enter a secure random string (copy this into the Cinema Admin Settings Webhook Secret field).
5. Select Active Events:
   - `order.paid`
   - `payment.captured`
   - `payment.failed`
   - `refund.processed`
6. Save and verify.

### Paytm Webhook / S2S Callback Setup
1. Log in to the [Paytm Merchant Dashboard](https://dashboard.paytm.com).
2. Navigate to **Developer Settings** $\to$ **Webhook URL**.
3. Set **Callback / Webhook URL**:
   ```
   https://api.yourdomain.com/api/cinema/payments/webhook/{theatreId}/paytm
   ```
4. Paytm signs server-to-server notifications using the theatre's `Merchant Key` (`CHECKSUMHASH`).
5. Ensure the theatre's `MID`, `Merchant Key`, and `Website Name` (`DEFAULT` or custom) are saved in Cinema Admin Settings.

### Webhook Reliability Features
- **Signature Verification**: Every incoming webhook payload is cryptographically validated using HMAC-SHA256 (Razorpay) or Paytm checksum algorithms.
- **Idempotency Guarantee**: Events are deduplicated via `cinema_webhook_events`. Repeated gateway retries return `200 OK` without duplicate processing.
- **Out-of-Order Protection**: Delayed failure notifications arriving after an order has already been marked `PAID` are safely acknowledged and ignored.

---

## 6. Domain Routing Architecture

| Route Pattern | Service | Access / Role | Description |
| :--- | :--- | :--- | :--- |
| `/` | Web | Public | Platform home & portal switcher |
| `/menu/[restaurantSlug]` | Web | Public | Restaurant customer digital menu |
| `/cinema/[theatreToken]` | Web | Public | Cinema customer show & screen selector |
| `/cinema/[theatreToken]/[screenToken]` | Web | Public | Direct screen/seat customer ordering |
| `/cinema/track/[token]` | Web | Public | Live cinema order tracking by token |
| `/cinema/kitchen` | Web | Kitchen / Admin | Cinema Kitchen Display System (KDS) |
| `/cinema/delivery` | Web | Delivery / Admin | Cinema Seat Delivery dispatch interface |
| `/cinema/admin/*` | Web | Cinema Admin / Owner | Cinema management dashboards |
| `/admin/*` | Web | Restaurant Admin / Owner | Restaurant management dashboards |
| `/api/health/*` | API | Public | Liveness (`/live`) and DB readiness (`/ready`) |
| `/api/cinema/public/*` | API | Public | Public theatre, show, and seat availability |
| `/api/cinema/payments/webhook/:theatreId/:provider` | API | Gateway Webhooks | S2S payment notifications |
| `/api/cinema/*` | API | Cinema Staff / Admin | Protected cinema operations API |
| `/api/*` | API | Restaurant Staff / Admin | Protected restaurant operations API |

---

## 7. Monitoring, Logging & Observability

### Logging Guidelines (Compliance & Privacy)
- **Zero Secrets Logging**: Never log encryption keys, merchant secrets (`keySecret`), webhook secrets, database connection strings, or authorization headers.
- **Payment Security (RBI & PCI-DSS)**: Never log credit/debit card PAN numbers, CVVs, expiry dates, or UPI PINs.
- **PII Protection**: Customer phone numbers and emails are only logged in sanitized transaction audit records.

### Health Probes & Monitoring Checks
- **Liveness Probe**: `GET /api/health/live` (monitored every 10–30s by load balancers; returns `200` with uptime).
- **Readiness Probe**: `GET /api/health/ready` (executes `SELECT 1` ping; returns `200` when DB is connected, `503` if degraded).
- **Payment Ledger Reconciliation**: Query `cinema_payment_transactions` and `cinema_refunds` to cross-check captured gateway amounts against MenuGo order records.

---

## 8. Rollback Procedures

### Application Rollback
- **Vercel**: In Vercel Dashboard $\to$ **Deployments**, locate the last known healthy deployment and click **Promote to Production** (instant zero-downtime rollback).
- **Docker / Containers**: Redeploy the previous container image tag.

### Database Rollback
- Neon PostgreSQL supports instant point-in-time recovery and zero-copy branching:
  1. If an issue occurs immediately after migration, restore compute to the `pre-migration-backup` branch.
  2. Because cinema migrations are non-destructive, rolling back the application code while leaving cinema tables in place does NOT impact existing restaurant dine-in tables or operations.

---

## 9. Pre-Flight Deployment Smoke Testing

Run the automated smoke test script against staging or production:

```bash
# Run against local API server
npm run smoke

# Run against remote staging or production API
npx tsx scripts/smoke-test.ts --url https://api.yourdomain.com
```

### Smoke Test Verification Matrix (10 Checks)
1. ✅ Health Liveness Probe (`/api/health/live`)
2. ✅ Health Readiness Probe & DB Connection (`/api/health/ready`)
3. ✅ Unauthenticated Session Rejection (`/api/auth/me` $\to$ 401)
4. ✅ Invalid Login Rejection & Sanitization (`/api/auth/sign-in/email`)
5. ✅ Public Restaurant Menu 404 Handling (`/api/restaurants/by-slug/:slug`)
6. ✅ Invalid Table QR Token Rejection (Malformed: 400)
7. ✅ Unassigned Table QR Token Rejection (48-hex: 404)
8. ✅ Cinema Protected Route Authentication Check (`/api/cinema/screens` $\to$ 401)
9. ✅ Cinema Public Theatre QR Lookup (Nonexistent Token $\to$ 404)
10. ✅ Cinema Payment Webhook Rejection for Unknown Theatre (404)
