ALTER TABLE "restaurant_members" ADD COLUMN IF NOT EXISTS "can_cashier" boolean NOT NULL DEFAULT false;
ALTER TABLE "restaurant_invitations" ADD COLUMN IF NOT EXISTS "can_cashier" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "table_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"table_id" text NOT NULL,
	"session_token" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"customer_name" varchar(255),
	"customer_phone" varchar(50),
	"device_fingerprint" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "table_sessions_session_token_unique" UNIQUE("session_token"),
	CONSTRAINT "table_sessions_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "table_sessions_table_id_restaurant_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "restaurant_tables"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "table_sessions_closed_by_user_id_user_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "table_sessions_restaurant_idx" ON "table_sessions" ("restaurant_id");
CREATE INDEX IF NOT EXISTS "table_sessions_table_status_idx" ON "table_sessions" ("table_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "table_sessions_token_idx" ON "table_sessions" ("session_token");

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "table_session_id" text;
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_table_session_id_table_sessions_id_fk" FOREIGN KEY ("table_session_id") REFERENCES "table_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "orders_table_session_idx" ON "orders" ("table_session_id");
