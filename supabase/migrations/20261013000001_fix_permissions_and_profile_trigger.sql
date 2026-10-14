-- ============================================================================
-- MIGRATION: 20261013000001_fix_permissions_and_profile_trigger.sql
-- DESCRIPTION: Corrective migration to fix GRANT permissions, add profile
--   creation trigger, and ensure proper RLS policy coverage after the
--   hardening migration (20261011000001).
-- ============================================================================
-- This migration is idempotent: it uses DROP/CREATE IF EXISTS pattern and
-- IF NOT EXISTS checks. It is safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table-level GRANTS for anon role (public QR client access)
--    The hardening migration created RLS policies for anon but forgot to
--    grant table-level SELECT, which is required for a policy to be evaluated.
-- ----------------------------------------------------------------------------

-- Restaurant info: only public columns needed for QR client (name, currency)
GRANT SELECT ON restaurants TO anon;

-- Tables: anon can read active tables (for QR table listing)
GRANT SELECT ON tables TO anon;

-- Table sessions: anon can select, insert, and update status (for QR session life-cycle)
GRANT SELECT, INSERT, UPDATE ON table_sessions TO anon;

-- Orders & order_items: anon can create orders (for QR ordering)
GRANT SELECT, INSERT ON orders TO anon;
GRANT SELECT, INSERT ON order_items TO anon;

-- Categories & products: anon can read menu (policies already exist)
GRANT SELECT ON categories TO anon;
GRANT SELECT ON products TO anon;

-- Service requests: anon can create service requests (for QR calls)
GRANT SELECT, INSERT ON service_requests TO anon;

-- Server table assignments: anon can read (for QR client to see assigned server)
GRANT SELECT ON server_table_assignments TO anon;

-- Audit logs: anon can insert (for QR client logging)
GRANT INSERT ON audit_logs TO anon;

-- ----------------------------------------------------------------------------
-- 2. Table-level GRANTS for authenticated role
--    Authenticated users (staff: managers and servers) need full access.
--    Previously only some tables had grants; restaurants was missing.
-- ----------------------------------------------------------------------------

GRANT SELECT ON restaurants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON tables TO authenticated;
GRANT SELECT, INSERT, UPDATE ON table_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON service_requests TO authenticated;
GRANT SELECT, UPDATE ON notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON payments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON server_table_assignments TO authenticated;

-- Restaurant users and profiles: authenticated users can read (needed for staff views)
GRANT SELECT, INSERT, UPDATE ON restaurant_users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Default privileges for future tables
--    Ensures new tables created by migrations get proper grants automatically.
-- ----------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE ON SEQUENCES TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. Profile creation trigger
--    Automatically creates a profile record when a new user authenticates
--    via Supabase Auth. This is secure: the trigger runs with SECURITY DEFINER
--    and only inserts a profile matching the NEW auth.users row.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, username, role, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'SERVER',
        true
    )
    ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            full_name = EXCLUDED.full_name;
    RETURN NEW;
END;
$$;

-- Attach the trigger to auth.users (creates profile on new auth user)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    WHEN (NEW.instance_id = '' OR NEW.instance_id IS NULL)
    EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 5. Restaurant auto-assignment trigger
--    When a new profile is created (via the handle_new_user trigger),
--    automatically assign them to the first restaurant as a SERVER.
--    This is a demo convenience; in production, restaurant assignment
--    would be done through an admin interface.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_default_restaurant_on_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_restaurant_id UUID;
BEGIN
    -- Only auto-assign new profiles, not existing ones
    IF TG_OP = 'INSERT' THEN
        SELECT id INTO v_restaurant_id
        FROM restaurants
        ORDER BY created_at ASC
        LIMIT 1;
        
        IF v_restaurant_id IS NOT NULL THEN
            INSERT INTO restaurant_users (restaurant_id, user_id, role)
            VALUES (v_restaurant_id, NEW.id, NEW.role)
            ON CONFLICT (restaurant_id, user_id) DO NOTHING;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_default_restaurant_on_profile();

-- ----------------------------------------------------------------------------
-- 6. RLS policy additions for anonymous QR client
--    After granting table-level SELECT, anon also needs proper row-level policies
--    for INSERT operations (session creation, order creation).
--    Policies from the hardening migration already cover SELECT for
--    categories and products. We add INSERT policies for QR ordering.
-- ----------------------------------------------------------------------------

-- Tables: anon can read active tables only
DROP POLICY IF EXISTS "Public read active tables" ON tables;
CREATE POLICY "Public read active tables"
    ON tables FOR SELECT
    TO anon
    USING (is_active = true);

-- Table sessions: anon can read and insert
DROP POLICY IF EXISTS "Public select table sessions" ON table_sessions;
CREATE POLICY "Public select table sessions"
    ON table_sessions FOR SELECT
    TO anon
    USING (true);

DROP POLICY IF EXISTS "Public insert new table session" ON table_sessions;
CREATE POLICY "Public insert new table session"
    ON table_sessions FOR INSERT
    TO anon
    WITH CHECK (
        status = 'OPEN' AND
        NOT EXISTS (
            SELECT 1 FROM table_sessions ts
            WHERE ts.table_id = table_sessions.table_id
            AND ts.status IN ('OPEN', 'ADDITION_REQUESTED', 'PAYMENT_PENDING')
        )
    );

DROP POLICY IF EXISTS "Public update session for bill request" ON table_sessions;
CREATE POLICY "Public update session for bill request"
    ON table_sessions FOR UPDATE
    TO anon
    USING (status = 'OPEN')
    WITH CHECK (status = 'ADDITION_REQUESTED');

-- Orders: anon can read and insert for open sessions
DROP POLICY IF EXISTS "Public select orders for active session" ON orders;
CREATE POLICY "Public select orders for active session"
    ON orders FOR SELECT
    TO anon
    USING (true);

DROP POLICY IF EXISTS "Public create order in open session" ON orders;
CREATE POLICY "Public create order in open session"
    ON orders FOR INSERT
    TO anon
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM table_sessions ts
            WHERE ts.id = orders.session_id
            AND ts.status IN ('OPEN', 'ADDITION_REQUESTED')
        )
    );

-- Order items: anon can read and insert
DROP POLICY IF EXISTS "Public read and insert order items" ON order_items;
CREATE POLICY "Public read and insert order items"
    ON order_items FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- Service requests: anon can insert
DROP POLICY IF EXISTS "Public can insert service requests" ON service_requests;
CREATE POLICY "Public can insert service requests"
    ON service_requests FOR INSERT
    TO anon
    WITH CHECK (true);

-- Restaurants: anon can read (for QR client to see restaurant name)
DROP POLICY IF EXISTS "Public read restaurants" ON restaurants;
CREATE POLICY "Public read restaurants"
    ON restaurants FOR SELECT
    TO anon
    USING (true);

-- Categories: anon can read active categories (re-created from hardening migration)
DROP POLICY IF EXISTS "Public read active categories" ON categories;
CREATE POLICY "Public read active categories"
    ON categories FOR SELECT
    TO anon
    USING (is_active = true);

-- Products: anon can read available products (re-created from hardening migration)
DROP POLICY IF EXISTS "Public read available products" ON products;
CREATE POLICY "Public read available products"
    ON products FOR SELECT
    TO anon
    USING (available = true);
