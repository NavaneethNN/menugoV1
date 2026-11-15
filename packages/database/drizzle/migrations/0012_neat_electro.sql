CREATE TABLE "cinema_carts" (
	"id" text PRIMARY KEY NOT NULL,
	"cart_token" varchar(64) NOT NULL,
	"theatre_id" text NOT NULL,
	"screen_id" text,
	"show_id" text,
	"seat_row" varchar(50),
	"seat_number" varchar(50),
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"customer_name" varchar(255),
	"customer_phone" varchar(50),
	"special_instructions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cinema_carts_cart_token_unique" UNIQUE("cart_token")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "order_type" varchar(50) DEFAULT 'restaurant' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "screen_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "show_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "seat_row" varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "seat_number" varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "subtotal" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_status" varchar(50) DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE "cinema_carts" ADD CONSTRAINT "cinema_carts_theatre_id_restaurants_id_fk" FOREIGN KEY ("theatre_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_carts" ADD CONSTRAINT "cinema_carts_screen_id_cinema_screens_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."cinema_screens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_carts" ADD CONSTRAINT "cinema_carts_show_id_cinema_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."cinema_shows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cinema_carts_token_idx" ON "cinema_carts" USING btree ("cart_token");--> statement-breakpoint
CREATE INDEX "cinema_carts_theatre_idx" ON "cinema_carts" USING btree ("theatre_id");--> statement-breakpoint
CREATE INDEX "cinema_carts_screen_idx" ON "cinema_carts" USING btree ("screen_id");--> statement-breakpoint
CREATE INDEX "cinema_carts_show_idx" ON "cinema_carts" USING btree ("show_id");--> statement-breakpoint
CREATE INDEX "cinema_carts_updated_idx" ON "cinema_carts" USING btree ("updated_at");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_screen_id_cinema_screens_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."cinema_screens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_show_id_cinema_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."cinema_shows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_type_idx" ON "orders" USING btree ("order_type");--> statement-breakpoint
CREATE INDEX "orders_screen_idx" ON "orders" USING btree ("screen_id");--> statement-breakpoint
CREATE INDEX "orders_show_idx" ON "orders" USING btree ("show_id");