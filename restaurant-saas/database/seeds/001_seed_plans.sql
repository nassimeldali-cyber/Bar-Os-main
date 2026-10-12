-- Seed data
INSERT INTO subscription_plans (id, name, description, price, currency, billing_cycle, max_restaurants, max_tables, max_users, features, is_active)
VALUES
  (gen_random_uuid(), 'FREE', 'Free plan', 0, 'USD', 'MONTHLY', 1, 10, 5, '{"analytics": false, "pos_integration": false}', true),
  (gen_random_uuid(), 'STARTER', 'Starter plan', 29.99, 'USD', 'MONTHLY', 1, 30, 10, '{"analytics": true, "pos_integration": false}', true),
  (gen_random_uuid(), 'PRO', 'Pro plan', 99.99, 'USD', 'MONTHLY', 3, 100, 25, '{"analytics": true, "pos_integration": true}', true),
  (gen_random_uuid(), 'BUSINESS', 'Business plan', 299.99, 'USD', 'MONTHLY', 10, 500, 100, '{"analytics": true, "pos_integration": true}', true);
