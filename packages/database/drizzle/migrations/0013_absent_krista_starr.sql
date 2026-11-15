CREATE TABLE "cinema_payment_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"theatre_id" text NOT NULL,
	"provider" varchar(30) NOT NULL,
	"environment" varchar(20) DEFAULT 'test' NOT NULL,
	"key_id" varchar(255) NOT NULL,
	"encrypted_key_secret" text NOT NULL,
	"encrypted_webhook_secret" text,
	"masked_key_secret" varchar(50) NOT NULL,
	"status" varchar(30) DEFAULT 'disconnected' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"last_verification_error" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cinema_payment_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"theatre_id" text NOT NULL,
	"order_id" text,
	"payment_account_id" text,
	"provider" varchar(30) NOT NULL,
	"provider_payment_id" varchar(255),
	"provider_order_id" varchar(255),
	"amount" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"refund_status" varchar(50),
	"refund_amount" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cinema_refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"theatre_id" text NOT NULL,
	"transaction_id" text,
	"order_id" text,
	"provider" varchar(30) NOT NULL,
	"provider_refund_id" varchar(255),
	"amount" integer NOT NULL,
	"reason" text,
	"status" varchar(50) DEFAULT 'REFUND_PENDING' NOT NULL,
	"initiated_by" varchar(255) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cinema_payment_accounts" ADD CONSTRAINT "cinema_payment_accounts_theatre_id_restaurants_id_fk" FOREIGN KEY ("theatre_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_payment_transactions" ADD CONSTRAINT "cinema_payment_transactions_theatre_id_restaurants_id_fk" FOREIGN KEY ("theatre_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_payment_transactions" ADD CONSTRAINT "cinema_payment_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_payment_transactions" ADD CONSTRAINT "cinema_payment_transactions_payment_account_id_cinema_payment_accounts_id_fk" FOREIGN KEY ("payment_account_id") REFERENCES "public"."cinema_payment_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_refunds" ADD CONSTRAINT "cinema_refunds_theatre_id_restaurants_id_fk" FOREIGN KEY ("theatre_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_refunds" ADD CONSTRAINT "cinema_refunds_transaction_id_cinema_payment_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."cinema_payment_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_refunds" ADD CONSTRAINT "cinema_refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cinema_pay_accts_theatre_idx" ON "cinema_payment_accounts" USING btree ("theatre_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cinema_pay_accts_theatre_provider_idx" ON "cinema_payment_accounts" USING btree ("theatre_id","provider");--> statement-breakpoint
CREATE INDEX "cinema_pay_tx_theatre_idx" ON "cinema_payment_transactions" USING btree ("theatre_id");--> statement-breakpoint
CREATE INDEX "cinema_pay_tx_order_idx" ON "cinema_payment_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "cinema_pay_tx_provider_order_idx" ON "cinema_payment_transactions" USING btree ("provider","provider_order_id");--> statement-breakpoint
CREATE INDEX "cinema_pay_tx_provider_payment_idx" ON "cinema_payment_transactions" USING btree ("provider","provider_payment_id");--> statement-breakpoint
CREATE INDEX "cinema_refunds_theatre_idx" ON "cinema_refunds" USING btree ("theatre_id");--> statement-breakpoint
CREATE INDEX "cinema_refunds_tx_idx" ON "cinema_refunds" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "cinema_refunds_order_idx" ON "cinema_refunds" USING btree ("order_id");