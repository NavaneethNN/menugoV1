# MenuGo V1.0 – Multi-Restaurant QR Ordering SaaS Platform

MenuGo is a cloud-based, multi-tenant QR ordering platform designed for small and medium restaurants, cafés, and food courts. Customers scan a table QR code, browse a responsive digital menu, and place orders without installing an app. Restaurant staff and kitchen manage orders in real-time through a live web dashboard with WebSockets.

---

## 🏗️ Project Architecture

```
menugo/
├── apps/
│   ├── web/                     # Next.js 14 App Router Frontend (Tailwind CSS, shadcn-style UI)
│   │   ├── src/app/
│   │   │   ├── page.tsx         # Platform landing page
│   │   │   ├── admin/           # Restaurant admin authentication & management
│   │   │   ├── kitchen/         # Live Kitchen Display System (KDS) with sound alerts
│   │   │   └── menu/[slug]/[table]/ # Zero-app customer digital menu & cart
│   │   └── src/lib/             # Auth client, API client, Socket.io client
│   └── api/                     # Express 5 + TypeScript Backend
│       ├── src/lib/             # Better Auth configuration, Socket.io server
│       ├── src/middleware/      # Tenant isolation middleware, Auth verification
│       └── src/routes/          # Restaurants, Categories, Products, Tables & QR, Orders
├── packages/
│   ├── database/                # Drizzle ORM + Neon PostgreSQL schema & migrations
│   └── shared/                  # Shared Zod schemas, constants, and TypeScript types
├── package.json                 # Monorepo root workspace configuration
└── README.md
```

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14, React 18, Tailwind CSS |
| **Backend** | Express 5, TypeScript, Node.js |
| **Database** | Neon PostgreSQL |
| **ORM** | Drizzle ORM & Drizzle Kit |
| **Authentication** | Better Auth (Email & Password, Sessions) |
| **Validation** | Zod (End-to-end typed contracts) |
| **Realtime** | Socket.io (WebSocket event stream for KDS & order tracker) |
| **QR Generation** | `qrcode` (Per-table QR code Data URLs and target URLs) |
| **Image Storage** | Cloudinary |

---

## 📦 Database Tables (8 Core Tables + Better Auth)

All restaurant-owned records are strictly isolated using `restaurant_id`:

1. `restaurants` — Restaurant identity, slug, address, phone, settings, currency
2. `users` / `user` — User accounts (Better Auth compatible)
3. `restaurant_members` — Multi-tenant role memberships (`owner`, `admin`, `staff`, `kitchen`)
4. `categories` — Menu categories isolated by `restaurant_id`
5. `products` — Dishes/items with prices, descriptions, vegetarian flags, availability
6. `restaurant_tables` — Tables with table numbers, capacity, and generated QR code payloads
7. `orders` — Customer orders with status workflow (`pending` → `accepted` → `preparing` → `ready` → `served`)
8. `order_items` — Snapshot of product line items with quantities, prices, and notes
9. `session`, `account`, `verification` — Better Auth session tables

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ (Node 20 or 22 recommended)
- Neon PostgreSQL database instance (or any PostgreSQL connection string)

### 2. Environment Setup
Copy `.env.example` to `.env` in the root (and configured in apps):
```bash
cp .env.example .env
```

Configure your PostgreSQL connection string in `.env`:
```env
DATABASE_URL="postgresql://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/menugo?sslmode=require"
BETTER_AUTH_SECRET="your-super-secret-random-32-char-string"
BETTER_AUTH_URL="http://localhost:5000"
PORT=5000
API_URL="http://localhost:5000"
NEXT_PUBLIC_API_URL="http://localhost:5000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Install Dependencies
Run from the root directory:
```bash
npm install
```

### 4. Database Schema Migration
Generate and push database schema to Neon:
```bash
# Push schema directly to Neon DB
npm run db:push

# Or generate SQL migrations
npm run db:generate
```

### 5. Start Development Servers
Start both the Next.js frontend and Express API concurrently:
```bash
npm run dev
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **API Server**: [http://localhost:5000](http://localhost:5000)
- **API Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)
- **Admin Portal**: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)
- **Kitchen Display System**: [http://localhost:3000/kitchen](http://localhost:3000/kitchen)
- **Customer QR Demo**: [http://localhost:3000/menu/demo-cafe/T-1](http://localhost:3000/menu/demo-cafe/T-1)

---

## 📅 10-Day MVP Roadmap

- **Day 1**: ✅ Monorepo setup, Drizzle ORM schema, Better Auth integration, Express 5 API skeleton, Next.js frontend foundation
- **Day 2**: Restaurant Admin & Menu CRUD (categories, food items, image uploads)
- **Day 3**: Customer Digital Menu (mobile UI, dietary tags, category browsing)
- **Day 4**: Shopping Cart & Order Placement (quantity selection, special notes)
- **Day 5**: Backend Order Management (database transactions, price validation)
- **Day 6**: Kitchen Dashboard & Realtime Updates (WebSocket events, sound chimes, state transitions)
- **Day 7**: Table Management & QR Code Generation (per-table QR generation & download)
- **Day 8**: Integration & End-to-End Testing
- **Day 9**: Cloud Deployment (Vercel & Neon Cloud)
- **Day 10**: Pilot Restaurant Testing & Polish

