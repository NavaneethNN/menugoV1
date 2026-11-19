CREATE TABLE IF NOT EXISTS "cinema_customer_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"theatre_id" text NOT NULL,
	"session_token" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cinema_customer_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shared_cost_allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"pool_id" text NOT NULL,
	"restaurant_id" text NOT NULL,
	"tenant_type" varchar(20) NOT NULL,
	"metric_share_ratio" double precision NOT NULL,
	"tenant_measured_usage" double precision NOT NULL,
	"total_pool_measured_usage" double precision NOT NULL,
	"allocated_cost_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shared_cost_pools" (
	"id" text PRIMARY KEY NOT NULL,
	"pool_name" varchar(100) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_invoice_ref" varchar(100),
	"metric_type" varchar(30) NOT NULL,
	"total_cost_paise" integer NOT NULL,
	"allocated_cost_paise" integer DEFAULT 0 NOT NULL,
	"unallocated_cost_paise" integer DEFAULT 0 NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text,
	"restaurant_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"billing_cycle" varchar(20) DEFAULT 'monthly' NOT NULL,
	"provider" varchar(30) DEFAULT 'razorpay' NOT NULL,
	"razorpay_order_id" varchar(255),
	"razorpay_payment_id" varchar(255),
	"razorpay_signature" varchar(500),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"notes" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"tenant_type" varchar(50) DEFAULT 'all' NOT NULL,
	"price_monthly_paise" integer DEFAULT 0 NOT NULL,
	"price_annual_paise" integer DEFAULT 0 NOT NULL,
	"max_tables" integer,
	"max_screens" integer,
	"max_staff" integer,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"restaurant_id" text NOT NULL,
	"tenant_type" varchar(20) NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"direct_tenant_cost_paise" integer DEFAULT 0 NOT NULL,
	"shared_infrastructure_cost_paise" integer DEFAULT 0 NOT NULL,
	"tenant_total_cost_paise" integer NOT NULL,
	"customer_charge_paise" integer NOT NULL,
	"gross_margin_percent" double precision NOT NULL,
	"cost_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(30) DEFAULT 'issued' NOT NULL,
	"reconciliation_validated" boolean DEFAULT true NOT NULL,
	"payment_due_date" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"billing_cycle" varchar(20) DEFAULT 'monthly' NOT NULL,
	"current_period_start" timestamp with time zone DEFAULT now() NOT NULL,
	"current_period_end" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_usage_events" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"tenant_type" varchar(20) NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"quantity" double precision NOT NULL,
	"unit" varchar(30) NOT NULL,
	"direct_cost_paise" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"billing_period" varchar(20),
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unattributed_cost_items" (
	"id" text PRIMARY KEY NOT NULL,
	"pool_id" text,
	"provider" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"unallocated_reason" text NOT NULL,
	"status" varchar(30) DEFAULT 'unallocated' NOT NULL,
	"resolved_to_restaurant_id" text,
	"resolution_notes" text,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cinema_session_id" text;
--> statement-breakpoint
ALTER TABLE "restaurant_members" ADD COLUMN IF NOT EXISTS "status" varchar(50) DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "restaurant_members" ADD COLUMN IF NOT EXISTS "phone" varchar(50);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "tenant_type" varchar(50) DEFAULT 'restaurant' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cinema_customer_sessions" ADD CONSTRAINT "cinema_customer_sessions_theatre_id_restaurants_id_fk" FOREIGN KEY ("theatre_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shared_cost_allocations" ADD CONSTRAINT "shared_cost_allocations_pool_id_shared_cost_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."shared_cost_pools"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shared_cost_allocations" ADD CONSTRAINT "shared_cost_allocations_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_tenant_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."tenant_subscriptions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tenant_invoices" ADD CONSTRAINT "tenant_invoices_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tenant_usage_events" ADD CONSTRAINT "tenant_usage_events_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "unattributed_cost_items" ADD CONSTRAINT "unattributed_cost_items_pool_id_shared_cost_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."shared_cost_pools"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "unattributed_cost_items" ADD CONSTRAINT "unattributed_cost_items_resolved_to_restaurant_id_restaurants_id_fk" FOREIGN KEY ("resolved_to_restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cinema_customer_sessions_theatre_status_idx" ON "cinema_customer_sessions" USING btree ("theatre_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cinema_customer_sessions_expiry_idx" ON "cinema_customer_sessions" USING btree ("status","expires_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cinema_customer_sessions_token_idx" ON "cinema_customer_sessions" USING btree ("session_token");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shared_allocation_pool_tenant_idx" ON "shared_cost_allocations" USING btree ("pool_id","restaurant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shared_allocation_tenant_idx" ON "shared_cost_allocations" USING btree ("restaurant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shared_allocation_tenant_type_idx" ON "shared_cost_allocations" USING btree ("tenant_type");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shared_cost_pool_provider_ref_idx" ON "shared_cost_pools" USING btree ("provider_invoice_ref");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shared_cost_pool_provider_idx" ON "shared_cost_pools" USING btree ("provider");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shared_cost_pool_status_idx" ON "shared_cost_pools" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shared_cost_pool_period_idx" ON "shared_cost_pools" USING btree ("period_start","period_end");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_payment_restaurant_idx" ON "subscription_payments" USING btree ("restaurant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_payment_plan_idx" ON "subscription_payments" USING btree ("plan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_payment_rzp_order_idx" ON "subscription_payments" USING btree ("razorpay_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_payment_rzp_pay_idx" ON "subscription_payments" USING btree ("razorpay_payment_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_payment_status_idx" ON "subscription_payments" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plan_slug_idx" ON "subscription_plans" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_plan_tenant_type_idx" ON "subscription_plans" USING btree ("tenant_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_plan_sort_order_idx" ON "subscription_plans" USING btree ("sort_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_invoice_restaurant_idx" ON "tenant_invoices" USING btree ("restaurant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_invoice_tenant_type_idx" ON "tenant_invoices" USING btree ("tenant_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_invoice_status_idx" ON "tenant_invoices" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_invoice_period_idx" ON "tenant_invoices" USING btree ("period_start","period_end");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_subscription_restaurant_idx" ON "tenant_subscriptions" USING btree ("restaurant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_subscription_plan_idx" ON "tenant_subscriptions" USING btree ("plan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_subscription_status_idx" ON "tenant_subscriptions" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_usage_restaurant_idx" ON "tenant_usage_events" USING btree ("restaurant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_usage_tenant_type_idx" ON "tenant_usage_events" USING btree ("tenant_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_usage_event_type_idx" ON "tenant_usage_events" USING btree ("event_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_usage_period_idx" ON "tenant_usage_events" USING btree ("billing_period");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_usage_recorded_at_idx" ON "tenant_usage_events" USING btree ("recorded_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unattributed_cost_pool_idx" ON "unattributed_cost_items" USING btree ("pool_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unattributed_cost_status_idx" ON "unattributed_cost_items" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unattributed_cost_provider_idx" ON "unattributed_cost_items" USING btree ("provider");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_cinema_session_id_cinema_customer_sessions_id_fk" FOREIGN KEY ("cinema_session_id") REFERENCES "public"."cinema_customer_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_cinema_session_idx" ON "orders" USING btree ("cinema_session_id");
