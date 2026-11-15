CREATE TABLE "cinema_screens" (
	"id" text PRIMARY KEY NOT NULL,
	"theatre_id" text NOT NULL,
	"screen_name" varchar(100) NOT NULL,
	"description" text,
	"screen_type" varchar(50) DEFAULT 'standard' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"total_seats" integer DEFAULT 0 NOT NULL,
	"seating_configured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cinema_screens" ADD CONSTRAINT "cinema_screens_theatre_id_restaurants_id_fk" FOREIGN KEY ("theatre_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cinema_screens_theatre_idx" ON "cinema_screens" USING btree ("theatre_id");--> statement-breakpoint
CREATE INDEX "cinema_screens_status_idx" ON "cinema_screens" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "cinema_screens_theatre_name_idx" ON "cinema_screens" USING btree ("theatre_id","screen_name");