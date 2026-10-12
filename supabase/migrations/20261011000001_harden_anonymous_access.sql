-- Stop exposing operational data through the public/anon PostgREST role.
-- QR ordering must be reintroduced through narrowly scoped RPCs that validate
-- an unguessable table token and enforce business invariants server-side.

DROP POLICY IF EXISTS "Public QR clients can read restaurant info" ON restaurants;
DROP POLICY IF EXISTS "Public read active tables" ON tables;

DROP POLICY IF EXISTS "Public select table sessions" ON table_sessions;
DROP POLICY IF EXISTS "Public insert new table session" ON table_sessions;
DROP POLICY IF EXISTS "Public update session for bill request" ON table_sessions;

DROP POLICY IF EXISTS "Public read active categories" ON categories;
DROP POLICY IF EXISTS "Public read available products" ON products;

DROP POLICY IF EXISTS "Public select orders for active session" ON orders;
DROP POLICY IF EXISTS "Public create order in open session" ON orders;
DROP POLICY IF EXISTS "Public read and insert order items" ON order_items;
DROP POLICY IF EXISTS "Public insert order items" ON order_items;

DROP POLICY IF EXISTS "Public can insert service requests" ON service_requests;

-- Menu data is intentionally public. Keep only active categories and available
-- products visible to unauthenticated clients.
CREATE POLICY "Public read active categories"
    ON categories FOR SELECT
    TO anon
    USING (is_active = true);

CREATE POLICY "Public read available products"
    ON products FOR SELECT
    TO anon
    USING (available = true);

-- No anonymous policy is created for tables, sessions, orders, order_items,
-- payments, notifications, profiles, staff assignments, or service requests.
-- RLS therefore denies direct anonymous access to those records.
