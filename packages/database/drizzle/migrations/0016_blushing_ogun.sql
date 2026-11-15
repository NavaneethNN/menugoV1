ALTER TABLE "orders" ADD COLUMN "delivery_staff_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_staff_name" varchar(255);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_status" varchar(50) DEFAULT 'unassigned';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_staff_id_user_id_fk" FOREIGN KEY ("delivery_staff_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_delivery_status_idx" ON "orders" USING btree ("delivery_status");