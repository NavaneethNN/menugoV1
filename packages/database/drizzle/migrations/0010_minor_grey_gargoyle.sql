CREATE TABLE "cinema_shows" (
	"id" text PRIMARY KEY NOT NULL,
	"theatre_id" text NOT NULL,
	"screen_id" text NOT NULL,
	"movie_id" text NOT NULL,
	"show_date" varchar(10) NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"expected_end_time" timestamp with time zone NOT NULL,
	"ordering_start_time" timestamp with time zone NOT NULL,
	"ordering_end_time" timestamp with time zone NOT NULL,
	"turnaround_buffer_minutes" integer DEFAULT 15 NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"cancellation_reason" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cinema_shows" ADD CONSTRAINT "cinema_shows_theatre_id_restaurants_id_fk" FOREIGN KEY ("theatre_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_shows" ADD CONSTRAINT "cinema_shows_screen_id_cinema_screens_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."cinema_screens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_shows" ADD CONSTRAINT "cinema_shows_movie_id_cinema_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."cinema_movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_shows" ADD CONSTRAINT "cinema_shows_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cinema_shows_theatre_idx" ON "cinema_shows" USING btree ("theatre_id");--> statement-breakpoint
CREATE INDEX "cinema_shows_screen_idx" ON "cinema_shows" USING btree ("screen_id");--> statement-breakpoint
CREATE INDEX "cinema_shows_movie_idx" ON "cinema_shows" USING btree ("movie_id");--> statement-breakpoint
CREATE INDEX "cinema_shows_theatre_date_idx" ON "cinema_shows" USING btree ("theatre_id","show_date");--> statement-breakpoint
CREATE INDEX "cinema_shows_screen_date_idx" ON "cinema_shows" USING btree ("screen_id","show_date");--> statement-breakpoint
CREATE INDEX "cinema_shows_screen_time_idx" ON "cinema_shows" USING btree ("screen_id","start_time","expected_end_time");--> statement-breakpoint
CREATE INDEX "cinema_shows_status_idx" ON "cinema_shows" USING btree ("theatre_id","status");