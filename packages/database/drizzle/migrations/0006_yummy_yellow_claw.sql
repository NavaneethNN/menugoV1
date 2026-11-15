CREATE TABLE "cinema_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"theatre_id" text NOT NULL,
	"theatre_name" varchar(255) NOT NULL,
	"chain_or_brand" varchar(255),
	"address" text,
	"city" varchar(100) NOT NULL,
	"state" varchar(100) NOT NULL,
	"country" varchar(100) DEFAULT 'India' NOT NULL,
	"contact_number" varchar(50) NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"business_details" text,
	"timezone" varchar(100) DEFAULT 'Asia/Kolkata' NOT NULL,
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"logo_key" text,
	"logo_url" text,
	"onboarding_stage" varchar(50) DEFAULT 'profile_completed' NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"onboarding_stages_completed" jsonb DEFAULT '["profile_completed"]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cinema_profiles" ADD CONSTRAINT "cinema_profiles_theatre_id_restaurants_id_fk" FOREIGN KEY ("theatre_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cinema_profiles_theatre_idx" ON "cinema_profiles" USING btree ("theatre_id");--> statement-breakpoint
CREATE INDEX "cinema_profiles_city_idx" ON "cinema_profiles" USING btree ("city");--> statement-breakpoint
CREATE INDEX "cinema_profiles_state_idx" ON "cinema_profiles" USING btree ("state");