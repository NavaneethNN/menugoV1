ALTER TABLE "orders" ADD COLUMN "movie_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "show_date" varchar(20);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "showtime" varchar(20);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" varchar(50);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_reference" varchar(255);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_movie_id_cinema_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."cinema_movies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_movie_idx" ON "orders" USING btree ("movie_id");--> statement-breakpoint
CREATE INDEX "orders_payment_ref_idx" ON "orders" USING btree ("payment_reference");