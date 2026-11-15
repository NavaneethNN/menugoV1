CREATE TABLE "cinema_qr_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"theatre_id" text NOT NULL,
	"screen_id" text,
	"qr_type" varchar(30) NOT NULL,
	"qr_name" varchar(255) NOT NULL,
	"token" varchar(64) NOT NULL,
	"theatre_token" varchar(64),
	"screen_token" varchar(64),
	"target_url" text NOT NULL,
	"qr_code_data" text NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cinema_qr_codes" ADD CONSTRAINT "cinema_qr_codes_theatre_id_restaurants_id_fk" FOREIGN KEY ("theatre_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_qr_codes" ADD CONSTRAINT "cinema_qr_codes_screen_id_cinema_screens_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."cinema_screens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_qr_codes" ADD CONSTRAINT "cinema_qr_codes_revoked_by_user_id_user_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cinema_qr_theatre_idx" ON "cinema_qr_codes" USING btree ("theatre_id");--> statement-breakpoint
CREATE INDEX "cinema_qr_screen_idx" ON "cinema_qr_codes" USING btree ("screen_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cinema_qr_token_idx" ON "cinema_qr_codes" USING btree ("token");--> statement-breakpoint
CREATE INDEX "cinema_qr_status_idx" ON "cinema_qr_codes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cinema_qr_theatre_type_status_idx" ON "cinema_qr_codes" USING btree ("theatre_id","qr_type","status");