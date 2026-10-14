-- ============================================================================
-- MIGRATION: 20261014000001_align_schema_with_types_v1.sql
-- DESCRIPTION: Aligns the PostgreSQL schema with the TypeScript entity types
--   in src/types/database.ts. Adds columns referenced by the data engine
--   that were missing from the original schema.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. restaurants: add branding and guest WiFi columns (used by ClientView)
-- ----------------------------------------------------------------------------
ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS tagline TEXT;

ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS wifi_ssid TEXT;

ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS wifi_password TEXT;

-- ----------------------------------------------------------------------------
-- 2. service_requests: add denormalized table_number for convenience reads
--    (mirrors Order.table_number pattern already present in the codebase)
-- ----------------------------------------------------------------------------
ALTER TABLE service_requests
    ADD COLUMN IF NOT EXISTS table_number TEXT;

-- ----------------------------------------------------------------------------
-- 3. profiles: add username column if missing (referenced by TypeScript Profile)
--    Original schema had username; ensure it exists for safety.
-- ----------------------------------------------------------------------------
-- (username already exists in the initial schema; no-op)

COMMIT;
