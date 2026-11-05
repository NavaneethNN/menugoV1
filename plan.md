MenuGo V1.0 – Project Plan
10-Day MVP
 30–40 Development Hours

1. Project objective
Build a cloud-based, multi-restaurant QR ordering SaaS platform. Customers scan a restaurant table QR code, browse the digital menu and place orders without installing an app. Restaurant staff manage orders through a responsive web dashboard.
2. Target customers
- Small and medium restaurants
- Cafés
- Family restaurants
- Food courts
- Quick-service restaurants
Use one common ordering workflow for all restaurant types.
3. Technology stack
Component	Technology
Frontend	Next.js, React
Styling	Tailwind CSS, shadcn/ui
Backend	npm, Express 5, TypeScript
Database	Neon PostgreSQL
ORM	Drizzle ORM
Authentication	Better Auth
Validation	Zod
Image storage	Cloudflare
QR generation	qrcode npm
Realtime	WebSockets / managed realtime
Deployment	Vercel 

4. V1 features
Customer interface
- QR-based table identification
- Mobile-friendly digital menu
- Categories and food images
- Shopping cart
- Quantity selection
- Special instructions
- Place order
- Order confirmation
Restaurant admin
- Secure login
- Restaurant profile
- Category management
- Food item management
- Image uploads
- Price and availability management
- Table management
- QR code generation
- Order management
Kitchen dashboard
- Incoming orders
- Table number and order details
- Accept/reject orders
- Preparing status
- Ready status
- Served status
- Sound notifications
5. Database tables
1. restaurants
2. users
3. restaurant_members
4. categories
5. products
6. restaurant_tables
7. orders
8. order_items
All restaurant-owned records must be isolated using restaurant_id.
6. Development schedule
Day	Development task
1	Project setup, database and authentication
2	Restaurant admin and menu CRUD
3	Customer digital menu
4	Cart and order placement
5	Backend order management
6	Kitchen dashboard and realtime updates
7	Table management and QR generation
8	Integration and testing
9	Cloud deployment
10	Pilot restaurant testing and bug fixes

MenuGo V1.0 – Project Plan
10-Day MVP
 30–40 Development Hours

1. Project objective
Build a cloud-based, multi-restaurant QR ordering SaaS platform. Customers scan a restaurant table QR code, browse the digital menu and place orders without installing an app. Restaurant staff manage orders through a responsive web dashboard.
2. Target customers
- Small and medium restaurants
- Cafés
- Family restaurants
- Food courts
- Quick-service restaurants
Use one common ordering workflow for all restaurant types.
3. Technology stack
Component	Technology
Frontend	Next.js, React
Styling	Tailwind CSS, shadcn/ui
Backend	npm, Express 5, TypeScript
Database	Neon PostgreSQL
ORM	Drizzle ORM
Authentication	Better Auth
Validation	Zod
Image storage	Cloudinary
QR generation	qrcode npm
Realtime	WebSockets / managed realtime
Deployment	Vercel 

4. V1 features
Customer interface
- QR-based table identification
- Mobile-friendly digital menu
- Categories and food images
- Shopping cart
- Quantity selection
- Special instructions
- Place order
- Order confirmation
Restaurant admin
- Secure login
- Restaurant profile
- Category management
- Food item management
- Image uploads
- Price and availability management
- Table management
- QR code generation
- Order management
Kitchen dashboard
- Incoming orders
- Table number and order details
- Accept/reject orders
- Preparing status
- Ready status
- Served status
- Sound notifications
5. Database tables
1. restaurants
2. users
3. restaurant_members
4. categories
5. products
6. restaurant_tables
7. orders
8. order_items
All restaurant-owned records must be isolated using restaurant_id.
6. Development schedule
Day	Development task
1	Project setup, database and authentication
2	Restaurant admin and menu CRUD
3	Customer digital menu
4	Cart and order placement
5	Backend order management
6	Kitchen dashboard and realtime updates
7	Table management and QR generation
8	Integration and testing
9	Cloud deployment
10	Pilot restaurant testing and bug fixes

7. Project structure
menugo/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # npm + Express backend
├── packages/
│   ├── database/     # Drizzle schema
│   └── shared/       # Shared types and validation
├── package.json
└── README.md


8. Strictly excluded from V1
- Online payment gateway
- POS integration
- Inventory management
- Staff management
- Payroll
- AI chatbot
- Advanced analytics
- Loyalty programs
- Split billing
- Delivery management
- Subscription billing
These belong to future versions.
9. V1 completion criteria
- Customers can scan QR codes and place orders.
- Restaurants receive orders reliably.
- Kitchen staff can update order statuses.
- Admins can manage menus and tables.
- Multiple restaurants operate independently.
- Mobile and desktop interfaces work correctly.
- Application is deployed and tested with a real restaurant.

8. Strictly excluded from V1
- Online payment gateway
- POS integration
- Inventory management
- Staff management
- Payroll
- AI chatbot
- Advanced analytics
- Loyalty programs
- Split billing
- Delivery management
- Subscription billing
These belong to future versions.
9. V1 completion criteria
- Customers can scan QR codes and place orders.
- Restaurants receive orders reliably.
- Kitchen staff can update order statuses.
- Admins can manage menus and tables.
- Multiple restaurants operate independently.
- Mobile and desktop interfaces work correctly.
- Application is deployed and tested with a real restaurant.