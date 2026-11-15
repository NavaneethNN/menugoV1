CREATE TABLE "cinema_movies" (
	"id" text PRIMARY KEY NOT NULL,
	"theatre_id" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"poster_url" text,
	"poster_key" text,
	"language" varchar(100) NOT NULL,
	"duration_minutes" integer NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cinema_movies" ADD CONSTRAINT "cinema_movies_theatre_id_restaurants_id_fk" FOREIGN KEY ("theatre_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cinema_movies_theatre_idx" ON "cinema_movies" USING btree ("theatre_id");--> statement-breakpoint
CREATE INDEX "cinema_movies_theatre_status_idx" ON "cinema_movies" USING btree ("theatre_id","status");