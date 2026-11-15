CREATE TABLE "cinema_rows" (
	"id" text PRIMARY KEY NOT NULL,
	"theatre_id" text NOT NULL,
	"screen_id" text NOT NULL,
	"row_identifier" varchar(10) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"start_seat_number" integer DEFAULT 1 NOT NULL,
	"end_seat_number" integer NOT NULL,
	"total_seats" integer NOT NULL,
	"seat_category" varchar(50) DEFAULT 'regular' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cinema_seats" (
	"id" text PRIMARY KEY NOT NULL,
	"theatre_id" text NOT NULL,
	"screen_id" text NOT NULL,
	"row_id" text NOT NULL,
	"row_identifier" varchar(10) NOT NULL,
	"seat_number" integer NOT NULL,
	"seat_identifier" varchar(20) NOT NULL,
	"seat_category" varchar(50) DEFAULT 'regular' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cinema_rows" ADD CONSTRAINT "cinema_rows_theatre_id_restaurants_id_fk" FOREIGN KEY ("theatre_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_rows" ADD CONSTRAINT "cinema_rows_screen_id_cinema_screens_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."cinema_screens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_seats" ADD CONSTRAINT "cinema_seats_theatre_id_restaurants_id_fk" FOREIGN KEY ("theatre_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_seats" ADD CONSTRAINT "cinema_seats_screen_id_cinema_screens_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."cinema_screens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_seats" ADD CONSTRAINT "cinema_seats_row_id_cinema_rows_id_fk" FOREIGN KEY ("row_id") REFERENCES "public"."cinema_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cinema_rows_theatre_idx" ON "cinema_rows" USING btree ("theatre_id");--> statement-breakpoint
CREATE INDEX "cinema_rows_screen_idx" ON "cinema_rows" USING btree ("screen_id");--> statement-breakpoint
CREATE INDEX "cinema_rows_sort_idx" ON "cinema_rows" USING btree ("screen_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "cinema_rows_screen_row_idx" ON "cinema_rows" USING btree ("screen_id","row_identifier");--> statement-breakpoint
CREATE INDEX "cinema_seats_theatre_idx" ON "cinema_seats" USING btree ("theatre_id");--> statement-breakpoint
CREATE INDEX "cinema_seats_screen_idx" ON "cinema_seats" USING btree ("screen_id");--> statement-breakpoint
CREATE INDEX "cinema_seats_row_idx" ON "cinema_seats" USING btree ("row_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cinema_seats_screen_seat_idx" ON "cinema_seats" USING btree ("screen_id","seat_identifier");