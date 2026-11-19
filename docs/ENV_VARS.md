# Environment Variables Reference — QROS / MenuGo ⚙️

This document provides a comprehensive reference for all environment variables used across the QROS monorepo, including where they are loaded, their purpose, default values, and how to configure them for local development and production.

---

## 📋 Table of Contents
1. [Overview & Hierarchy](#1-overview--hierarchy)
2. [Root & Backend API Variables (`.env`)](#2-root--backend-api-variables-env)
3. [Restaurant Web App Variables (`apps/restaurant-web/.env.local`)](#3-restaurant-web-app-variables)
4. [Cinema Web App Variables (`apps/cinema-web/.env.local`)](#4-cinema-web-app-variables)
5. [Main Web & Super Admin Variables (`apps/main-web/.env.local`)](#5-main-web--super-admin-variables)
6. [Generating Secure Keys](#6-generating-secure-keys)

---

## 1. Overview & Hierarchy

The monorepo separates secrets and configurations into scoped files:
- **`menugo-V1/.env`**: Used by `apps/api` (via `dotenv`), `packages/database` (for migrations and DB pools), and root test runners.
- **`apps/restaurant-web/.env.local`**: Loaded by Next.js when running the Restaurant Web frontend (Port `3000`).
- **`apps/cinema-web/.env.local`**: Loaded by Next.js when running the Cinema Web frontend (Port `3001`).
- **`apps/main-web/.env.local`**: Loaded by Next.js when running the Main Web frontend (Port `3002`).

> [!IMPORTANT]
> Never commit `.env` or `.env.local` files containing real production credentials to Git. Always copy from `.env.example` when setting up a new environment.

---

## 2. Root & Backend API Variables (`.env`)

| Variable Name | Required | Default / Example | Purpose & Description |
|---|---|---|---|
| `QROS_DATABASE_URL` | **Yes** (Tri-DB) | `postgresql://user:pass@ep-qros-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require` | Central Master Platform Database for Super Admin, central venue registry (all restaurants & cinema theatres), subscription plans, and platform billing. |
| `RESTAURANT_DATABASE_URL` | Optional | `postgresql://user:pass@ep-rest-pooler.us-east-2.aws.neon.tech/restaurant_db?sslmode=require` | Dedicated restaurant operational database connection string. Falls back to `DATABASE_URL` if unset. |
| `CINEMA_DATABASE_URL` | Optional | `postgresql://user:pass@ep-cine-pooler.us-east-2.aws.neon.tech/cinema_db?sslmode=require` | Dedicated cinema operational database connection string. Falls back to `DATABASE_URL` if unset. |
| `DATABASE_URL` | Optional | `postgresql://user:pass@ep-sample-pooler.us-east-2.aws.neon.tech/menugo?sslmode=require` | Fallback pooled PostgreSQL connection string used when dedicated URLs are not provided. |
| `DB_POOL_MAX` | No | `10` (prod), `20` (dev) | Maximum database connection pool size per serverless/container instance. |
| `DB_CONNECTION_TIMEOUT` | No | `15000` | Connection timeout in milliseconds for PostgreSQL client connection attempts. |
| `BETTER_AUTH_SECRET` | **Yes** | 32+ character random string | Secret key for hashing, signing, and encrypting Better Auth session cookies. |
| `BETTER_AUTH_URL` | **Yes** | `http://localhost:5001` | Base URL of the backend API for authentication endpoints and OAuth callbacks. |
| `AUTH_COOKIE_DOMAIN` | No | `""` (or `.yourdomain.com`) | Cross-subdomain cookie domain. Allows sharing session cookies across subdomains in production. |
| `AUTH_COOKIE_SAME_SITE` | No | `lax` | SameSite cookie policy for session cookies (`lax`, `strict`, or `none`). |
| `PORT` | No | `5001` | HTTP port on which the Express 5 server listens locally. |
| `API_URL` | **Yes** | `http://localhost:5001` | Backend API server canonical URL. |
| `NEXT_PUBLIC_API_URL` | **Yes** | `http://localhost:5001` | Public API URL accessible from client browser JavaScript. |
| `NEXT_PUBLIC_APP_URL` | **Yes** | `http://localhost:3000` | Default frontend application URL. |
| `APP_URL` | No | `http://localhost:3000` | Canonical web application URL for server-side auth redirect validation. |
| `TRUSTED_ORIGINS` | No | `http://localhost:3000,http://localhost:3001,http://localhost:3002` | Comma-separated list of allowed CORS origins. |
| `R2_ACCOUNT_ID` | Optional | Cloudflare Account ID | Account ID for Cloudflare R2 object storage. |
| `R2_ACCESS_KEY_ID` | Optional | Cloudflare Access Key | S3-compatible Access Key with read/write access to R2 bucket. |
| `R2_SECRET_ACCESS_KEY` | Optional | Cloudflare Secret Key | S3-compatible Secret Access Key. |
| `R2_BUCKET_NAME` | Optional | `menugo-media` | Name of the Cloudflare R2 bucket. |
| `R2_PUBLIC_URL` | Optional | `https://pub-xyz.r2.dev` | Public CDN delivery base URL for images stored in R2. |
| `R2_ENDPOINT` | Optional | `https://[account-id].r2.cloudflarestorage.com` | Custom S3 endpoint (auto-derived from Account ID if omitted). |
| `ENCRYPTION_KEY` | **Yes** (Cinema) | 64-char hex string (32 bytes) | Cryptographically secure AES-256-GCM encryption key for encrypting merchant payment secrets at rest. |
| `NODE_ENV` | No | `development` / `production` | Node execution environment mode. |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth Client ID | Google Cloud Console OAuth 2.0 Client ID for Google Sign-In. |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth Secret | Google Cloud Console OAuth 2.0 Client Secret. |
| `SUPER_ADMIN_EMAILS` | No | `admin@menugo.com,owner@menugo.com` | Comma-separated list of emails with Super Administrator privileges. |
| `SUPER_ADMIN_KEY` | No | Secure random string | Master key used for platform-wide emergency access and inspections. |
| `SUPER_ADMIN_PASSWORD` | No | Secure random string | Initial password for auto-provisioned super administrator account. |

---

## 3. Restaurant Web App Variables (`apps/restaurant-web/.env.local`)

```env
# Port & Backend Connection
PORT=5001
API_URL="http://localhost:5001"
NEXT_PUBLIC_API_URL="http://localhost:5001"

# App Cross-Links
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_CINEMA_URL="http://localhost:3001"
NEXT_PUBLIC_MAIN_URL="http://localhost:3002"

# Better Auth Client Secret & URL
BETTER_AUTH_SECRET="your-32-char-random-secret"
BETTER_AUTH_URL="http://localhost:5001"

# Cloudflare R2 Direct Uploads (Optional in local dev)
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME="menugo-media"
R2_PUBLIC_URL="https://pub-xyz.r2.dev"

# Node Environment
NODE_ENV="development"
```

---

## 4. Cinema Web App Variables (`apps/cinema-web/.env.local`)

```env
# Backend Connection
NEXT_PUBLIC_API_URL="http://localhost:5001"

# App Cross-Links
NEXT_PUBLIC_APP_URL="http://localhost:3001"
NEXT_PUBLIC_RESTAURANT_URL="http://localhost:3000"
NEXT_PUBLIC_MAIN_URL="http://localhost:3002"

# Node Environment
NODE_ENV="development"
```

---

## 5. Main Web & Super Admin Variables (`apps/main-web/.env.local`)

```env
# Backend Connection
NEXT_PUBLIC_API_URL="http://localhost:5001"

# App Cross-Links
NEXT_PUBLIC_APP_URL="http://localhost:3002"
NEXT_PUBLIC_RESTAURANT_URL="http://localhost:3000"
NEXT_PUBLIC_CINEMA_URL="http://localhost:3001"

# Node Environment
NODE_ENV="development"
```

---

## 6. Generating Secure Keys

You can generate cryptographically secure keys directly in your terminal:

```bash
# Generate BETTER_AUTH_SECRET (Base64 32 bytes)
openssl rand -base64 32

# Generate ENCRYPTION_KEY (Hex 32 bytes / 64 characters)
openssl rand -hex 32

# Generate SUPER_ADMIN_KEY
openssl rand -hex 24
```
