# API & WebSocket Reference — QROS / MenuGo 📡

This document provides a technical specification of the REST endpoints, authentication protocols, error formats, and real-time WebSocket events provided by the QROS backend (`apps/api` on port `5001`).

---

## 📋 Table of Contents
1. [General Protocols & Headers](#1-general-protocols--headers)
2. [Authentication & Session Flow](#2-authentication--session-flow)
3. [Restaurant Endpoints](#3-restaurant-endpoints)
4. [Cinema & Theatre Endpoints](#4-cinema--theatre-endpoints)
5. [Cashier & Table Session Endpoints](#5-cashier--table-session-endpoints)
6. [Media Upload Endpoints (Cloudflare R2)](#6-media-upload-endpoints)
7. [WebSocket Event Catalog (Socket.io)](#7-websocket-event-catalog)
8. [Standard Error Responses](#8-standard-error-responses)

---

## 1. General Protocols & Headers

- **Base URL**: `http://localhost:5001/api` (dev) or `https://api.yourdomain.com/api` (prod)
- **Content-Type**: `application/json` (except image uploads which use `multipart/form-data` or presigned PUT)
- **Authentication**:
  - **Session Cookie**: `auth_session` cookie managed by Better Auth.
  - **Restaurant Context Header**: `x-restaurant-id: <uuid>` (or query parameter `?restaurantId=<uuid>`).
  - **Theatre Context Header**: `x-theatre-id: <uuid>` (or query parameter `?theatreId=<uuid>`).
  - **Customer Table Session Header**: `x-session-token: <hex-token>` (for occupied table dining).

---

## 2. Authentication & Session Flow

### A. Better Auth (Owners, Admins, Standard Users)
Base Path: `/api/auth`
- `POST /api/auth/sign-up/email`: Register new owner account.
- `POST /api/auth/sign-in/email`: Log in with email and password.
- `POST /api/auth/sign-out`: Invalidate session and clear auth cookies.
- `GET /api/auth/get-session`: Retrieve active user profile and session data.
- `GET /api/auth/me`: Simplified endpoint returning `{ user, memberships }`.

### B. Staff PIN Authentication (Floor Staff, Cooks, Runners)
- `POST /api/staff/login-pin`:
  - **Body**: `{ "restaurantId": "uuid", "pin": "1234" }`
  - **Response**: Sets session cookie or returns staff access token with assigned roles.
- `POST /api/cinema/staff/login-pin`:
  - **Body**: `{ "theatreId": "uuid", "pin": "1234" }`
  - **Response**: Sets session cookie for cinema terminal, KDS, or delivery runner.

### C. Super Admin Authentication
- `POST /api/super-admin/login`:
  - Authenticates platform administrator using `SUPER_ADMIN_KEY` or master password.

---

## 3. Restaurant Endpoints

### A. Restaurant Management
- `GET /api/restaurants/my`: List all restaurants owned by or accessible to current user.
- `POST /api/restaurants`: Create a new restaurant profile.
- `GET /api/restaurants/:id`: Retrieve restaurant details.
- `PATCH /api/restaurants/:id`: Update restaurant details (name, slug, logo, currency, address, settings).
- `GET /api/restaurants/:id/analytics`: Retrieve order volume, revenue metrics, and top-selling dishes.

### B. Categories & Menu Items (Products)
- `GET /api/categories`: List categories for the restaurant (`x-restaurant-id`).
- `POST /api/categories`: Create a new menu category.
- `PATCH /api/categories/:id`: Update category title or sort order.
- `DELETE /api/categories/:id`: Delete a menu category.
- `GET /api/products`: List all food items / dishes.
- `POST /api/products`: Create a dish (name, price, category, tags: veg/non-veg, allergens, image).
- `PATCH /api/products/:id`: Update dish details or toggle availability.
- `DELETE /api/products/:id`: Soft delete dish.

### C. Tables & QR Code Generation
- `GET /api/tables`: List all tables with table numbers, seating capacity, and QR codes.
- `POST /api/tables`: Create table and generate secure QR payload.
- `GET /api/tables/:id/qr`: Download or stream high-resolution QR image (PNG / SVG).
- `GET /api/tables/verify/:qrToken`: Customer QR scan verification endpoint (returns menu & active session state).

### D. Orders & Kitchen Display System (KDS)
- `GET /api/orders`: Query orders with filters (`status`, `dateRange`, `page`, `limit`).
- `POST /api/orders`: Place a new order (customer QR or waiter POS).
- `GET /api/orders/:id`: Get order details with line items and customer notes.
- `PATCH /api/orders/:id/status`: Update order status:
  - Allowed statuses: `pending`, `accepted`, `preparing`, `ready`, `served`, `cancelled`.
- `GET /api/kitchen/orders`: Dedicated KDS ticket stream for active preparing orders.

### E. Service Requests (Floor Assistance)
- `POST /api/service-requests`: Customer calls waiter, requests water, cutlery, or bill.
- `GET /api/service-requests`: Staff view active service alerts.
- `PATCH /api/service-requests/:id/resolve`: Mark assistance alert as resolved.

---

## 4. Cinema & Theatre Endpoints

### A. Theatre & Screen Management
- `GET /api/cinema/theatres/my`: List user's theatres.
- `POST /api/cinema/theatres`: Onboard new theatre / cinema location.
- `GET /api/cinema/screens`: List screens/auditoriums with row/seat capacity.
- `POST /api/cinema/screens`: Create screen layout (rows, columns, seat names).
- `GET /api/cinema/screens/:id/qr-batch`: Generate batch QR codes for all auditorium seats.

### B. Concessions & Shows
- `GET /api/cinema/products`: List cinema snacks, drinks, combos, and merchandise.
- `POST /api/cinema/products`: Create concession item.
- `GET /api/cinema/shows`: List active movies/showtimes mapped to auditoriums.

### C. In-Seat Orders & Runner Dispatch
- `POST /api/cinema/orders`: Customer places in-seat concession order.
- `GET /api/cinema/orders`: Theatre manager order oversight.
- `GET /api/cinema/kitchen/orders`: Concession kitchen KDS ticket view.
- `GET /api/cinema/delivery/orders`: Runner delivery feed (tickets marked `ready_for_pickup`).
- `PATCH /api/cinema/delivery/:orderId/claim`: Runner claims ticket for seat delivery.
- `PATCH /api/cinema/delivery/:orderId/deliver`: Runner confirms drop-off at seat.

### D. Payment Gateways & Webhooks
- `POST /api/cinema/payments/create-order`: Initializes Razorpay/Paytm transaction for seat checkout.
- `POST /api/cinema/payments/verify`: Verifies client payment signature.
- `POST /api/cinema/payments/webhook/:theatreId/razorpay`: Razorpay S2S webhook.
- `POST /api/cinema/payments/webhook/:theatreId/paytm`: Paytm S2S webhook.

---

## 5. Cashier & Table Session Endpoints

- `GET /api/cashier/tables`: Real-time floor overview of all tables (available, occupied, awaiting bill, paid).
- `GET /api/cashier/tables/:tableId/bill`: Retrieve combined itemized bill across all rounds for the table session.
- `POST /api/cashier/tables/:tableId/settle`: Settle bill (cash, card, UPI), mark all orders as paid, and close the session.

---

## 6. Media Upload Endpoints

- `POST /api/upload/presigned-url`:
  - **Body**: `{ "filename": "dish.jpg", "contentType": "image/jpeg", "folder": "dishes" }`
  - **Response**: `{ "uploadUrl": "https://...", "publicUrl": "https://pub-xyz.r2.dev/dishes/..." }`
  - Upload binary directly using HTTP `PUT` with `Content-Type: image/jpeg` to `uploadUrl`.

---

## 7. WebSocket Event Catalog (Socket.io)

### Connection & Rooms
Connect to `ws://localhost:5001/socket.io/?EIO=4&transport=websocket`.

```typescript
// Join tenant room upon authentication
socket.emit('join:restaurant', { restaurantId: 'uuid' });
socket.emit('join:theatre', { theatreId: 'uuid' });

// Track specific customer order
socket.emit('join:order', { orderId: 'uuid' });
```

### Event Names & Payloads
| Event Name | Direction | Payload Structure |
|---|---|---|
| `order:created` | Server $\to$ Client | `{ orderId, orderNumber, tableNumber, items, totalAmount, status }` |
| `order:status_updated` | Server $\to$ Client | `{ orderId, status, updatedAt }` |
| `service:requested` | Server $\to$ Client | `{ id, tableNumber, requestType: "water"|"bill"|"waiter", createdAt }` |
| `service:updated` | Server $\to$ Client | `{ id, status: "completed", resolvedBy }` |
| `cinema:order:created` | Server $\to$ Client | `{ orderId, screenName, seatNumber, items, totalAmount }` |
| `cinema:order:status_updated` | Server $\to$ Client | `{ orderId, status: "ready_for_pickup"|"out_for_delivery"|"delivered" }` |

---

## 8. Standard Error Responses

All API errors return consistent JSON structures:

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Validation failed: 'price' must be a positive integer in cents.",
    "details": [
      {
        "field": "price",
        "issue": "Expected number, received string"
      }
    ]
  }
}
```

### Common HTTP Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Zod validation error or missing required headers.
- `401 Unauthorized`: Missing or invalid session cookie / token.
- `403 Forbidden`: Authenticated user lacks permission or table is occupied (`TABLE_OCCUPIED`).
- `404 Not Found`: Resource does not exist or does not belong to active tenant (preventing IDOR).
- `429 Too Many Requests`: Rate limit threshold exceeded.
- `500 Internal Server Error`: Unhandled server exception.
