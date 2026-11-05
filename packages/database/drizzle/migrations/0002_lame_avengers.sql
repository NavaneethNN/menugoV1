ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "unit_price" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "subtotal" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "total_amount" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "price" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "restaurant_tables" ALTER COLUMN "table_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "image_key" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "logo_key" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "cover_image_key" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "cover_image_url" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_restaurant_sort_idx" ON "categories" USING btree ("restaurant_id","sort_order");--> statement-breakpoint
CREATE INDEX "orders_restaurant_created_idx" ON "orders" USING btree ("restaurant_id","created_at");--> statement-breakpoint
CREATE INDEX "products_restaurant_available_idx" ON "products" USING btree ("restaurant_id","is_available");--> statement-breakpoint
CREATE UNIQUE INDEX "table_token_idx" ON "restaurant_tables" USING btree ("table_token");--> statement-breakpoint
CREATE INDEX "restaurant_created_at_idx" ON "restaurants" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_table_token_unique" UNIQUE("table_token");