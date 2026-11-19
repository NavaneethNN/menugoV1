# The QROS Restaurant Web — V1 Launch Issues & Pending Fixes

> Last scanned: **2026-11-19**  
> Scope: `apps/restaurant-web/src` — full codebase audit  
> Status: 🔴 Blocker · 🟠 Major · 🟡 Minor · 🟢 Enhancement

---

## 🔴 BLOCKERS — Must Fix Before Launch

### B-01 · Service Request Modal is a UI-only stub (no real API call)
**File:** `src/components/menu/ServiceRequestModal.tsx`  
**Issue:** When a customer taps "Call Waiter / Request Bill / Water / Cutlery", `handleSubmit` only calls `setIsSent(true)` with a timer — it **never sends any request to the backend**. Staff are never notified. This is a critical feature presented as working.  
**Fix required:** Implement `apiRequest('/api/service-requests', { method: 'POST', ... })` with the selected service type and table info, and wire socket.io push to floor staff.

---

### B-02 · Billing page has a mock payment fallback that runs in production
**File:** `src/app/admin/billing/page.tsx` (lines 134–151)  
**Issue:** When the Razorpay SDK fails to load (blocked CDN, slow network), the code **automatically sends a fake `pay_mock_*` payment ID** to the backend verify endpoint. This would fraudulently activate subscriptions without real payment.  
**Fix required:** Remove the mock payment fallback entirely. When SDK fails to load, show an error message: "Payment gateway unavailable. Please retry or contact support." Never silently fake a payment.

---

### B-03 · Admin forgot/reset password flow is missing for owner/admin accounts
**File:** `src/app/admin/login/page.tsx`  
**Issue:** The login page has no "Forgot Password" link. If a restaurant owner/admin forgets their email password, they have no self-serve recovery path. The only reset path in the codebase is for staff PIN accounts (admin-initiated).  
**Fix required:** Add a "Forgot password?" link on the sign-in form that calls `better-auth`'s `forgotPassword` API and sends a reset email.

---

### B-04 · Logo/cover image upload in onboarding & profile uses URL input, not file upload
**Files:** `src/components/RestaurantOnboardingForm.tsx`, `src/components/RestaurantProfileModal.tsx`  
**Issue:** Restaurants must paste an external URL for their logo. There is no direct file upload to the Cloudflare R2 bucket (which is already configured in `.env.local`). Most restaurant owners will not have a hosted image URL ready.  
**Fix required:** Add an image file input that uploads to `/api/upload/image` (R2 bucket), returns a public URL, and auto-fills the logo field. The Products page already implements this correctly (`UploadCloud` icon, `uploadingImage` state) — apply the same pattern here.

---

### B-05 · `browser.confirm()` dialogs used for destructive staff actions
**File:** `src/app/admin/staff/page.tsx` (lines 319, 380)  
**Issue:** "Reset Password" and "Remove Member" actions use the native `window.confirm()` dialog. This is visually inconsistent, unstyled, and can be accidentally dismissed. It also fails in certain environments and is an anti-pattern for a production SaaS.  
**Fix required:** Replace both `confirm()` calls with styled inline confirmation modals (consistent with the existing Delete Confirmation Modal pattern used in categories/products pages).

---

### B-06 · Public menu page's table session key uses old "menugo" localStorage namespace
**File:** `src/app/menu/[restaurantSlug]/page.tsx` (line ~261)  
**Issue:** `sessionKey` is stored as `` `menugo_session_${restaurantSlug}_${token}` `` and cart as `` `menugo_cart_${restaurantSlug}` `` — both use the old `menugo` prefix while the product is now branded "The QROS". On rebranding/domain change, existing customer sessions will be orphaned.  
**Fix required:** Update localStorage key prefix to `qros_` or a brand-neutral constant. Since this is pre-launch, it's safe to change now.

---

## 🟠 MAJOR ISSUES — High Priority

### M-01 · No shared admin sidebar/navigation — each page is a standalone island
**Files:** All `src/app/admin/*/page.tsx`  
**Issue:** Every admin sub-page (Products, Categories, Tables, Staff, Orders, Cashier, Service) independently re-fetches the restaurant list and re-builds its own minimal top-nav. There is **no persistent sidebar layout**. Navigation between sections requires going back to dashboard. Admin UX is fragmented and each page does 1-2 redundant API calls on load.  
**Fix required:** Create a shared `AdminShell` layout component (or use the Next.js layout system under `/admin`) with a persistent sidebar containing all navigation links, the restaurant switcher, and the user menu. All admin pages should render inside this shell.

---

### M-02 · `any` type used extensively across admin pages — no TypeScript safety
**Files:** All `src/app/admin/*/page.tsx`  
**Issue:** `useState<any[]>([])` is used for restaurants, memberships, subscriptions, and API responses throughout. This masks type errors and makes refactoring unsafe.  
**Fix required:** Define proper TypeScript interfaces for `RestaurantMembership`, `SubscriptionStatus`, and `UserSession`. The pattern is already established in `order-history.ts`, `staff.ts` — extend it to all shared types.

---

### M-03 · Socket.io singleton leaks across pages — no cleanup on unmount
**File:** `src/lib/socket-client.ts`  
**Issue:** `getSocket()` returns a module-level singleton. When a user navigates from Kitchen to Orders, the old socket listeners from the Kitchen page are never cleaned up (the `useEffect` returns do remove them, but the socket itself persists). If the user opens two tabs with different pages, only one socket exists for both — causing missed events.  
**Fix required:** Implement a socket reference counting or per-page connection lifecycle. At minimum, audit all `useEffect` teardowns in kitchen/orders/service/cashier pages to ensure all `.off(eventName, handler)` calls are paired for every `.on()`.

---

### M-04 · Admin dashboard subscription banner shows expired/expiring but features are not gated
**File:** `src/app/admin/dashboard/page.tsx`  
**Issue:** The dashboard shows a subscription expiry warning, but no features are actually locked behind plan limits. Any restaurant can use all features (unlimited tables, unlimited staff, KDS, cashier) regardless of subscription status. This is inconsistent with the billing page that shows plan limits (`maxTables`, `maxStaff`).  
**Fix required:** Decide on the access control strategy. For V1: at minimum, the backend should enforce plan limits. The frontend should check `subscription.isExpired` and show a "Subscription Required" block on the core management pages rather than just the dashboard banner.

---

### M-05 · Staff PIN login doesn't handle multi-restaurant selection properly
**File:** `src/app/staff/login/page.tsx`  
**Issue:** The staff login auto-selects the first restaurant in the list when there is no `?restaurant=` query param. If a staff member works at multiple restaurants (or if the API returns all active restaurants), they might log in to the wrong restaurant without realizing it. The restaurant selector dropdown works but shows the first by default without prompting.  
**Fix required:** If there is more than one restaurant, do not auto-select — force the user to pick explicitly. Add a visual disambiguation step.

---

### M-06 · Restaurant profile modal allows slug change which breaks all existing QR codes
**File:** `src/components/RestaurantProfileModal.tsx`  
**Issue:** The slug field is editable in the profile modal. Changing the slug changes the URL for all QR codes (since they point to `/menu/{slug}`), instantly breaking every printed QR code at every table. There is no warning about this.  
**Fix required:** Either make the slug read-only after creation, or add a prominent destructive-action warning: "Changing your slug will break all existing printed QR codes and require reprinting." Consider adding a modal confirmation step for slug changes.

---

### M-07 · Orders page real-time socket room join uses `selectedRestaurant.id` without verifying role
**File:** `src/app/admin/orders/page.tsx`  
**Issue:** The orders page joins the socket room for the restaurant with `selectedRestaurant.id`. However, there is no frontend check to prevent a `staff` role user (who should only see the KDS/service page) from accessing the full orders management page directly by URL.  
**Fix required:** Add role-based redirect. Staff role should redirect to `/kitchen` or `/admin/service`. Only `owner`, `admin`, and `cashier` should access the orders management page.

---

## 🟡 MINOR ISSUES — Should Fix for V1

### N-01 · `icon.tsx` and `apple-icon.tsx` use "M" lettermark (old MenuGo branding)
**Files:** `src/app/icon.tsx`, `src/app/apple-icon.tsx`, `src/app/global-error.tsx`  
**Issue:** The browser favicon and Apple touch icon render an orange "M" (MenuGo). The brand is now "The QROS." These are the first visual elements users/restaurants see.  
**Fix required:** Update icons to use the QROS logo image (`/qros_logo.png`) or a "Q" lettermark consistent with the new brand.

---

### N-02 · `global-error.tsx` does not import CSS — renders unstyled on critical failure
**File:** `src/app/global-error.tsx`  
**Issue:** The global error boundary renders inside its own `<html>` and `<body>` using inline styles only. This is intentional, but the orange `ea580c` button and "M" avatar logo both reflect old MenuGo branding.  
**Fix required:** Update the brand color and icon to match QROS. The critical error page is what users see on a catastrophic crash — it should be on-brand.

---

### N-03 · OG/Twitter image in metadata points to `qros_logo.png` with wrong dimensions
**File:** `src/app/layout.tsx`  
**Issue:** The OpenGraph image is declared as `width: 2172, height: 724` and points to `/qros_logo.png`. The actual logo PNG should be verified against those declared dimensions — a mismatch causes platforms (WhatsApp, Twitter, Slack) to skip or mangle the preview card.  
**Fix required:** Verify actual logo dimensions and update or create a dedicated OG image (1200×630 recommended) for social sharing.

---

### N-04 · `defaultEnvironment` env fallback for cinema URL uses `localhost:3001`
**File:** `src/app/admin/login/page.tsx` (lines 30, 123)  
**Issue:** `process.env.NEXT_PUBLIC_CINEMA_URL || 'http://localhost:3001'` — if the env var is not set in production, the app silently redirects cinema accounts to localhost, which breaks cross-module routing.  
**Fix required:** Set `NEXT_PUBLIC_CINEMA_URL` to the actual production cinema domain and ensure it is always defined in deployment environment. Add a check that logs a startup warning if it is missing.

---

### N-05 · Public menu page renders for restaurants without a table QR token in "Browse Mode" but order placement is blocked silently
**File:** `src/app/menu/[restaurantSlug]/page.tsx`  
**Issue:** When a user visits `/menu/restaurant-slug` without a `?table=` query param (Browse Mode), the cart works, the "Proceed to Order" button activates — but clicking it fails at the confirmation modal with "Table QR code required." There's no proactive in-menu indicator that ordering won't work without scanning the QR.  
**Fix required:** Add a persistent "Browse Mode" banner at the top explaining "Scan your table QR code to place an order." Disable the cart's "Proceed to Order" button with a tooltip/explanation instead of letting users fill the cart and then hitting a wall.

---

### N-06 · Cashier page receipt print contains no restaurant branding (logo, address)
**File:** `src/app/admin/cashier/page.tsx`  
**Issue:** The bill print view (`handlePrintBill`) opens the browser print dialog with bill data. However, the receipt layout does not include the restaurant's logo, address, phone, or GSTIN. A bare itemized list is not a valid receipt for many business contexts.  
**Fix required:** Add restaurant name, address, phone, and optionally a "Thank You" note to the printable bill. Use `@media print` CSS to format it correctly.

---

### N-07 · QR Code print stand card shows "Powered by The QROS Smart Dining SaaS" — white-label concern
**File:** `src/app/admin/tables/page.tsx`  
**Issue:** The print-ready QR stand template has a hardcoded attribution "Powered by The QROS Smart Dining SaaS." If restaurants want white-label QR cards without branding, there is no option.  
**Fix required:** For V1, this is acceptable, but make it a configurable setting. At minimum, consider making the attribution smaller or footnote-style.

---

### N-08 · Service/Waiter pass page requires admin login but should support PIN-only staff access
**File:** `src/app/admin/service/page.tsx`  
**Issue:** The service pass (food delivery) page at `/admin/service` requires a full session (better-auth). Floor staff (waiter role) uses PIN login (`/staff/login`) which creates a separate session. The integration between PIN session and admin session is unclear — if staff log in via PIN they cannot access `/admin/service` which is behind the admin auth guard.  
**Fix required:** Verify that PIN-authenticated staff can access `/admin/service` and `/kitchen`. If not, implement PIN session authorization for these critical operational pages.

---

### N-09 · Orders page `window.confirm` alternative needed — currently allows empty cancellation reason
**File:** `src/app/admin/orders/page.tsx` (cancellation reason input)  
**Issue:** While a cancellation reason is visually required (`disabled` until non-empty), a reason of a single space character would pass the `.trim()` check. The UI allows very short or meaningless reasons.  
**Fix required:** Add minimum length validation (e.g., `>= 5 characters`) for the cancellation reason field.

---

### N-10 · `how-it-works` and `features` pages exist as standalone routes but redirect to anchors
**Files:** `src/app/how-it-works/page.tsx`, `src/app/features/page.tsx`  
**Issue:** These Next.js page files exist in the filesystem, but `next.config.mjs` redirects them to `/#how-it-works` and `/#features`. The page files themselves are unused dead code.  
**Fix required:** Delete the orphaned page files `src/app/how-it-works/page.tsx` and `src/app/features/page.tsx` to avoid confusion.

---

### N-11 · No `Content-Security-Policy` header configured
**File:** `next.config.mjs`  
**Issue:** The `headers()` config has HSTS, X-Frame-Options, and X-Content-Type-Options — but no `Content-Security-Policy`. With Razorpay's external script, inline styles/scripts on the billing page, and socket.io connections, a missing CSP is a production security gap.  
**Fix required:** Add a CSP header that permits the Razorpay CDN script source, the socket.io backend domain, and the R2 image CDN.

---

### N-12 · `NEXT_PUBLIC_APP_URL` defaults to `menugo.com` in robots/sitemap/metadata
**Files:** `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/layout.tsx`  
**Issue:** Fallback domain is `menugo.com`, the old brand name. If `NEXT_PUBLIC_APP_URL` is not set in production, the sitemap and OG URLs will point to the wrong domain.  
**Fix required:** Update the fallback to the correct production domain (e.g., `theqros.com`) and ensure `NEXT_PUBLIC_APP_URL` is explicitly set in all deployment environments.

---

## 🟢 ENHANCEMENTS — Post-V1 / Nice to Have

### E-01 · Admin dashboard lacks "quick stats" — no order count, revenue, or table occupancy at a glance
The dashboard shows module navigation cards but no live metrics. Adding a small stats bar (today's orders, tables occupied, revenue) would significantly improve the daily operational view.

### E-02 · No push notifications / browser notification permission for Kitchen and Service pages
The KDS and service pass pages play audio chimes (via WebAudio API). Browser push notifications would allow staff to receive alerts even when the browser tab is not in the foreground. Consider implementing Web Push or at minimum `Notification.requestPermission()`.

### E-03 · Product images stored with external URL only — no fallback for broken image URLs
When a product image URL returns 404, the product card shows a broken image placeholder. There is an `imageErrors` state in the menu page but no graceful placeholder UI for the product card itself. A food category icon fallback would improve appearance.

### E-04 · No multi-language / localization support
The entire UI is English-only. For V1 targeting India, Hindi and regional language support would significantly improve usability in many restaurant contexts.

### E-05 · Admin orders page has no bulk action support
Selecting multiple orders and batch-updating their status (e.g., "Accept All New Orders") would greatly speed up high-volume service. Currently each order is updated individually.

### E-06 · No offline/PWA fallback for Kitchen and Service pages
The KDS is a critical operational tool. If the network drops, the page shows a stale data warning but doesn't cache orders locally. A service worker with offline cache would improve reliability in restaurants with unstable WiFi.

### E-07 · Category sort order uses up/down arrow buttons — no drag-and-drop
Reordering many categories via arrow buttons is tedious. Drag-and-drop reordering (e.g., using `@dnd-kit`) would improve the category management UX significantly.

### E-08 · No date range export for orders
The orders page has filters (today, yesterday, 7d, 30d) but no CSV/Excel export of order history. Restaurant owners frequently need this for accounting and reconciliation.

### E-09 · Subscription billing does not show invoice PDFs
The billing page shows a payment history table with Razorpay payment IDs, but there are no downloadable invoice PDFs. This is required for GST compliance for Indian businesses.

### E-10 · `featuredDishesSlider` and "bestsellers/chef's picks" filters have no backend signal
**File:** `src/app/menu/[restaurantSlug]/page.tsx`  
The Quick Filter options "Bestsellers" and "Chef's Picks" on the customer menu page have no backend data to drive them — they currently filter to empty results unless products are manually tagged. A product-level `isFeatured` or `tag` field should be added to the API and admin product form.

---

## 📋 Required Environment Variables Checklist (Production)

Ensure all are set in your production deployment:

| Variable | Required | Current Default | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | ✅ Yes | `https://menugo.com` ⚠️ | Update to production domain |
| `NEXT_PUBLIC_API_URL` | ✅ Yes | `http://localhost:5001` ⚠️ | Set to production API URL |
| `NEXT_PUBLIC_CINEMA_URL` | ✅ Yes | `http://localhost:3001` ⚠️ | Set to production cinema app URL |
| `NEXT_PUBLIC_MAIN_URL` | ✅ Yes | `http://localhost:3002` ⚠️ | Set to production main platform URL |
| `INTERNAL_API_URL` | For SSR | — | Set to internal API URL for server-side calls |

---

## 🏁 V1 Launch Checklist Summary

| ID | Category | Priority | Description | Status |
|---|---|---|---|---|
| B-01 | Critical Bug | 🔴 Blocker | Service Request Modal sends no API call | ❌ Open |
| B-02 | Security | 🔴 Blocker | Mock payment fallback activates fake subscriptions | ❌ Open |
| B-03 | Missing Feature | 🔴 Blocker | No admin forgot/reset password flow | ❌ Open |
| B-04 | Missing Feature | 🔴 Blocker | Logo upload requires external URL, no file upload | ❌ Open |
| B-05 | UX/Code Quality | 🔴 Blocker | Native `confirm()` dialogs on destructive staff actions | ❌ Open |
| B-06 | Branding | 🔴 Blocker | Old `menugo_` localStorage key namespace | ❌ Open |
| M-01 | Architecture | 🟠 Major | No shared admin sidebar layout | ❌ Open |
| M-02 | Code Quality | 🟠 Major | Widespread `any` types in admin pages | ❌ Open |
| M-03 | Realtime | 🟠 Major | Socket singleton leaks without cleanup | ❌ Open |
| M-04 | Business Logic | 🟠 Major | Subscription plan limits not enforced | ❌ Open |
| M-05 | UX | 🟠 Major | Staff PIN login auto-selects wrong restaurant | ❌ Open |
| M-06 | Critical UX | 🟠 Major | Slug change breaks all QR codes without warning | ❌ Open |
| M-07 | Security | 🟠 Major | Staff role not blocked from orders management page | ❌ Open |
| N-01 | Branding | 🟡 Minor | Icon/favicon uses old "M" lettermark | ❌ Open |
| N-02 | Branding | 🟡 Minor | Global error page uses old branding | ❌ Open |
| N-03 | SEO | 🟡 Minor | OG image dimensions declared incorrectly | ❌ Open |
| N-04 | Config | 🟡 Minor | Cinema URL env fallback is localhost | ❌ Open |
| N-05 | UX | 🟡 Minor | Browse Mode ordering wall (no proactive warning) | ❌ Open |
| N-06 | Feature | 🟡 Minor | Print receipt missing restaurant branding | ❌ Open |
| N-07 | Branding | 🟡 Minor | QR stand card has hardcoded attribution text | ❌ Open |
| N-08 | Auth | 🟡 Minor | PIN staff session may not access admin service page | ❌ Open |
| N-09 | Validation | 🟡 Minor | Cancellation reason minimum length not enforced | ❌ Open |
| N-10 | Dead Code | 🟡 Minor | Orphaned page files for `/how-it-works` and `/features` | ❌ Open |
| N-11 | Security | 🟡 Minor | No Content-Security-Policy header | ❌ Open |
| N-12 | Config | 🟡 Minor | Fallback app URL still points to `menugo.com` | ❌ Open |

---

> **Note:** Enhancements (E-01 through E-10) are **not** required for V1 launch and can be deferred to future sprints.
