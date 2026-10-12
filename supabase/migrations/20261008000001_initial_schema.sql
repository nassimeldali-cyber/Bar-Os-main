-- ============================================================================
-- MIGRATION: 20261008000001_initial_schema.sql
-- DESCRIPTION: Core schema for Bar & Lounge SaaS Multi-Tenant Management
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM ('MANAGER', 'SERVER');
CREATE TYPE table_status AS ENUM ('AVAILABLE', 'OCCUPIED', 'BILL_REQUESTED', 'PAYMENT_PENDING');
CREATE TYPE session_status AS ENUM ('OPEN', 'ADDITION_REQUESTED', 'PAYMENT_PENDING', 'PAID', 'CLOSED', 'CANCELLED');
CREATE TYPE order_status AS ENUM ('NEW', 'ACCEPTED', 'TRANSMITTED_TO_POS', 'PREPARING', 'READY', 'SERVED', 'CANCELLED');
CREATE TYPE payment_method AS ENUM ('CASH', 'TPE');
CREATE TYPE service_request_type AS ENUM ('CALL_SERVER', 'BILL_REQUEST', 'WATER_REQUEST', 'OTHER');
CREATE TYPE request_status AS ENUM ('PENDING', 'ACKNOWLEDGED', 'RESOLVED');

-- 1. Profiles (linked with Supabase Auth auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    username TEXT UNIQUE,
    role user_role NOT NULL DEFAULT 'SERVER',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Restaurants (Multi-Tenant)
CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    address TEXT,
    phone TEXT,
    currency TEXT NOT NULL DEFAULT 'TND',
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Restaurant Users (Tenancy binding)
CREATE TABLE restaurant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'SERVER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (restaurant_id, user_id)
);

-- 4. Tables
CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_number TEXT NOT NULL,
    zone TEXT NOT NULL DEFAULT 'Main Room',
    status table_status NOT NULL DEFAULT 'AVAILABLE',
    is_active BOOLEAN NOT NULL DEFAULT true,
    qr_code_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (restaurant_id, table_number)
);

-- 5. Table Sessions
CREATE TABLE table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    session_code TEXT NOT NULL UNIQUE,
    status session_status NOT NULL DEFAULT 'OPEN',
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    total_amount NUMERIC(10, 3) NOT NULL DEFAULT 0.000,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index ensuring only ONE open session per table
CREATE UNIQUE INDEX idx_one_open_session_per_table 
ON table_sessions (table_id) 
WHERE (status IN ('OPEN', 'ADDITION_REQUESTED', 'PAYMENT_PENDING'));

-- 6. Server Table Assignments
CREATE TABLE server_table_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    server_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (server_id, table_id)
);

-- 7. Categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 3) NOT NULL,
    image_url TEXT,
    available BOOLEAN NOT NULL DEFAULT true,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Orders
CREATE TABLE orders (
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Order Items
CREATE TABLE order_items (
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
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    amount NUMERIC(10, 3) NOT NULL CHECK (amount >= 0),
    method payment_method NOT NULL,
    status TEXT NOT NULL DEFAULT 'CONFIRMED',
    confirmed_by UUID NOT NULL REFERENCES profiles(id),
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Service Requests
CREATE TABLE service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
    type service_request_type NOT NULL,
    status request_status NOT NULL DEFAULT 'PENDING',
    resolved_by UUID REFERENCES profiles(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning queries
CREATE INDEX idx_tables_restaurant ON tables(restaurant_id);
CREATE INDEX idx_table_sessions_table ON table_sessions(table_id);
CREATE INDEX idx_orders_session ON orders(session_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_payments_session ON payments(session_id);
CREATE INDEX idx_notifications_target ON notifications(target_user_id, is_read);
CREATE INDEX idx_audit_restaurant ON audit_logs(restaurant_id, created_at DESC);
