ALTER TABLE "restaurant_members" ADD COLUMN IF NOT EXISTS "staff_name" varchar(255);
ALTER TABLE "restaurant_members" ADD COLUMN IF NOT EXISTS "pin" varchar(10);
ALTER TABLE "restaurant_members" ADD COLUMN IF NOT EXISTS "is_password_set" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "restaurant_members_restaurant_pin_idx" ON "restaurant_members" ("restaurant_id", "pin");

