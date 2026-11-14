# MenuGo – Cinema Theatre Module
## Complete Product Requirements & Development Specification

**Product:** MenuGo  
**Module:** Cinema Theatre Ordering  
**Existing Product:** Restaurant QR Ordering – Already Developed  
**Development Approach:** Extend the existing MenuGo application  
**Initial Market:** India  
**Payment Providers:** Theatre-owned Razorpay or Paytm merchant accounts

---

# 1. Project Overview

MenuGo is an existing multi-tenant QR-based ordering SaaS platform for restaurants.

The restaurant module is already developed. The next development phase is to introduce a separate Cinema Theatre module within the same platform.

MenuGo will support two types of businesses:

1. Restaurants
2. Cinema Theatres

Both business types will use the same underlying platform infrastructure wherever possible, including authentication, tenant management, products, ordering, payment processing, notifications and reporting.

However, their operational workflows and dashboards will be different.

The cinema module will allow theatre administrators to configure their theatre, add screens, configure seating arrangements, create daily movie show schedules, manage food products, accept seat-based food orders, collect online payments and deliver orders to customers inside the auditorium.

**Important:** This is an extension of the existing MenuGo application. Do not create a separate application or rewrite the existing restaurant functionality.

# 2. Product Objectives

The cinema module should achieve the following:

- Allow cinema owners to register their theatre on MenuGo.
- Allow administrators to configure multiple screens.
- Allow administrators to define rows and seats for each screen.
- Allow daily movie show scheduling.
- Allow customers to identify their screen, showtime, row and seat.
- Allow customers to browse the theatre's food menu.
- Allow customers to place food and beverage orders.
- Require successful online payment before order confirmation.
- Allow the theatre to receive payments directly through its own payment gateway account.
- Send confirmed orders to the theatre kitchen.
- Allow kitchen staff to prepare orders.
- Allow delivery staff to deliver food to the correct cinema seat.
- Allow administrators to monitor orders and daily sales.

# 3. MenuGo Homepage and Business Selection

The MenuGo homepage should display two separate business options.

## Option A: Restaurants

For restaurant owners who want table-based QR ordering.

The existing restaurant registration, setup, dashboard and ordering functionality must remain unchanged.

## Option B: Cinema Theatres

For cinema owners who want seat-based food ordering.

When a user selects Cinema Theatres, the user should enter the cinema-specific registration and onboarding process.

The business type must be stored against the tenant account.

Example:

- tenant_type = restaurant
- tenant_type = cinema

Do not mix restaurant-specific and cinema-specific operational screens.

# 4. Cinema Theatre Registration and Onboarding

Cinema administrators should be able to create an account and register their theatre.

Required information:

- Theatre name
- Theatre logo
- Theatre address
- City
- State
- Country
- Contact number
- Contact email
- Business details
- Timezone
- Currency

For the initial Indian deployment:

- Default currency: INR
- Default timezone: Asia/Kolkata
- Display prices in Indian Rupees.

After registration, the administrator should enter the cinema dashboard.

The system should guide the administrator through the initial configuration:

1. Complete theatre profile.
2. Add cinema screens.
3. Configure seating arrangements.
4. Add food categories and products.
5. Configure payment gateway.
6. Create movie show schedules.
7. Generate and download QR codes.
8. Activate customer ordering.

Theatre accounts should support multiple screens under one theatre.

# 5. Cinema Screen Management

Administrators must be able to add, edit, deactivate and manage cinema screens.

Example:

- Screen 1
- Screen 2
- Screen 3
- Screen 4

Each screen must belong to a particular theatre.

Screen fields:

- Screen ID
- Theatre ID
- Screen name
- Screen description (optional)
- Total rows
- Total seats
- Screen status
- Created date
- Updated date

Administrators should be able to:

- Add a screen.
- Edit screen information.
- Activate or deactivate a screen.
- View total seating capacity.
- View the seating configuration.
- View the daily show schedule for that screen.

Do not allow deletion of a screen that has historical orders or show records. Use deactivation or archival instead.

# 6. Seating Configuration

Each cinema screen must have an independently configurable seating layout.

Example:

**Screen 2**

| Row | Starting Seat | Ending Seat | Total Seats |
|---|---:|---:|---:|
| A | 1 | 25 | 25 |
| B | 1 | 25 | 25 |
| C | 1 | 25 | 25 |
| D | 1 | 20 | 20 |
| E | 1 | 20 | 20 |

The system should generate individual seat records.

Example seat identifiers:

- A1
- A2
- A3
- A25
- B1
- B2
- B25

Requirements:

- Add rows.
- Configure seat counts independently for each row.
- Support different row lengths.
- Edit row configurations.
- Add or deactivate individual seats.
- Support optional seat categories such as Regular, Premium and Recliner.
- Display the total seat count for each screen.
- Prevent duplicate seat identifiers within the same screen.

The seating configuration is a permanent theatre configuration. It must not be recreated for every movie show.

If a seat is removed or renamed after historical orders exist, preserve historical references rather than deleting records.

**Important:** Individual seat QR codes are NOT required in V1.

# 7. Daily Movie Show Management

This is one of the most important features of the cinema module.

Administrators must be able to prepare the movie show schedule for each operating date.

A show must belong to:

- A theatre.
- A screen.
- A movie.
- A particular operating date.

Show fields:

- Show ID
- Theatre ID
- Screen ID
- Movie ID
- Show date
- Start time
- Expected end time
- Ordering start time
- Ordering closing time
- Show status
- Created by
- Created date

Movie information:

- Movie title
- Movie poster
- Language
- Duration
- Optional movie description

Example schedule:

**Date: 14 November 2026**

**Screen 2**

| Movie | Start Time | Expected End |
|---|---|---|
| Movie A | 10:00 AM | 1:00 PM |
| Movie B | 1:30 PM | 4:30 PM |
| Movie C | 6:30 PM | 9:30 PM |
| Movie D | 10:00 PM | 1:00 AM next day |

The system must support shows crossing midnight.

## 7.1 Schedule creation

Administrators should be able to:

- Select an operating date.
- Select a screen.
- Select an existing movie or create a movie entry.
- Enter the show start time.
- Enter the expected end time.
- Configure the food ordering window.
- Save the show as a draft.
- Publish the show.

## 7.2 Schedule validation

The backend must prevent overlapping shows on the same screen.

Example:

If Screen 2 has a show from 10:00 AM to 1:00 PM, another show must not be scheduled on that screen during the same period.

Different screens can have overlapping shows.

The system must support a configurable turnaround or cleaning buffer between shows.

## 7.3 Daily schedule management

Provide the following capabilities:

- Copy the previous day's schedule.
- Create a new daily schedule.
- Edit unpublished schedules.
- Cancel shows.
- Publish schedules.
- View schedules by screen.
- View schedules by date.
- Configure ordering windows separately for different shows.

Published schedules should be protected from accidental modifications that could affect existing orders.

If a published show is changed or cancelled, the administrator must receive a warning and affected customers/orders must be handled appropriately.

# 8. Customer QR Ordering Experience

Customers should not need to download an application or create a MenuGo account.

The cinema will display QR codes in the auditorium or other designated locations.

For V1, use a general cinema or screen-level QR code.

There will be no individual QR sticker for every seat.

The QR code should identify the theatre and optionally the screen.

Example:

https://order.menugo.in/cinema/theatre-token

or a screen-specific route:

https://order.menugo.in/cinema/theatre-token/screen-token

The tokens must be unpredictable and must not expose sequential database IDs.

## 8.1 Customer workflow

### Step 1: Scan QR code

Customer scans the QR code and opens the cinema ordering website.

Display:

- Theatre name.
- Theatre logo.
- Food menu availability.
- Current date.
- Ordering instructions.

### Step 2: Select screen

If the QR code identifies a specific screen, preselect that screen.

Otherwise, display the active screens.

Example:

- Screen 1
- Screen 2
- Screen 3
- Screen 4

### Step 3: Fetch showtimes

After the customer selects a screen, the frontend must request the backend for the published shows available for that screen on the current operating date.

Example:

GET /api/public/cinema/{theatreToken}/shows?screenId={screenId}&date={date}

Only active, published shows accepting food orders should be displayed.

Example:

**Screen 2 – Today's Shows**

- 10:00 AM – Movie A
- 1:30 PM – Movie B
- 6:30 PM – Movie C
- 10:00 PM – Movie D

The frontend must not use hardcoded showtimes.

All show information must come from the backend.

### Step 4: Select showtime

Customer selects the correct showtime.

The backend must validate that the selected show:

- Belongs to the selected theatre.
- Belongs to the selected screen.
- Is scheduled for the selected date.
- Is published.
- Is not cancelled.
- Is currently accepting food orders.

### Step 5: Enter seat details

Customer manually enters their seating information.

Fields:

- Row
- Seat number

Example:

- Screen: 2
- Show: 6:30 PM
- Row: F
- Seat: F12

Prefer dropdowns or selectable lists populated from the configured seating layout rather than unrestricted text fields.

The system must verify that the selected seat exists within the selected screen.

The customer must not be able to enter a seat from another screen.

Do not implement movie ticket booking or seat reservation in V1.

The seat selection identifies the food delivery destination. It does not prove that the customer owns a valid movie ticket.

### Step 6: Browse food menu

Display the theatre's active food menu.

The cinema administrator should be able to manage:

- Categories.
- Products.
- Product images.
- Descriptions.
- Prices.
- Availability.
- Combo products.
- Product quantities.
- Special instructions where applicable.

Example categories:

- Popcorn
- Beverages
- Snacks
- Combos
- Desserts

The existing MenuGo product and category management capabilities should be reused wherever possible.

### Step 7: Cart

Display:

- Product name.
- Quantity.
- Unit price.
- Subtotal.
- Applicable taxes.
- Total amount.

All prices and totals must be calculated and validated by the backend.

### Step 8: Checkout

Display an order summary:

- Theatre.
- Screen.
- Movie.
- Show date.
- Showtime.
- Row.
- Seat.
- Ordered items.
- Total amount.

Customer confirms the order and proceeds to payment.

### Step 9: Payment

The cinema must have an active payment gateway connection.

Customer should be redirected to or shown the provider's supported checkout interface.

After successful server-side payment verification, MenuGo confirms the order.

### Step 10: Order confirmation

Display:

- Order number.
- Theatre name.
- Screen.
- Showtime.
- Seat details.
- Ordered items.
- Payment status.
- Order status.

Provide a clear message that the order has been successfully placed.

# 9. Cinema Payment Gateway Integration

This is a mandatory component of the cinema V1.

Each theatre must connect its own payment gateway account.

Initially support:

1. Razorpay
2. Paytm Payment Gateway

Do not make MenuGo the recipient of theatre customer payments.

The payment should be processed using the theatre's own eligible merchant account and settle according to the provider's settlement schedule.

## 9.1 Payment settings

Create a Payment Settings section in the cinema administrator dashboard.

Administrators should be able to:

- Select a supported payment provider.
- Connect their merchant account through the provider's approved onboarding or credential process.
- Configure the required credentials securely.
- Verify the connection.
- View connection status.
- Disable or disconnect the gateway.
- View payment transaction history.

Do not assume that Razorpay and Paytm offer identical account-connection flows.

Implement a separate provider adapter for each provider and follow its current merchant integration documentation and approval requirements.

## 9.2 Payment processing workflow

1. Customer submits the cart.
2. MenuGo backend validates all products, prices and quantities.
3. Backend calculates the final amount.
4. Backend creates a pending MenuGo order.
5. Backend creates a payment order using the theatre's configured gateway account.
6. Customer completes the payment.
7. Gateway sends a server-to-server notification/webhook.
8. MenuGo verifies the webhook signature.
9. MenuGo checks the gateway transaction and confirms that the payment is captured.
10. MenuGo updates the payment record.
11. MenuGo confirms the food order.
12. Kitchen dashboard receives the confirmed order.

Never trust a frontend success redirect as proof of payment.

Use idempotency and unique provider event IDs to prevent duplicate order confirmations.

## 9.3 Payment status values

Support:

- PENDING
- AUTHORIZED
- CAPTURED
- FAILED
- REFUND_PENDING
- PARTIALLY_REFUNDED
- REFUNDED

The exact mapping must follow each provider's transaction lifecycle.

## 9.4 Refunds

Provide an administrator-authorised refund workflow.

Refunds must be initiated through the same theatre merchant account that processed the payment.

Store:

- Refund ID.
- Original payment ID.
- Refund amount.
- Refund reason.
- Refund status.
- Initiated by.
- Provider reference.
- Refund timestamp.

Do not mark a refund completed until the gateway confirms the result.

## 9.5 Financial ownership

- Theatre owns the merchant gateway account.
- Theatre receives customer payments through its account.
- MenuGo does not hold theatre customer funds.
- MenuGo collects its own SaaS subscription separately.
- Gateway processing charges are governed by the provider's merchant agreement.

# 10. Cinema Order Management

After payment is successfully verified, the order must appear in the cinema administrator and kitchen dashboards.

Order information:

- Order number.
- Theatre.
- Screen.
- Movie.
- Show date.
- Showtime.
- Row.
- Seat.
- Items.
- Quantities.
- Special instructions.
- Total.
- Payment status.
- Order status.
- Order creation time.

## 10.1 Order lifecycle

Use the following order states:

NEW
ACCEPTED
PREPARING
READY
ASSIGNED_FOR_DELIVERY
DELIVERED

Additional terminal states:

REJECTED
CANCELLED

The backend must enforce valid state transitions.

A delivered order cannot be moved back to preparing without an authorised correction workflow.

## 10.2 Kitchen dashboard

Kitchen staff should see:

- New incoming orders.
- Screen and seat.
- Movie/showtime.
- Items and quantities.
- Special instructions.
- Payment status.
- Order age.
- Preparation status.

Provide sound notifications for incoming orders.

Staff must be able to:

- Accept an order.
- Mark it as preparing.
- Mark it as ready.

Only eligible paid orders should enter the normal preparation queue.

If payment fails, the order must not be sent to the normal kitchen queue.

# 11. Delivery Staff Workflow

The cinema should have a delivery workflow for bringing food to the customer's seat.

The initial version can be integrated into the existing staff dashboard.

Delivery staff should be able to:

- View orders marked ready.
- See screen number.
- See row and seat number.
- Accept or receive an assignment.
- Mark an order as delivered.

Example:

Order #1042

- Screen 2
- Row F
- Seat F12
- 1 Large Popcorn
- 2 Coke

Status: Ready for delivery.

The administrator should be able to monitor all delivery statuses.

# 12. Cinema Admin Dashboard

Create a separate cinema-specific dashboard.

Recommended navigation:

**Overview**
- Today's orders.
- Today's sales.
- Pending orders.
- Preparing orders.
- Ready orders.
- Delivered orders.
- Active screens.
- Today's shows.

**Theatre Settings**
- Theatre profile.
- Business information.
- Operating hours.
- Ordering settings.

**Screen Management**
- Add/edit screens.
- Seating configuration.
- Seat categories.

**Movie Management**
- Add/edit movies.
- Posters.
- Language.
- Duration.

**Show Management**
- Daily schedules.
- Screen-wise schedules.
- Copy previous schedule.
- Publish/cancel shows.

**Menu Management**
- Categories.
- Products.
- Product images.
- Prices.
- Availability.
- Combos.

**Orders**
- All orders.
- Order details.
- Payment status.
- Delivery status.

**Kitchen**
- Incoming orders.
- Preparation.
- Ready orders.

**Delivery**
- Ready for delivery.
- Assigned orders.
- Delivered orders.

**Payments**
- Gateway connection.
- Payment history.
- Refunds.
- Reconciliation.

**Staff**
- Staff accounts.
- Roles.
- Permissions.

**Reports**
- Daily sales.
- Screen-wise sales.
- Show-wise sales.
- Product-wise sales.
- Payment reports.
- Order fulfilment reports.

# 13. Database and Multi-Tenant Architecture

The cinema module must use the existing MenuGo database and multi-tenant architecture.

Do not duplicate existing tables unnecessarily.

First inspect the current database schema.

Reuse existing entities where they are appropriate:

- tenants
- users
- memberships
- products
- categories
- orders
- order_items
- payments
- notifications

Add cinema-specific entities as required:

- cinema_profiles
- cinema_screens
- cinema_rows
- cinema_seats
- cinema_movies
- cinema_shows
- cinema_seat_qr_codes
- cinema_payment_accounts
- cinema_order_details
- cinema_delivery_assignments

These are logical entity names. Adapt them to the existing naming conventions and schema.

Every cinema-specific record must be associated with the correct tenant.

Tenant isolation is mandatory.

A theatre must never be able to view or modify another theatre's:

- Screens.
- Seating configuration.
- Movies.
- Show schedules.
- Products.
- Orders.
- Payment records.
- Staff.
- Reports.

Enforce tenant access at the backend/domain layer, not merely through frontend restrictions.

Use database constraints and transactions to protect data integrity.

# 14. General QR Code Requirements

For cinema V1, individual seat QR codes are not required.

Support:

- General theatre QR code.
- Optional screen-specific QR code.

The QR code must contain a secure, unpredictable public token.

The token should identify the theatre and optionally the screen.

Do not encode sequential internal database IDs in public QR URLs.

Customers must still select the correct showtime and enter their seat manually.

Validate every selection on the backend.

QR tokens must be revocable and replaceable.

# 15. Security Requirements

Implement the following:

- Secure authentication.
- Tenant isolation.
- Role-based permissions.
- Secure QR tokens.
- Server-side price calculation.
- Input validation using Zod.
- Payment signature verification.
- Webhook signature verification.
- Webhook idempotency.
- Order creation idempotency.
- Rate limiting.
- Protection against duplicate payments.
- Secure payment credential storage.
- Audit logs for administrative changes.
- Secure image uploads.
- Database transaction handling.
- Appropriate access controls for staff dashboards.

Never expose merchant secret keys, API secrets or database credentials to frontend code.

# 16. Features Explicitly Excluded from Cinema V1

Do not implement the following in this development phase:

- Individual QR codes for every seat.
- Movie ticket booking.
- Online cinema ticket payment.
- Integration with BookMyShow or other ticketing systems.
- Automatic movie showtime scraping.
- Automatic movie poster scraping.
- Ticket validation.
- Customer seat reservation.
- Seat occupancy management.
- Automatic interval detection from movie playback.
- AI recommendations.
- Customer mobile applications.
- Advanced inventory management.
- Multi-theatre franchise reporting.

These features may be considered in future development phases.

# 17. UI and User Experience Requirements

The cinema module must have a professional, modern, responsive design.

Admin dashboard:

- Desktop-first but responsive.
- Clear screen and show management.
- Easy daily scheduling.
- Fast order visibility.
- Minimal administrative steps.

Customer ordering:

- Mobile-first.
- Fast loading.
- No app installation.
- No compulsory customer registration.
- Simple screen and show selection.
- Easy row and seat selection.
- Clear product images.
- Fast checkout.
- Clear payment confirmation.

Kitchen dashboard:

- Large, readable order cards.
- Prominent screen and seat information.
- Sound notification.
- Clear order status controls.

Delivery dashboard:

- Easy-to-read screen, row and seat.
- Simple delivery status controls.

The cinema UI must not interfere with the existing restaurant UI.

# 18. Technical Implementation Guidelines

The existing MenuGo stack and project structure must be preserved.

Do not change frameworks, package managers, database technology or deployment architecture without a justified technical requirement.

Use the existing:

- Next.js frontend.
- React components.
- Tailwind CSS.
- shadcn/ui.
- Express API.
- TypeScript.
- PostgreSQL.
- Neon.
- Drizzle ORM.
- Zod validation.
- Existing authentication and authorization system.
- Existing image storage integration.
- Existing realtime infrastructure, if configured.

Use the existing codebase rather than generating a new project.

Build the cinema functionality as a modular extension.

Recommended backend modules:

- cinema-profile
- cinema-screens
- cinema-seating
- cinema-movies
- cinema-shows
- cinema-menu
- cinema-orders
- cinema-payments
- cinema-kitchen
- cinema-delivery
- cinema-reports

Keep payment provider integrations behind a common payment interface.

# 19. Testing Requirements

Every development task must include appropriate automated tests.

## Screen and seating tests

- Create a screen.
- Add rows.
- Generate seats.
- Reject duplicate seats.
- Reject invalid seat references.
- Verify tenant isolation.

## Show scheduling tests

- Create a show.
- Fetch published shows by date and screen.
- Reject overlapping shows on the same screen.
- Allow overlapping shows on different screens.
- Support shows crossing midnight.
- Reject invalid or unpublished shows.
- Validate ordering windows.

## Customer ordering tests

- Validate theatre.
- Validate screen.
- Validate show.
- Validate row.
- Validate seat.
- Validate products.
- Calculate prices on the backend.
- Reject invalid combinations.
- Reject orders when ordering is closed.

## Payment tests

- Create payment order.
- Verify successful payment.
- Reject invalid payment signatures.
- Handle failed payment.
- Handle duplicate webhooks.
- Handle delayed webhooks.
- Prevent duplicate orders.
- Handle refunds.
- Verify tenant payment-account isolation.

## Order workflow tests

- Receive new paid order.
- Accept order.
- Mark preparing.
- Mark ready.
- Assign delivery.
- Mark delivered.
- Reject invalid state transitions.

## Regression tests

The existing restaurant module must continue working.

Run the existing restaurant test suite and regression tests after every major cinema development milestone.

# 20. Development Execution Strategy

The AI coding agent must follow these rules.

1. Inspect the existing MenuGo repository before making changes.
2. Understand the current application architecture.
3. Identify existing reusable restaurant functionality.
4. Inspect existing database schemas and migrations.
5. Inspect the current authentication and tenant model.
6. Inspect the existing order and payment systems.
7. Produce a technical implementation plan.
8. Implement one task at a time.
9. Do not start the next task until the current task passes its acceptance criteria.
10. Add automated tests.
11. Run lint, typecheck, tests and production build.
12. Do not introduce fake implementations or nonfunctional UI.
13. Do not leave buttons without working functionality.
14. Do not create duplicate features when an existing implementation can be extended safely.
15. Do not break the existing restaurant application.

For each completed task, report:

- Files created.
- Files modified.
- Database changes.
- Tests added.
- Tests executed.
- Test results.
- Remaining issues.
- Manual verification instructions.

Never claim a test passed unless it was actually executed.

# 21. Suggested Sequential Development Tasks

Execute these tasks sequentially.

**Task 00 – Existing Repository and Architecture Audit**

Inspect the current MenuGo codebase. Identify reusable components, existing database models, APIs, authentication, tenant isolation, orders and payments. Do not modify the application.

**Task 01 – Cinema Module Foundation**

Add cinema as a separate tenant business type and establish cinema-specific routing, navigation and permissions without affecting restaurants.

**Task 02 – Cinema Onboarding and Profile**

Implement theatre registration, profile setup and onboarding progress.

**Task 03 – Cinema Screen Management**

Implement screen CRUD and validation.

**Task 04 – Seating Configuration**

Implement row and seat management with flexible seat counts and seat categories.

**Task 05 – Movie Management**

Implement movie catalogue management, posters, languages and durations.

**Task 06 – Daily Show Scheduling**

Implement daily show creation, editing, publishing, copying and schedule conflict detection.

**Task 07 – Cinema Food Menu**

Reuse existing product and category management safely for cinema tenants.

**Task 08 – General and Screen QR Codes**

Implement secure QR generation, downloads and public cinema routes. No individual seat QR codes.

**Task 09 – Customer Cinema Ordering Interface**

Implement theatre, screen, showtime and seat selection. Load published show schedules from the backend.

**Task 10 – Cinema Cart and Checkout**

Reuse the existing cart infrastructure where possible, adding cinema-specific order context.

**Task 11 – Theatre Payment Gateway Architecture**

Implement the payment provider abstraction and theatre-specific payment account management.

**Task 12 – Razorpay Integration**

Implement theatre merchant payment processing, server-side verification, webhooks and refunds according to current provider documentation.

**Task 13 – Paytm Integration**

Implement the Paytm provider adapter using the appropriate merchant product, APIs, security and webhook mechanisms.

**Task 14 – Cinema Order Creation**

Implement secure order creation, payment linkage, idempotency and show/seat validation.

**Task 15 – Cinema Kitchen Dashboard**

Implement incoming orders, notifications and preparation workflow.

**Task 16 – Delivery Workflow**

Implement ready-for-delivery, assignment and delivered statuses.

**Task 17 – Cinema Admin Order Management**

Implement complete order monitoring, filtering and order details.

**Task 18 – Cinema Reports**

Implement daily, screen-wise, show-wise and product-wise sales reports.

**Task 19 – Staff Management and Permissions**

Extend the existing staff and role system for cinema operations.

**Task 20 – Security and Reliability Audit**

Audit payment security, tenant isolation, QR access, validation, order creation, refunds and abuse protection.

**Task 21 – Automated Testing and Regression**

Run complete cinema tests and all existing restaurant regression tests.

**Task 22 – Production Deployment**

Configure production environment variables, database migrations, payment webhooks, domain routing and monitoring.

**Task 23 – Cinema Pilot Acceptance**

Perform a complete real-world pilot workflow from theatre onboarding through customer payment, kitchen preparation and seat delivery.

# 22. Final Acceptance Criteria

The cinema module is ready for pilot deployment only when the following complete workflow works:

1. A cinema administrator registers on MenuGo.
2. The administrator creates a theatre profile.
3. The administrator adds multiple screens.
4. The administrator configures seating rows and seats for every screen.
5. The administrator creates movies.
6. The administrator prepares and publishes daily show schedules.
7. The administrator adds food products and categories.
8. The administrator connects an eligible Razorpay or Paytm merchant account.
9. The administrator generates and downloads a theatre or screen QR code.
10. A customer scans the QR code.
11. The customer selects a screen.
12. MenuGo retrieves the correct published showtimes from the backend.
13. The customer selects a showtime.
14. The customer selects a valid row and seat.
15. The customer browses the food menu.
16. The customer adds products to the cart.
17. The customer completes payment using the theatre's gateway.
18. MenuGo verifies the payment on the server.
19. The order is confirmed.
20. The kitchen receives the order.
21. Kitchen staff prepares the food.
22. Delivery staff delivers the order to the specified screen and seat.
23. The administrator can view the order and payment records.
24. The administrator can view daily cinema sales.
25. The existing restaurant module continues functioning without regression.

**Final product principle:**

MenuGo must remain one unified SaaS platform with independent restaurant and cinema operational modules.

The cinema module should reuse existing MenuGo capabilities wherever practical while introducing all cinema-specific entities, workflows and interfaces independently.

The goal is a reliable, production-ready cinema food ordering system, not merely a prototype or a collection of dashboard screens.