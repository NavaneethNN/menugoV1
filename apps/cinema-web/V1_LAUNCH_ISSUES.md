# The QROS Cinema Web — V1 Launch Issues & Pending Fixes

> Last scanned: **2026-11-19**  
> Scope: `apps/cinema-web/src` — full codebase audit  
> Status: 🔴 Blocker · 🟠 Major · 🟡 Minor · 🟢 Enhancement

---

## 🔴 BLOCKERS — Must Fix Before Launch

### B-01 · Customer Concessions Checkout contains hardcoded mock payment fallback
**File:** `src/components/cinema/CinemaOrderPreparedModal.tsx` (lines 264–295)  
**Issue:** If the payment gateway modal encounters an error or falls back, `handleCompletePayment` injects `mock_paytm_txn_*`, `mock_pay_*`, or `MOCK_MID` with test signatures (`test_sig_captured`), and verifies them directly against the backend. This allows customers to bypass live payment and place confirmed food orders in the auditorium without paying.  
**Fix required:** Remove all mock payment branches and test signatures from customer-facing checkout. Gateway errors should display a user-friendly failure screen with a retry button.

---

### B-02 · Unused & broken Service Request modal stub present in codebase
**File:** `src/components/menu/ServiceRequestModal.tsx`  
**Issue:** A leftover restaurant "Table Assistance" modal exists in the cinema codebase that only calls `setIsSent(true)` with a timer and has **no API call or socket event**. While currently superseded by the cinema workflow, leftover dead modal components risk being triggered or confusing maintainers.  
**Fix required:** Either remove `ServiceRequestModal.tsx` or wire it to an auditorium in-seat assistance endpoint (`/api/cinema/public/service-requests`) with socket delivery to runners.

---

### B-03 · No "Forgot Password" or Self-Service Password Reset for Staff & Admins
**Files:** `src/app/cinema/login/page.tsx`, `src/app/admin/login/page.tsx`  
**Issue:** Cinema managers and terminal staff have no link or flow to recover forgotten passwords. The login forms only contain email and password fields. If staff forget passwords, they are completely locked out with no recovery path.  
**Fix required:** Add a "Forgot Password?" link on all cinema login screens linking to a reset password request form, backed by better-auth's email reset workflow.

---

### B-04 · Single-device Terminal Lock allows unauthorized terminal switching via `window.confirm`
**File:** `src/app/cinema/login/page.tsx` (lines 136–151)  
**Issue:** The POS terminal locking mechanism relies purely on `localStorage` (`menugo_cinema_terminal_theatre`). Any staff member or guest can click "Switch Theatre" and bypass the lock with a simple browser `window.confirm()` popup, unlocking the device to bind to other theatres.  
**Fix required:** Require theatre manager/admin PIN or re-authentication before clearing or resetting the terminal binding.

---

### B-05 · Seat Delivery audio notification requires explicit user interaction on mobile devices
**File:** `src/app/cinema/delivery/page.tsx` (lines 110–117)  
**Issue:** Modern mobile browsers (iOS Safari, Chrome on Android) block `AudioContext` from playing sounds when an incoming socket order arrives unless the audio context was previously unlocked by a direct user tap. Stealth delivery runners waiting for prepared snacks may miss critical order preparation chimes.  
**Fix required:** Add an initial "Tap to Enable Runner Chimes" banner or button that unlocks the web audio context on user interaction.

---

## 🟠 MAJOR — Important Fixes Required for Reliable Production Operation

### M-01 · Logo upload is Base64 data URL only (no Cloudflare R2 direct upload)
**File:** `src/app/cinema/admin/settings/page.tsx` (lines 109–138)  
**Issue:** In theatre settings, `handleLogoUpload` reads the image into a Base64 data URL via `FileReader.readAsDataURL` and sends the entire mega-byte string to the database payload rather than using pre-signed R2 uploads like the menu page does. This inflates database row size and slows profile loading.  
**Fix required:** Use the same pre-signed R2 upload flow implemented in `src/app/cinema/admin/menu/page.tsx`.

---

### M-02 · Widespread `window.confirm()` dialogs used for critical destructive actions
**Files:**  
- `src/app/cinema/admin/shows/page.tsx` (line 477) — deleting daily shows  
- `src/app/cinema/admin/seating/page.tsx` (line 295) — deleting seating rows  
- `src/app/cinema/admin/screens/page.tsx` (line 231) — archiving auditoriums  
- `src/app/cinema/admin/staff/page.tsx` (lines 246, 267) — removing theatre staff  
- `src/app/cinema/admin/payments/page.tsx` (line 258) — disconnecting gateway credentials  
**Issue:** Browser native `window.confirm()` blocks the JavaScript event loop, cannot be styled, looks broken in embedded webviews/tablets, and lacks safety safeguards (e.g. typing "DELETE").  
**Fix required:** Replace all native confirm popups with a branded `ConfirmationModal` component with custom titles, warning explanations, and confirm buttons.

---

### M-03 · Dual route architecture causes routing confusion and duplicate maintenance
**Files:**  
- `src/app/admin/*` (canonical pages) vs `src/app/cinema/admin/*` (re-exports)  
- `src/app/[theatreToken]/*` vs `src/app/cinema/[theatreToken]/*`  
- `src/app/kitchen` vs `src/app/cinema/kitchen`  
- `src/app/delivery` vs `src/app/cinema/delivery`  
**Issue:** The app has dual sets of URL paths. Next.js router handles both, but having both causes split analytics, duplicate canonical tags, broken relative links, and confusion about the official URL structure.  
**Fix required:** Standardize on `/cinema/*` as the canonical route prefix, and place HTTP 301 redirects in `next.config.mjs` from the legacy `/admin/*` and root routes to `/cinema/*`.

---

### M-04 · Cross-module redirect leaks restaurant dashboard routes
**File:** `src/app/cinema/admin/layout.tsx` (lines 111–143)  
**Issue:** When a restaurant user accidentally logs into the cinema portal, the layout displays "Restaurant account detected" and provides a link to `/admin/dashboard`. But on port 3001 (cinema-web), `/admin/dashboard` is the cinema dashboard, creating an infinite routing loop.  
**Fix required:** Link directly to `process.env.NEXT_PUBLIC_RESTAURANT_URL || 'http://localhost:3000'` instead of a relative `/admin/dashboard` path.

---

### M-05 · Socket singleton lacks cleanup on component unmount
**File:** `src/lib/socket-client.ts`  
**Issue:** The module uses a single shared module-level `socket` variable without cleanup or disconnect handling. Rapid navigation between Kitchen KDS and Seat Delivery causes duplicate listeners to be registered on the same socket instance, leading to duplicate notification chimes.  
**Fix required:** Introduce a `useSocket` React hook that handles subscribing/unsubscribing listeners cleanly in `useEffect` cleanup return functions.

---

### M-06 · Copy Schedule draft feature lacks date validation safeguards
**File:** `src/app/cinema/admin/shows/page.tsx` (lines 450–473)  
**Issue:** When copying a show lineup from one date to another, there is no client-side check preventing the user from copying onto a past date or copying onto a date that already has conflicting published shows.  
**Fix required:** Enforce that target date >= current date, and show a confirmation warning if the target date already has existing shows scheduled.

---

### M-07 · 340+ instances of untyped `any` in cinema admin code
**Files:** Across `src/app/cinema/admin/*` and `src/components/cinema/*`  
**Issue:** Heavy reliance on `(e: any)`, `(m: any)`, `(res: any)` bypasses TypeScript safety, leaving potential runtime crashes when backend API schemas evolve.  
**Fix required:** Import shared DTO types from `@menugo/shared` or define strict interfaces for all cinema API responses.

---

## 🟡 MINOR — Polish & Resilience Fixes

### N-01 · Missing Content Security Policy (CSP) header
**File:** `next.config.mjs`  
**Issue:** Like restaurant-web, `next.config.mjs` defines security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) but lacks a `Content-Security-Policy`.  
**Fix required:** Add CSP header permitting Razorpay (`https://checkout.razorpay.com`), Cloudflare R2 bucket origins, and WebSocket connections (`wss:`).

---

### N-02 · Unused legacy restaurant components cluttering codebase
**Files:**  
- `src/components/menu/CartDrawer.tsx`  
- `src/components/menu/FeaturedDishesSlider.tsx`  
- `src/components/menu/OrderConfirmModal.tsx`  
- `src/components/menu/OrderSuccessModal.tsx`  
**Issue:** These components are legacy restaurant components that are never imported or used by any cinema routes (cinema uses `CinemaCartDrawer.tsx` and `CinemaOrderPreparedModal.tsx`).  
**Fix required:** Safely delete these unreferenced files to avoid confusion and reduce bundle audit surface.

---

### N-03 · High volume of leftover `console.error` and `console.warn` statements
**Files:** 60+ instances across admin pages (`movies/page.tsx`, `shows/page.tsx`, `orders/page.tsx`, `reports/page.tsx`)  
**Issue:** API catch blocks print raw errors directly to the browser dev tools, which can expose API endpoints and internal query parameters.  
**Fix required:** Replace raw `console.error` with a structured client logger or Sentry error capture utility that stays silent in production.

---

### N-04 · Concessions category seeding overwrites custom items without backup
**File:** `src/app/cinema/admin/menu/page.tsx` (lines 195–215)  
**Issue:** Clicking "Seed Concessions Categories" imports standard movie snacks (Popcorn, Nachos, Beverages, Candies). If a cinema already defined custom categories, the UI does not warn the manager that existing categories might be modified or duplicated.  
**Fix required:** Show a confirmation modal explaining the default items that will be appended.

---

### N-05 · Customer ordering view auto-refreshes cart every render
**File:** `src/components/cinema/CustomerCinemaOrderingView.tsx` (lines 280–298)  
**Issue:** The `useEffect` that synchronizes cart state to `localStorage` executes on every state change of `cartItems`, `customerName`, and `customerPhone`. On slower mobile devices, this causes micro-stutters during rapid tapping of +/- buttons.  
**Fix required:** Debounce `localStorage` synchronization or update on drawer close / quantity commit.

---

## 🟢 ENHANCEMENTS — Post-Launch Improvements

| ID | Module | Enhancement Description |
|---|---|---|
| E-01 | Customer Menu | Add "Interval Delivery" vs "Immediate Delivery" selection so guests can schedule snacks for intermission |
| E-02 | Seating Layout | Add visual 2D interactive auditorium seat grid with color-coded seat tiers (Recliner, VIP, Standard) |
| E-03 | Kitchen KDS | Add preparation timer countdown with visual color progression (Green -> Yellow -> Red alert) |
| E-04 | Runner Delivery | Add QR scan confirmation where runner scans the seat armrest QR to confirm delivery completion |
| E-05 | Reports | Add Concession-Per-Head (SPH / Spend Per Head) cinema industry metric calculations |
| E-06 | Sound FX | Add custom discreet bell sounds for in-seat delivery staff to prevent movie disturbance |
| E-07 | PWA | Add web manifest installation prompts for staff tablets at concession counters |
| E-08 | Inventory | Add real-time stock quantity decrementing for concession combos and canned drinks |

---

## 📋 Environment Variables Checklist

| Variable | Current `.env.local` | Production Value Needed | Verified |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5001` | `https://api.yourdomain.com` | ⚠️ Needs Update |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3001` | `https://cinema.yourdomain.com` | ⚠️ Needs Update |
| `NEXT_PUBLIC_MAIN_URL` | `http://localhost:3002` | `https://yourdomain.com` | ⚠️ Needs Update |
| `NEXT_PUBLIC_RESTAURANT_URL` | `http://localhost:3000` | `https://restaurant.yourdomain.com` | ⚠️ Needs Update |

---

## 🚀 Pre-Launch Gate Checklist

- [ ] All 5 Blockers (B-01 through B-05) resolved & tested
- [ ] Mock checkout payment fallback completely purged
- [ ] Forgot password flow wired for theatre managers and staff
- [ ] Cloudflare R2 direct logo upload implemented
- [ ] Dangerous `window.confirm()` calls converted to custom modals
- [ ] Route canonicalization to `/cinema/*` configured with 301 redirects
- [ ] Audio chime activation banner added to Seat Delivery runner view
- [ ] Production `.env.local` configured with HTTPS endpoints
