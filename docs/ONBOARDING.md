# Developer Onboarding Guide — Welcome to QROS / MenuGo! 🚀

Welcome to the team! This guide will take you from a fresh clone of the repository to a fully functioning local development environment in about **15 minutes**.

---

## 📋 Table of Contents
1. [System Overview](#1-system-overview)
2. [Prerequisites](#2-prerequisites)
3. [Step-by-Step Setup](#3-step-by-step-setup)
   - [Step 1: Clone & Install Dependencies](#step-1-clone--install-dependencies)
   - [Step 2: Environment Variables](#step-2-environment-variables)
   - [Step 3: Database Provisioning & Schema Sync](#step-3-database-provisioning--schema-sync)
   - [Step 4: Seed Sample Data](#step-4-seed-sample-data)
   - [Step 5: Start Development Servers](#step-5-start-development-servers)
4. [Services, Ports & URLs Reference](#4-services-ports--urls-reference)
5. [Key Verification Checks](#5-key-verification-checks)
6. [First Day Troubleshooting & FAQs](#6-first-day-troubleshooting--faqs)
7. [Next Steps: Picking Up Your First Task](#7-next-steps-picking-up-your-first-task)

---

## 1. System Overview

**QROS** (formerly MenuGo) is an enterprise multi-tenant SaaS platform powering QR-based ordering, live Kitchen Display Systems (KDS), cashier billing, and floor management across two distinct verticals:

1. **🍽️ Restaurant Dine-In** (`apps/restaurant-web` on Port `3000`):
   - Dine-in table ordering without app installation.
   - Interactive digital menu with dietary tags, allergens, and multi-round ordering.
   - Live Kitchen Display System (KDS) with audio chimes.
   - Cashier overview, itemized billing, and table session lifecycle.
   - Waiter & floor service requests ("Call Waiter", "Request Water/Bill").
   - Admin management (categories, dishes, staff PINs, QR generation, subscriptions).

2. **🎬 Cinema / Multiplex In-Seat Delivery** (`apps/cinema-web` on Port `3001`):
   - Auditorium in-seat QR ordering for multiplexes and theatres.
   - Concession kitchen display system (KDS) for snack preparation.
   - Stealth seat-delivery runner dispatch PWA.
   - Cinema Admin (screens, auditorium layout, seat mapping, showtimes, concessions, custom payment gateways).

3. **🌐 Main Platform & Super Admin** (`apps/main-web` on Port `3002`):
   - High-converting marketing landing page & product showcase.
   - Business vertical selection (Restaurant vs Cinema).
   - Platform-wide Super Admin control console.

4. **⚙️ Backend API Engine** (`apps/api` on Port `5001`):
   - Express 5 + TypeScript REST API.
   - Socket.io WebSocket server for real-time order streams and ticket updates.
   - Better Auth integration (email/password, sessions, Google OAuth).
   - Dual-database routing engine (`restaurantDb` vs `cinemaDb`).
   - Cloudflare R2 presigned image upload endpoints.
   - Payment gateway webhook handlers (Razorpay & Paytm).

---

## 2. Prerequisites

Make sure you have the following installed on your machine:

- **Node.js**: `v20.x` or `v22.x` LTS ([Download Node.js](https://nodejs.org/))
- **npm**: `v10.x` or higher (bundled with Node)
- **Git**: Latest version
- **Database**:
  - We use **[Neon Serverless PostgreSQL](https://neon.tech)** for both production and development.
  - Ask the team lead for team dev database credentials, or create a free project at [Neon](https://console.neon.tech).
- **Optional / Recommended**:
  - VS Code with extensions: ESLint, Prettier, Tailwind CSS IntelliSense, Thunder Client / Postman.

---

## 3. Step-by-Step Setup

### Step 1: Clone & Install Dependencies

Clone the repository and install all npm dependencies from the root directory:

```bash
git clone https://github.com/NavaneethNN/menugoV1.git
cd menugo-V1

# Install monorepo dependencies (npm workspaces)
npm install
```

---

### Step 2: Environment Variables

The project uses `.env` in the root (for the backend API and database migrations) and `.env.local` files inside each Next.js app.

1. **Root & API Environment:**
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. **Configure Database Connection in `.env`:**
   You can either use a single database connection string for both verticals or two separate database connection strings (Dual-DB Architecture):
   ```env
   # Option A: Shared database for local development
   DATABASE_URL="postgresql://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/menugo?sslmode=require"

   # Option B: Dedicated database URLs (Recommended for dual-db parity)
   RESTAURANT_DATABASE_URL="postgresql://user:password@ep-rest-pooler.us-east-2.aws.neon.tech/restaurant_db?sslmode=require"
   CINEMA_DATABASE_URL="postgresql://user:password@ep-cine-pooler.us-east-2.aws.neon.tech/cinema_db?sslmode=require"

   # Better Auth Secret (generate a random 32-char string: openssl rand -base64 32)
   BETTER_AUTH_SECRET="your-32-character-random-secret-key-goes-here"
   BETTER_AUTH_URL="http://localhost:5001"

   # Server Port
   PORT="5001"
   API_URL="http://localhost:5001"
   NEXT_PUBLIC_API_URL="http://localhost:5001"
   ```

3. **Web Apps Environment Files:**
   Check that each web app has its `.env.local` configured. Example files are provided in each app:
   - `apps/restaurant-web/.env.local`:
     ```env
     PORT=5001
     API_URL="http://localhost:5001"
     NEXT_PUBLIC_API_URL="http://localhost:5001"
     NEXT_PUBLIC_APP_URL="http://localhost:3000"
     NEXT_PUBLIC_CINEMA_URL="http://localhost:3001"
     NEXT_PUBLIC_MAIN_URL="http://localhost:3002"
     BETTER_AUTH_SECRET="your-32-character-random-secret-key-goes-here"
     BETTER_AUTH_URL="http://localhost:5001"
     ```
   - `apps/cinema-web/.env.local`:
     ```env
     NEXT_PUBLIC_API_URL="http://localhost:5001"
     NEXT_PUBLIC_APP_URL="http://localhost:3001"
     NEXT_PUBLIC_RESTAURANT_URL="http://localhost:3000"
     NEXT_PUBLIC_MAIN_URL="http://localhost:3002"
     ```
   - `apps/main-web/.env.local`:
     ```env
     NEXT_PUBLIC_API_URL="http://localhost:5001"
     NEXT_PUBLIC_APP_URL="http://localhost:3002"
     NEXT_PUBLIC_RESTAURANT_URL="http://localhost:3000"
     NEXT_PUBLIC_CINEMA_URL="http://localhost:3001"
     ```

> [!TIP]
> For a full list of all supported environment variables (Cloudflare R2, Google OAuth, Payment encryption, etc.), read [docs/ENV_VARS.md](file:///Users/navaneeth/Documents/Projects/menugo-V1/docs/ENV_VARS.md).

---

### Step 3: Database Provisioning & Schema Sync

Sync the Drizzle ORM schema to your Neon database instance:

```bash
# Push schema directly to the database
npm run db:push

# (Alternative) If using migration files
npm run db:migrate
```

To view or manage tables in a visual web interface:
```bash
npm run db:studio
```

---

### Step 4: Seed Sample Data

To populate sample cinema data (screens, auditoriums, concessions, and demo theatres):

```bash
npx tsx scripts/seed-cinema.ts
```

---

### Step 5: Start Development Servers

You can start all 4 services concurrently in one terminal:

```bash
npm run dev
```

This runs `concurrently` with color-coded log prefixes:
- `[API]` (Blue) — Express Backend on port `5001`
- `[REST]` (Green) — Restaurant Web on port `3000`
- `[CINEMA]` (Magenta) — Cinema Web on port `3001`
- `[MAIN]` (Cyan) — Main Platform Landing on port `3002`

If you only want to work on a specific part of the system, run individual commands:

```bash
# Backend API only
npm run dev:api

# Restaurant Web only
npm run dev:restaurant

# Cinema Web only
npm run dev:cinema

# Main Landing only
npm run dev:main
```

---

## 4. Services, Ports & URLs Reference

Once running, you can access the following interfaces:

| Service | Port | Direct URL | Description & Key Pages |
|---|---|---|---|
| **Main Landing** | `3002` | [http://localhost:3002](http://localhost:3002) | Platform marketing page, business selector, Super Admin (`/super-admin`) |
| **Restaurant Web** | `3000` | [http://localhost:3000](http://localhost:3000) | Restaurant landing page |
| **Restaurant Admin** | `3000` | [http://localhost:3000/admin/login](http://localhost:3000/admin/login) | Owner/Admin login & management dashboard |
| **Restaurant KDS** | `3000` | [http://localhost:3000/kitchen](http://localhost:3000/kitchen) | Kitchen Display System with live socket chimes |
| **Restaurant Cashier** | `3000` | [http://localhost:3000/admin/cashier](http://localhost:3000/admin/cashier) | Table status, billing overview, payment settlement |
| **Customer Menu Demo** | `3000` | [http://localhost:3000/menu/demo-cafe](http://localhost:3000/menu/demo-cafe) | QR mobile dine-in menu & cart |
| **Cinema Web** | `3001` | [http://localhost:3001](http://localhost:3001) | Cinema landing page |
| **Cinema Admin** | `3001` | [http://localhost:3001/cinema/login](http://localhost:3001/cinema/login) | Theatre manager portal (screens, shows, menu) |
| **Cinema Kitchen KDS** | `3001` | [http://localhost:3001/cinema/kitchen](http://localhost:3001/cinema/kitchen) | Concessions food prep screen |
| **Seat Delivery PWA** | `3001` | [http://localhost:3001/cinema/delivery](http://localhost:3001/cinema/delivery) | Runner dispatch interface for seat delivery |
| **Backend API Health** | `5001` | [http://localhost:5001/api/health](http://localhost:5001/api/health) | API health check & DB connection probe |

---

## 5. Key Verification Checks

Verify your setup by running the automated check scripts:

```bash
# 1. TypeScript compilation check across all packages & apps
npm run typecheck

# 2. Deployment smoke test (checks API and database connectivity)
npm run smoke

# 3. Unit and integration tests
npm test
```

If `npm run typecheck` and `npm run smoke` exit with code `0`, your setup is 100% healthy and ready for active feature development!

---

## 6. First Day Troubleshooting & FAQs

### Q: `drizzle-kit push` fails with SSL error
**Fix:** Ensure your Neon connection string includes `?sslmode=require`. In Neon, serverless connections must use SSL. Also ensure your host URL contains `-pooler` (e.g. `ep-xyz-pooler.us-east-2.aws.neon.tech`).

### Q: Ports 3000, 3001, 3002, or 5001 are already in use
**Fix:** Run `lsof -i :3000` (or the relevant port) and kill the stale process:
```bash
kill -9 $(lsof -t -i :5001)
kill -9 $(lsof -t -i :3000)
```

### Q: Next.js cached stale builds or hydration errors
**Fix:** Clean Next.js build caches across all apps:
```bash
npm run clean
```

### Q: WebSocket not connecting or real-time orders not updating
**Fix:** Verify that `NEXT_PUBLIC_API_URL` is set to `http://localhost:5001` in the relevant `.env.local`. Check your browser DevTools Network tab for a WebSocket connection to `ws://localhost:5001/socket.io/`.

---

## 7. Next Steps: Picking Up Your First Task

Now that your environment is running, check out:

1. 📖 **[docs/ARCHITECTURE.md](file:///Users/navaneeth/Documents/Projects/menugo-V1/docs/ARCHITECTURE.md)** — Learn how the backend, dual databases, and real-time sockets work together.
2. 📖 **[docs/API_REFERENCE.md](file:///Users/navaneeth/Documents/Projects/menugo-V1/docs/API_REFERENCE.md)** — Comprehensive guide to endpoints and WebSocket events.
3. 📖 **[docs/CONTRIBUTING.md](file:///Users/navaneeth/Documents/Projects/menugo-V1/docs/CONTRIBUTING.md)** — Git workflow, branch guidelines, and commit standards.
4. 🎯 **Launch Issues Audits**:
   - [apps/restaurant-web/V1_LAUNCH_ISSUES.md](file:///Users/navaneeth/Documents/Projects/menugo-V1/apps/restaurant-web/V1_LAUNCH_ISSUES.md)
   - [apps/cinema-web/V1_LAUNCH_ISSUES.md](file:///Users/navaneeth/Documents/Projects/menugo-V1/apps/cinema-web/V1_LAUNCH_ISSUES.md)

These audit files outline the blockers (🔴) and major tasks (🟠) queued for the upcoming V1 release. Pick a task, branch out from `main`, and feel free to ask questions in the team channel! Happy coding! 🚀
