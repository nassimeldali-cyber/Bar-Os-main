# Schéma de Base de Données — PostgreSQL & Supabase

## 1. Modèle Entité-Association

Le schéma relationnel est structuré autour des 14 tables suivantes :

```
restaurants (id, name, slug, address, phone, currency, tax_rate)
  ├── restaurant_users (id, restaurant_id, user_id, role)
  │      └── profiles (id, email, full_name, username, role, is_active)
  ├── tables (id, restaurant_id, table_number, zone, status, is_active, qr_code_url)
  │      ├── server_table_assignments (server_id, table_id)
  │      └── table_sessions (id, restaurant_id, table_id, session_code, status, total_amount)
  │             ├── orders (id, session_id, table_id, order_number, status, total, pos_status)
  │             │      └── order_items (id, order_id, product_id, quantity, unit_price, total_price)
  │             └── payments (id, session_id, table_id, amount, method, status, confirmed_by)
  ├── categories (id, restaurant_id, name, icon, display_order, is_active)
  │      └── products (id, category_id, name, description, price, available, display_order)
  ├── service_requests (id, table_id, session_id, type, status, resolved_by)
  ├── notifications (id, target_user_id, table_id, title, message, type, is_read)
  └── audit_logs (id, restaurant_id, user_id, action, entity_type, entity_id, details)
```

## 2. Contraintes Critiques

1. **Unicité de la Session Ouverte** :
   Un index partiel unique garantit formellement qu'une table ne peut avoir qu'une seule session active à la fois :
   ```sql
   CREATE UNIQUE INDEX idx_one_open_session_per_table 
   ON table_sessions (table_id) 
   WHERE (status IN ('OPEN', 'ADDITION_REQUESTED', 'PAYMENT_PENDING'));
   ```

2. **Synchronisation d'État Table ↔ Session** :
   Un trigger automatique PostgreSQL met à jour `tables.status` dès qu'un changement intervient sur `table_sessions.status`.

3. **Recalcul du Total Session** :
   Le champ `total_amount` de la session est recalculé dynamiquement lors de toute création ou mise à jour de commande non annulée.

4. **Multi-Tenancy Isolé** :
   Chaque table métier comporte la clé étrangère `restaurant_id` avec suppression en cascade.
