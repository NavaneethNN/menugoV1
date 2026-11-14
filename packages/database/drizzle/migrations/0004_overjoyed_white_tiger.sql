CREATE TABLE "order_status_history" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"from_status" varchar(50) NOT NULL,
	"to_status" varchar(50) NOT NULL,
	"changed_by_user_id" text,
	"changed_by_role" varchar(50) NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'staff' NOT NULL,
	"token" varchar(255) NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"can_cashier" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_sessions" (
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
	CONSTRAINT "table_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'new';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "table_session_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "idempotency_key" varchar(255);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "status_token" varchar(100);--> statement-breakpoint
ALTER TABLE "restaurant_members" ADD COLUMN "staff_name" varchar(255);--> statement-breakpoint
ALTER TABLE "restaurant_members" ADD COLUMN "pin" varchar(10);--> statement-breakpoint
ALTER TABLE "restaurant_members" ADD COLUMN "is_password_set" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant_members" ADD COLUMN "can_cashier" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changed_by_user_id_user_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_invitations" ADD CONSTRAINT "restaurant_invitations_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_invitations" ADD CONSTRAINT "restaurant_invitations_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_table_id_restaurant_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."restaurant_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_closed_by_user_id_user_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_status_history_order_idx" ON "order_status_history" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_status_history_created_idx" ON "order_status_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "restaurant_invitations_restaurant_idx" ON "restaurant_invitations" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "restaurant_invitations_email_idx" ON "restaurant_invitations" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_invitations_token_idx" ON "restaurant_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "table_sessions_restaurant_idx" ON "table_sessions" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "table_sessions_table_status_idx" ON "table_sessions" USING btree ("table_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "table_sessions_token_idx" ON "table_sessions" USING btree ("session_token");--> statement-breakpoint
CREATE UNIQUE INDEX "table_sessions_single_active_idx" ON "table_sessions" USING btree ("table_id") WHERE status = 'active';--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_session_id_table_sessions_id_fk" FOREIGN KEY ("table_session_id") REFERENCES "public"."table_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_table_session_idx" ON "orders" USING btree ("table_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_idx" ON "orders" USING btree ("restaurant_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_status_token_idx" ON "orders" USING btree ("status_token");--> statement-breakpoint
CREATE INDEX "restaurant_members_restaurant_pin_idx" ON "restaurant_members" USING btree ("restaurant_id","pin");