-- ============================================================================
-- db.sql — Full schema for Bar & Lounge SaaS (Supabase)
-- This file consolidates the initial schema, all migrations, schema alignments,
-- and the evolved database state including all columns currently in production.
-- All CREATE statements are idempotent (IF NOT EXISTS / DO blocks) for safe re-runs.
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS (using DO blocks for idempotency — PostgreSQL lacks CREATE TYPE IF NOT EXISTS)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('MANAGER', 'SERVER');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'table_status') THEN
    CREATE TYPE table_status AS ENUM ('AVAILABLE', 'OCCUPIED', 'BILL_REQUESTED', 'PAYMENT_PENDING');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
    CREATE TYPE session_status AS ENUM ('OPEN', 'ADDITION_REQUESTED', 'PAYMENT_PENDING', 'PAID', 'CLOSED', 'CANCELLED');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('NEW', 'ACCEPTED', 'TRANSMITTED_TO_POS', 'PREPARING', 'READY', 'SERVED', 'CANCELLED');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM ('CASH', 'TPE');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_request_type') THEN
    CREATE TYPE service_request_type AS ENUM ('CALL_SERVER', 'BILL_REQUEST', 'WATER_REQUEST', 'ICE_REQUEST', 'ASHTRAY_REQUEST', 'OTHER');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
    CREATE TYPE request_status AS ENUM ('PENDING', 'ACKNOWLEDGED', 'RESOLVED');
  END IF;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. Profiles (linked with Supabase Auth auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  username TEXT UNIQUE,
  role user_role NOT NULL DEFAULT 'SERVER',
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Restaurants (Multi-Tenant)
CREATE TABLE IF NOT EXISTS public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tagline TEXT,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  currency TEXT NOT NULL DEFAULT 'TND',
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  wifi_ssid TEXT,
  wifi_password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Restaurant Users (Tenancy binding)
CREATE TABLE IF NOT EXISTS public.restaurant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'SERVER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, user_id)
);

-- 4. Tables
CREATE TABLE IF NOT EXISTS public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  zone TEXT NOT NULL DEFAULT 'Main Room',
  status table_status NOT NULL DEFAULT 'AVAILABLE',
  is_active BOOLEAN NOT NULL DEFAULT true,
  qr_code_url TEXT,
  qr_token_hash BYTEA UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, table_number)
);

-- 5. Table Sessions
CREATE TABLE IF NOT EXISTS public.table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  session_code TEXT NOT NULL UNIQUE,
  status session_status NOT NULL DEFAULT 'OPEN',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  total_amount NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
  payment_method_preference payment_method,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial index: One open session per table (CRITICAL BUSINESS RULE)
-- A table stays OCCUPIED for its entire session; session must be CLOSED/PAID to release
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_session_per_table
  ON table_sessions (table_id)
  WHERE (status IN ('OPEN', 'ADDITION_REQUESTED', 'PAYMENT_PENDING'));

-- 6. Server Table Assignments
CREATE TABLE IF NOT EXISTS public.server_table_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (server_id, table_id)
);

-- 7. Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  section TEXT NOT NULL DEFAULT 'Bar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 3) NOT NULL CHECK (price >= 0),
  image_url TEXT,
  available BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  status order_status NOT NULL DEFAULT 'NEW',
  subtotal NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
  total NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
  notes TEXT,
  pos_transmitted_at TIMESTAMPTZ,
  pos_transmitted_by UUID REFERENCES profiles(id),
  pos_status TEXT DEFAULT 'PENDING',
  idempotency_key UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  unit_price NUMERIC(10, 3) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  total_price NUMERIC(10, 3) NOT NULL,
  notes TEXT
);

-- 11. Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  amount NUMERIC(10, 3) NOT NULL CHECK (amount >= 0),
  method payment_method NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  confirmed_by UUID NOT NULL REFERENCES profiles(id),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Service Requests
CREATE TABLE IF NOT EXISTS public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
  type service_request_type NOT NULL,
  status request_status NOT NULL DEFAULT 'PENDING',
  table_number TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_table ON table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(session_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(session_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_restaurant ON notifications(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_audit_restaurant ON audit_logs(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_requests_restaurant ON service_requests(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_table ON service_requests(table_id);

-- ============================================================================
-- Triggers & Functions
-- ============================================================================

-- Synchronize table status with session status
CREATE OR REPLACE FUNCTION public.sync_table_status_on_session_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.status = 'OPEN' THEN
      UPDATE tables SET status = 'OCCUPIED', updated_at = now() WHERE id = NEW.table_id;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.status = 'OPEN' THEN
      UPDATE tables SET status = 'OCCUPIED', updated_at = now() WHERE id = NEW.table_id;
    ELSIF NEW.status = 'ADDITION_REQUESTED' THEN
      UPDATE tables SET status = 'BILL_REQUESTED', updated_at = now() WHERE id = NEW.table_id;
    ELSIF NEW.status = 'PAYMENT_PENDING' THEN
      UPDATE tables SET status = 'PAYMENT_PENDING', updated_at = now() WHERE id = NEW.table_id;
    ELSIF NEW.status IN ('CLOSED', 'PAID') THEN
      IF NEW.status = 'CLOSED' THEN
        UPDATE tables SET status = 'AVAILABLE', updated_at = now() WHERE id = NEW.table_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_table_status ON table_sessions;
CREATE TRIGGER trg_sync_table_status
AFTER INSERT OR UPDATE OF status ON table_sessions
FOR EACH ROW
EXECUTE FUNCTION public.sync_table_status_on_session_change();

-- Recalculate session total from orders
CREATE OR REPLACE FUNCTION public.recalculate_session_total(p_session_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total NUMERIC(10, 3);
BEGIN
  SELECT COALESCE(SUM(total), 0.000)
  INTO v_total
  FROM orders
  WHERE session_id = p_session_id
  AND status != 'CANCELLED';

  UPDATE table_sessions
  SET total_amount = v_total, updated_at = now()
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trg_order_total_recalculate()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM recalculate_session_total(OLD.session_id);
  ELSE
    PERFORM recalculate_session_total(NEW.session_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_update_session_total ON orders;
CREATE TRIGGER trg_orders_update_session_total
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_order_total_recalculate();

-- Auto-create notification on new order
CREATE OR REPLACE FUNCTION public.trg_notify_on_new_order()
RETURNS TRIGGER AS $$
DECLARE
  v_table_num TEXT;
BEGIN
  SELECT table_number INTO v_table_num FROM tables WHERE id = NEW.table_id;

  INSERT INTO notifications (restaurant_id, table_id, title, message, type)
  VALUES (
    NEW.restaurant_id,
    NEW.table_id,
    'Nouvelle commande',
    'Commande #' || NEW.order_number || ' reçue pour la Table ' || COALESCE(v_table_num, 'Inconnue'),
    'ORDER_NEW'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_create_notification ON orders;
CREATE TRIGGER trg_orders_create_notification
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_on_new_order();

-- Profile creation trigger (auto-create profile on new auth user)
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.instance_id = '' OR NEW.instance_id IS NULL)
  EXECUTE FUNCTION public.handle_new_user();

-- Restaurant auto-assignment trigger (assign new profile to first restaurant)
CREATE OR REPLACE FUNCTION public.assign_default_restaurant_on_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id UUID;
BEGIN
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

-- ============================================================================
-- Realtime Publication
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- NOTE: PostgreSQL 15 (Supabase) does not support ADD TABLE IF NOT EXISTS
-- for publications (added in PG17). These statements are idempotent on first
-- run only, matching the behavior of the original migration files.
ALTER PUBLICATION supabase_realtime ADD TABLE tables;
ALTER PUBLICATION supabase_realtime ADD TABLE table_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE service_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;

-- ============================================================================
-- Storage Buckets
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Public read access for products bucket" ON storage.objects;
CREATE POLICY "Public read access for products bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'products');
