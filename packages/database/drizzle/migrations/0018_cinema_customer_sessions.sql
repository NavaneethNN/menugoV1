CREATE TABLE IF NOT EXISTS "cinema_customer_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "theatre_id" text NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
  "session_token" varchar(100) NOT NULL UNIQUE,
  "status" varchar(50) DEFAULT 'active' NOT NULL,
  "opened_at" timestamptz DEFAULT now() NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "closed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "cinema_customer_sessions_theatre_status_idx" ON "cinema_customer_sessions" ("theatre_id", "status");
CREATE INDEX IF NOT EXISTS "cinema_customer_sessions_expiry_idx" ON "cinema_customer_sessions" ("status", "expires_at");
CREATE UNIQUE INDEX IF NOT EXISTS "cinema_customer_sessions_token_idx" ON "cinema_customer_sessions" ("session_token");
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cinema_session_id" text REFERENCES "cinema_customer_sessions"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "orders_cinema_session_idx" ON "orders" ("cinema_session_id");
