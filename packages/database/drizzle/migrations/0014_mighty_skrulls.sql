CREATE TABLE "cinema_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"theatre_id" text NOT NULL,
	"provider" varchar(30) NOT NULL,
	"provider_event_id" varchar(255) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"provider_order_id" varchar(255),
	"provider_payment_id" varchar(255),
	"status" varchar(50) DEFAULT 'processed' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cinema_webhook_events" ADD CONSTRAINT "cinema_webhook_events_theatre_id_restaurants_id_fk" FOREIGN KEY ("theatre_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cinema_wh_events_theatre_idx" ON "cinema_webhook_events" USING btree ("theatre_id");--> statement-breakpoint
CREATE INDEX "cinema_wh_events_provider_idx" ON "cinema_webhook_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cinema_wh_events_unique_idx" ON "cinema_webhook_events" USING btree ("theatre_id","provider","provider_event_id");