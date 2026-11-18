ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "tenant_type" varchar(50) DEFAULT 'restaurant' NOT NULL;

-- Backfill existing cinema users
UPDATE "user" u
SET "tenant_type" = 'cinema'
WHERE EXISTS (
  SELECT 1 FROM restaurant_members rm 
  JOIN restaurants rest ON rm.restaurant_id = rest.id 
  WHERE rm.user_id = u.id AND rest.tenant_type = 'cinema'
);
