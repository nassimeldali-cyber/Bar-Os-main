-- ============================================================================
-- MIGRATION: 20261008000002_rls_policies.sql
-- DESCRIPTION: Strict Row Level Security (RLS) policies for Multi-Tenancy & Roles
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_table_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions to get current user details
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_restaurant_ids()
RETURNS SETOF UUID AS $$
    SELECT restaurant_id FROM restaurant_users WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_server_assigned_table_ids()
RETURNS SETOF UUID AS $$
    SELECT table_id FROM server_table_assignments WHERE server_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- PROFILES POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can read own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Managers can read profiles of their restaurant staff"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_users ru1
            JOIN restaurant_users ru2 ON ru1.restaurant_id = ru2.restaurant_id
            WHERE ru1.user_id = auth.uid() 
            AND ru1.role = 'MANAGER'
            AND ru2.user_id = profiles.id
        )
    );

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- RESTAURANTS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Public QR clients can read restaurant info"
    ON restaurants FOR SELECT
    USING (true);

CREATE POLICY "Managers can update their restaurant"
    ON restaurants FOR ALL
    USING (id IN (SELECT get_user_restaurant_ids()) AND get_current_user_role() = 'MANAGER');

-- ----------------------------------------------------------------------------
-- TABLES POLICIES
-- ----------------------------------------------------------------------------
-- Public QR client can read table if active
CREATE POLICY "Public read active tables"
    ON tables FOR SELECT
    USING (is_active = true);

-- Managers full control on their restaurant tables
CREATE POLICY "Managers control tables"
    ON tables FOR ALL
    USING (restaurant_id IN (SELECT get_user_restaurant_ids()) AND get_current_user_role() = 'MANAGER');

-- Servers can read tables and update table status for assigned tables
CREATE POLICY "Servers read restaurant tables"
    ON tables FOR SELECT
    USING (restaurant_id IN (SELECT get_user_restaurant_ids()) AND get_current_user_role() = 'SERVER');

CREATE POLICY "Servers update assigned tables"
    ON tables FOR UPDATE
    USING (
        restaurant_id IN (SELECT get_user_restaurant_ids())
        AND get_current_user_role() = 'SERVER'
        AND id IN (SELECT get_server_assigned_table_ids())
    );

-- ----------------------------------------------------------------------------
-- TABLE SESSIONS POLICIES
-- ----------------------------------------------------------------------------
-- Public QR can select sessions of current table
CREATE POLICY "Public select table sessions"
    ON table_sessions FOR SELECT
    USING (true);

-- Public can insert new session if no OPEN session exists
CREATE POLICY "Public insert new table session"
    ON table_sessions FOR INSERT
    WITH CHECK (
        status = 'OPEN' AND
        NOT EXISTS (
            SELECT 1 FROM table_sessions ts
            WHERE ts.table_id = table_sessions.table_id
            AND ts.status IN ('OPEN', 'ADDITION_REQUESTED', 'PAYMENT_PENDING')
        )
    );

-- Public can request bill (update status to ADDITION_REQUESTED)
CREATE POLICY "Public update session for bill request"
    ON table_sessions FOR UPDATE
    USING (status = 'OPEN')
    WITH CHECK (status = 'ADDITION_REQUESTED');

-- Managers have full access to their restaurant sessions
CREATE POLICY "Managers control sessions"
    ON table_sessions FOR ALL
    USING (restaurant_id IN (SELECT get_user_restaurant_ids()) AND get_current_user_role() = 'MANAGER');

-- Servers can view and update sessions of their assigned tables
CREATE POLICY "Servers manage assigned table sessions"
    ON table_sessions FOR ALL
    USING (
        restaurant_id IN (SELECT get_user_restaurant_ids())
        AND get_current_user_role() = 'SERVER'
        AND table_id IN (SELECT get_server_assigned_table_ids())
    );

-- ----------------------------------------------------------------------------
-- CATEGORIES & PRODUCTS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Public read active categories"
    ON categories FOR SELECT
    USING (is_active = true);

CREATE POLICY "Managers manage categories"
    ON categories FOR ALL
    USING (restaurant_id IN (SELECT get_user_restaurant_ids()) AND get_current_user_role() = 'MANAGER');

CREATE POLICY "Public read available products"
    ON products FOR SELECT
    USING (true);

CREATE POLICY "Managers manage products"
    ON products FOR ALL
    USING (restaurant_id IN (SELECT get_user_restaurant_ids()) AND get_current_user_role() = 'MANAGER');

-- ----------------------------------------------------------------------------
-- ORDERS & ORDER ITEMS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Public select orders for active session"
    ON orders FOR SELECT
    USING (true);

CREATE POLICY "Public create order in open session"
    ON orders FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM table_sessions ts
            WHERE ts.id = orders.session_id
            AND ts.status IN ('OPEN', 'ADDITION_REQUESTED')
        )
    );

CREATE POLICY "Staff manage restaurant orders"
    ON orders FOR ALL
    USING (restaurant_id IN (SELECT get_user_restaurant_ids()));

CREATE POLICY "Public read and insert order items"
    ON order_items FOR SELECT
    USING (true);

CREATE POLICY "Public insert order items"
    ON order_items FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Staff manage order items"
    ON order_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = order_items.order_id
            AND o.restaurant_id IN (SELECT get_user_restaurant_ids())
        )
    );

-- ----------------------------------------------------------------------------
-- PAYMENTS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Only staff can manage payments"
    ON payments FOR ALL
    USING (restaurant_id IN (SELECT get_user_restaurant_ids()));

-- ----------------------------------------------------------------------------
-- SERVICE REQUESTS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Public can insert service requests"
    ON service_requests FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Staff manage service requests"
    ON service_requests FOR ALL
    USING (restaurant_id IN (SELECT get_user_restaurant_ids()));

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Users view relevant notifications"
    ON notifications FOR ALL
    USING (
        (target_user_id IS NULL AND restaurant_id IN (SELECT get_user_restaurant_ids()))
        OR target_user_id = auth.uid()
    );

-- ----------------------------------------------------------------------------
-- AUDIT LOGS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Managers read audit logs"
    ON audit_logs FOR SELECT
    USING (restaurant_id IN (SELECT get_user_restaurant_ids()) AND get_current_user_role() = 'MANAGER');

CREATE POLICY "Staff insert audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (restaurant_id IN (SELECT get_user_restaurant_ids()));
