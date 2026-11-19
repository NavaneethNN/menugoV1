# QROS (formerly MenuGo) — Enterprise Multi-Tenant QR Hospitality & Entertainment Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-5.0-lightgrey.svg)](https://expressjs.com/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle%20ORM-0.45-green.svg)](https://orm.drizzle.team/)
[![Neon Database](https://img.shields.io/badge/Neon-PostgreSQL-00E599.svg)](https://neon.tech/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-white.svg)](https://socket.io/)

**QROS** is a cloud-native, multi-tenant QR ordering, kitchen display, cashier, and operations SaaS platform designed for restaurants, cafés, food courts, and cinema multiplexes. Customers order instantly by scanning table or seat QR codes without installing an app, while kitchen staff, floor waiters, delivery runners, and managers coordinate orders in real-time through WebSocket-powered live dashboards.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Clients["Clients & Edge Devices"]
        RestCust["🍽️ Restaurant Customer<br/>(Mobile Table QR)"]
        CinemaCust["🎬 Cinema Customer<br/>(Mobile Seat QR)"]
        RestStaff["👨‍🍳 Restaurant Staff / KDS / Cashier<br/>(Tablet / POS)"]
        CinemaStaff["🏃 Cinema Kitchen & Delivery Runners<br/>(KDS & Seat Delivery PWA)"]
        SuperAdmin["🛡️ Platform Super Admin<br/>(Desktop Web)"]
    end

    subgraph Frontends["Frontend Applications (Next.js 14 App Router)"]
        MainApp["🌐 apps/main-web (Port 3002)<br/>Platform Landing & Super Admin"]
        RestApp["🍽️ apps/restaurant-web (Port 3000)<br/>Dine-In Menu, Admin, KDS, Cashier"]
        CinemaApp["🎬 apps/cinema-web (Port 3001)<br/>In-Seat Menu, Admin, KDS, Runner PWA"]
    end

    subgraph BackendAPI["Backend API & Realtime Layer (apps/api - Port 5001)"]
        Express["Express 5 REST API Router"]
        SocketServer["Socket.io Server<br/>(Rooms: restaurant:id, theatre:id)"]
        AuthModule["Better Auth Engine<br/>(Sessions, RBAC & Google OAuth)"]
        DbRouter["Dynamic DB Router (packages/database)<br/>getDb('restaurant' | 'cinema')"]
    end

    subgraph DataStorage["Dual Database Architecture (Neon PostgreSQL)"]
        RestPool["Restaurant DB Pool (-pooler)<br/>RESTAURANT_DATABASE_URL"]
        CinemaPool["Cinema DB Pool (-pooler)<br/>CINEMA_DATABASE_URL"]
    end

    subgraph ExternalServices["External Infrastructure"]
        R2["Cloudflare R2 Object Storage<br/>(Dish photos, logos)"]
        Gateways["Payment Gateways<br/>(Razorpay & Paytm S2S Webhooks)"]
    end

    RestCust -->|HTTP / QR| RestApp
    RestStaff -->|HTTP & Sockets| RestApp
    CinemaCust -->|HTTP / QR| CinemaApp
    CinemaStaff -->|HTTP & Sockets| CinemaApp
    SuperAdmin -->|HTTP| MainApp

    MainApp -->|REST API| Express
    RestApp -->|REST API & Sockets| Express
    CinemaApp -->|REST API & Sockets| Express

    Express --> AuthModule
    Express --> DbRouter
    DbRouter -->|Queries| RestPool
    DbRouter -->|Queries| CinemaPool

    Express -->|Presigned URLs| R2
    Gateways -->|POST Webhooks| Express
```

---

## 📦 Monorepo Workspace Structure

```
menugo-V1/
├── apps/
│   ├── api/                     # Express 5 REST API & Socket.io real-time engine (Port 5001)
│   ├── restaurant-web/          # Next.js 14 Dine-In Web App (Port 3000)
│   ├── cinema-web/              # Next.js 14 Cinema & Theatre Concessions Web App (Port 3001)
│   └── main-web/                # Next.js 14 Platform Landing & Super Admin Portal (Port 3002)
├── packages/
│   ├── database/                # Drizzle ORM schema, Neon connection pools & migrations
│   └── shared/                  # Shared Zod validation schemas, TypeScript interfaces & types
├── docs/                        # Complete technical guides & documentation
│   ├── ONBOARDING.md            # 15-minute new developer setup guide
│   ├── ARCHITECTURE.md          # In-depth architectural & multi-tenancy documentation
│   ├── ENV_VARS.md              # Environment variables reference for all apps
│   ├── API_REFERENCE.md         # REST API endpoints & WebSocket event catalog
│   └── CONTRIBUTING.md          # Git workflow, commit conventions & PR guidelines
├── scripts/                     # Seed scripts, smoke tests & maintenance utilities
├── e2e/                         # Playwright end-to-end integration test suites
├── package.json                 # Monorepo root workspace configuration
└── README.md                    # Primary repository overview
```

---

## 🌐 Services, Ports & URLs

When running locally, the following services are available:

| Application | Workspace | Port | Local URL | Primary Roles & Features |
|---|---|---|---|---|
| **Main Web & Super Admin** | `@menugo/main-web` | `3002` | [http://localhost:3002](http://localhost:3002) | Marketing landing, vertical selector, Super Admin (`/super-admin`) |
| **Restaurant Web** | `@menugo/restaurant-web` | `3000` | [http://localhost:3000](http://localhost:3000) | Restaurant Admin (`/admin`), Kitchen KDS (`/kitchen`), Cashier (`/admin/cashier`), Customer Menu (`/menu/[slug]`) |
| **Cinema Web** | `@menugo/cinema-web` | `3001` | [http://localhost:3001](http://localhost:3001) | Cinema Admin (`/cinema/admin`), Cinema Kitchen KDS (`/cinema/kitchen`), Runner Dispatch (`/cinema/delivery`), In-Seat Menu (`/cinema/[slug]`) |
| **Backend API Server** | `@menugo/api` | `5001` | [http://localhost:5001](http://localhost:5001) | Express REST API, WebSockets, Better Auth, Webhooks, Health Check (`/api/health`) |

---

## 🛠️ Technology Stack

| Domain | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | Next.js 14 (App Router), React 18, Tailwind CSS | High-performance responsive interfaces, SSR, and client components |
| **Backend Framework** | Express 5, TypeScript, Node.js | Scalable, typed REST API services and routing |
| **Database** | Neon Serverless PostgreSQL | Serverless PostgreSQL with connection pooling (`-pooler`) |
| **Database ORM** | Drizzle ORM & Drizzle Kit | Type-safe SQL query builder, automatic schema migrations |
| **Authentication** | Better Auth | Session-based authentication, cookies, Google OAuth 2.0, RBAC |
| **Staff Auth** | Staff PIN System | Fast 4-to-6 digit PIN login for floor waiters, cooks, and runners |
| **Data Validation** | Zod | End-to-end type validation across API boundaries and client forms |
| **Realtime Engine** | Socket.io 4.8 | Bidirectional event streams for live KDS tickets and order status |
| **Object Storage** | Cloudflare R2 | Direct browser presigned uploads for dish photos and logos without egress fees |
| **Payments & Crypto** | Razorpay & Paytm, AES-256-GCM | Encrypted merchant payment gateway integration with S2S webhooks |

---

## 🚀 Quickstart Guide for New Developers

> [!TIP]
> For a detailed walkthrough with troubleshooting and screenshots, read **[docs/ONBOARDING.md](file:///Users/navaneeth/Documents/Projects/menugo-V1/docs/ONBOARDING.md)**.

### 1. Prerequisites
- **Node.js**: `v20.x` or `v22.x` LTS
- **npm**: `v10.x` or higher
- **Neon PostgreSQL**: Connection string with `-pooler` in host

### 2. Install Dependencies
```bash
git clone https://github.com/NavaneethNN/menugoV1.git
cd menugo-V1
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your database URL and a random 32-character secret:
```env
DATABASE_URL="postgresql://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/menugo?sslmode=require"
BETTER_AUTH_SECRET="replace-with-a-secure-random-32-char-secret"
BETTER_AUTH_URL="http://localhost:5001"
PORT="5001"
API_URL="http://localhost:5001"
NEXT_PUBLIC_API_URL="http://localhost:5001"
```

### 4. Push Schema to Database
```bash
# Push Drizzle schema to Neon PostgreSQL
npm run db:push

# (Optional) Seed sample cinema and theatre records
npx tsx scripts/seed-cinema.ts
```

### 5. Start Development Servers
Start all 4 services concurrently in one command:
```bash
npm run dev
```

Your servers will boot simultaneously:
- **Main Portal**: [http://localhost:3002](http://localhost:3002)
- **Restaurant Web**: [http://localhost:3000](http://localhost:3000)
- **Cinema Web**: [http://localhost:3001](http://localhost:3001)
- **Backend API**: [http://localhost:5001](http://localhost:5001)

---

## 📜 Available NPM Scripts

Run from the root directory:

```bash
# Development
npm run dev               # Start all 4 services concurrently (API, Restaurant, Cinema, Main)
npm run dev:api           # Start Express API server only (Port 5001)
npm run dev:restaurant    # Start Restaurant Next.js app only (Port 3000)
npm run dev:cinema        # Start Cinema Next.js app only (Port 3001)
npm run dev:main          # Start Main platform landing only (Port 3002)

# Production Builds
npm run build             # Build all workspaces
npm run build:restaurant  # Build Restaurant Web
npm run build:cinema      # Build Cinema Web
npm run build:main        # Build Main Web

# Quality & Testing
npm run typecheck         # Run TypeScript checks across all workspaces
npm test                  # Run full automated test suite
npm run smoke             # Run deployment smoke test against DB & API
npm run clean             # Clear .next build caches across all web apps

# Database Operations
npm run db:push           # Push Drizzle schema changes directly to Neon DB
npm run db:generate       # Generate SQL migration files
npm run db:migrate        # Execute pending SQL migrations
npm run db:studio         # Launch Drizzle Studio web GUI for inspecting records
```

---

## 📚 In-Depth Documentation Index

Explore our comprehensive documentation in the `docs/` folder:

| Document | Description |
|---|---|
| 📖 **[docs/ONBOARDING.md](file:///Users/navaneeth/Documents/Projects/menugo-V1/docs/ONBOARDING.md)** | Step-by-step developer setup guide, FAQs, and first-day checklist |
| 🏛️ **[docs/ARCHITECTURE.md](file:///Users/navaneeth/Documents/Projects/menugo-V1/docs/ARCHITECTURE.md)** | Technical deep-dive on dual-database isolation, RBAC, WebSockets, and state machines |
| ⚙️ **[docs/ENV_VARS.md](file:///Users/navaneeth/Documents/Projects/menugo-V1/docs/ENV_VARS.md)** | Complete environment variable specification for root and all applications |
| 📡 **[docs/API_REFERENCE.md](file:///Users/navaneeth/Documents/Projects/menugo-V1/docs/API_REFERENCE.md)** | REST API endpoints, authentication flows, error codes, and WebSocket events |
| 🤝 **[docs/CONTRIBUTING.md](file:///Users/navaneeth/Documents/Projects/menugo-V1/docs/CONTRIBUTING.md)** | Git branching model, commit conventions (Conventional Commits), and PR checklist |
| 🚀 **[DEPLOYMENT.md](file:///Users/navaneeth/Documents/Projects/menugo-V1/DEPLOYMENT.md)** | Production deployment guide for Vercel, Railway, Cloudflare R2, and Neon |

---

## 🎯 V1 Launch Roadmap & Known Issues

Before deploying V1 to production, review the codebase audits and task lists:
- 🍽️ **[apps/restaurant-web/V1_LAUNCH_ISSUES.md](file:///Users/navaneeth/Documents/Projects/menugo-V1/apps/restaurant-web/V1_LAUNCH_ISSUES.md)** — Audit of Restaurant Web blockers and major tasks.
- 🎬 **[apps/cinema-web/V1_LAUNCH_ISSUES.md](file:///Users/navaneeth/Documents/Projects/menugo-V1/apps/cinema-web/V1_LAUNCH_ISSUES.md)** — Audit of Cinema Web blockers and major tasks.

Key items queued for release include eliminating mock payment fallbacks, real socket wiring for service requests, password reset workflows, and persistent admin navigation shells.

---

## 📄 License & Maintainers

Maintained by the QROS Core Engineering Team. Confidential & proprietary software.
