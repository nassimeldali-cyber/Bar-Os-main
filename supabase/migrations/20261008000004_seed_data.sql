-- ============================================================================
-- MIGRATION: 20261008000004_seed_data.sql
-- DESCRIPTION: Initial seed data for Zoo Bar
-- ============================================================================

-- Fixed IDs for repeatable references
DO $$
DECLARE
    v_restaurant_id UUID := 'a0000000-0000-0000-0000-000000000001';
    v_cat_cocktails UUID := 'c0000000-0000-0000-0000-000000000001';
    v_cat_beers UUID := 'c0000000-0000-0000-0000-000000000002';
    v_cat_softs UUID := 'c0000000-0000-0000-0000-000000000003';
    v_cat_tapas UUID := 'c0000000-0000-0000-0000-000000000004';
    v_cat_burgers UUID := 'c0000000-0000-0000-0000-000000000005';
    v_cat_desserts UUID := 'c0000000-0000-0000-0000-000000000006';

    v_t1 UUID := 'd0000000-0000-0000-0000-000000000001';
    v_t2 UUID := 'd0000000-0000-0000-0000-000000000002';
    v_t3 UUID := 'd0000000-0000-0000-0000-000000000003';
    v_t4 UUID := 'd0000000-0000-0000-0000-000000000004';
    v_t5 UUID := 'd0000000-0000-0000-0000-000000000005';
    v_t6 UUID := 'd0000000-0000-0000-0000-000000000006';
    v_t7 UUID := 'd0000000-0000-0000-0000-000000000007';
    v_t8 UUID := 'd0000000-0000-0000-0000-000000000008';
    v_t9 UUID := 'd0000000-0000-0000-0000-000000000009';
    v_t10 UUID := 'd0000000-0000-0000-0000-000000000010';

BEGIN
    -- 1. Insert Restaurant
    INSERT INTO restaurants (id, name, slug, address, phone, currency)
    VALUES (v_restaurant_id, 'Zoo Bar', 'zoo-bar', 'Tunis, Tunisie', '+216 71 000 000', 'TND')
    ON CONFLICT (id) DO NOTHING;

    -- Staff profiles and memberships must be provisioned through Supabase Auth
    -- by a trusted server-side process. Do not insert fake auth-linked users here.

    -- 2. Tables 01 to 10
    INSERT INTO tables (id, restaurant_id, table_number, zone, status)
    VALUES
    (v_t1, v_restaurant_id, '01', 'Terrasse', 'AVAILABLE'),
    (v_t2, v_restaurant_id, '02', 'Terrasse', 'AVAILABLE'),
    (v_t3, v_restaurant_id, '03', 'Terrasse', 'AVAILABLE'),
    (v_t4, v_restaurant_id, '04', 'Salle Lounge', 'AVAILABLE'),
    (v_t5, v_restaurant_id, '05', 'Salle Lounge', 'AVAILABLE'),
    (v_t6, v_restaurant_id, '06', 'Salle Lounge', 'AVAILABLE'),
    (v_t7, v_restaurant_id, '07', 'Salle Lounge', 'AVAILABLE'),
    (v_t8, v_restaurant_id, '08', 'Bar VIP', 'AVAILABLE'),
    (v_t9, v_restaurant_id, '09', 'Bar VIP', 'AVAILABLE'),
    (v_t10, v_restaurant_id, '10', 'Bar VIP', 'AVAILABLE')
    ON CONFLICT (restaurant_id, table_number) DO NOTHING;

    -- 3. Categories
    INSERT INTO categories (id, restaurant_id, name, icon, display_order)
    VALUES
    (v_cat_cocktails, v_restaurant_id, 'Cocktails & Mixologie', 'Wine', 1),
    (v_cat_beers, v_restaurant_id, 'Bières & Vins', 'Beer', 2),
    (v_cat_softs, v_restaurant_id, 'Boissons & Cafés', 'Coffee', 3),
    (v_cat_tapas, v_restaurant_id, 'Tapas & Planches', 'UtensilsCrossed', 4),
    (v_cat_burgers, v_restaurant_id, 'Burgers & Plats', 'Flame', 5),
    (v_cat_desserts, v_restaurant_id, 'Desserts Gourmands', 'Cake', 6)
    ON CONFLICT (id) DO NOTHING;

    -- 4. Products
    INSERT INTO products (restaurant_id, category_id, name, description, price, available, display_order)
    VALUES
    (v_restaurant_id, v_cat_cocktails, 'Mojito Passion Signature', 'Rhum blanc, menthe fraîche, purée de fruit de la passion, citron vert & soda', 18.500, true, 1),
    (v_restaurant_id, v_cat_cocktails, 'Espresso Martini Lounge', 'Vodka premium, liqueur de café Kahlúa, shot expresso torréfié & sirop de vanille', 21.000, true, 2),
    (v_restaurant_id, v_cat_cocktails, 'Spritz Mediterraneo', 'Apérol, Prosecco doc, orange sanguine & romarin fumé', 19.000, true, 3),
    (v_restaurant_id, v_cat_cocktails, 'Virgin Mojito Fraise (Sans Alcool)', 'Fraises fraîches pilées, menthe du jardin, citron vert et eau pétillante', 12.000, true, 4),

    (v_restaurant_id, v_cat_beers, 'Bière Celtia Pression 50cl', 'Bière blonde tunisienne fraîche au fût', 8.500, true, 1),
    (v_restaurant_id, v_cat_beers, 'Heineken Bouteille 33cl', 'Bière blonde internationale maltée', 10.000, true, 2),
    (v_restaurant_id, v_cat_beers, 'Verre de Vin Rouge Magon AOC', 'Notes de fruits mûrs et épices douces', 14.000, true, 3),

    (v_restaurant_id, v_cat_softs, 'Coca-Cola Zéro 33cl', 'Servi glacé avec rondelle de citron', 5.000, true, 1),
    (v_restaurant_id, v_cat_softs, 'Eau Minérale Safia 1L', 'Bouteille en verre', 4.000, true, 2),
    (v_restaurant_id, v_cat_softs, 'Café Espresso Italien Illy', '100% Arabica, crémeux et intense', 4.500, true, 3),

    (v_restaurant_id, v_cat_tapas, 'Planche Mixte Charcuterie & Fromages', 'Bresaola, jambon de dinde fumé, gruyère affiné, camembert, noix et confiture de figues', 36.000, true, 1),
    (v_restaurant_id, v_cat_tapas, 'Crispy Calamari Sauce Tartare', 'Calamars dorés croustillants, zeste de citron jaune', 24.500, true, 2),
    (v_restaurant_id, v_cat_tapas, 'Nachos Gratinés Cheddar & Guacamole', 'Tortillas chips maïs, double cheddar fondant, jalapeños et guacamole maison', 22.000, true, 3),

    (v_restaurant_id, v_cat_burgers, 'Lounge Smash Burger Double Cheddar', 'Double steak pur bœuf haché minute, oignons caramélisés, sauce secrète, frites fraîches', 28.000, true, 1),
    (v_restaurant_id, v_cat_burgers, 'Pizza Burrata Truffée', 'Sauce tomate San Marzano, mozzarella fior di latte, burrata crémeuse et filet d''huile de truffe', 32.000, true, 2),
    (v_restaurant_id, v_cat_burgers, 'Mazzia 3 Fromages (Grande)', 'Pâte à pizza épaississime et aérée (style Mazzia), sauce tomate San Marzano, mozzarella di bufala, gorgonzola et parmesan, huile d''olive vierge', 26.000, true, 3),

    (v_restaurant_id, v_cat_desserts, 'Fondant Chocolat Noir & Glace Vanille', 'Cœur coulant chocolat noir 70%, boule de vanille de Madagascar', 13.000, true, 1),
    (v_restaurant_id, v_cat_desserts, 'Cheesecake Spéculoos New York', 'Base croquante spéculoos, crème onctueuse et coulis caramel beurre salé', 14.500, true, 2)
    ON CONFLICT DO NOTHING;

    -- Product images require a public storage bucket. See migration 20261014000001_storage_buckets.sql
    UPDATE products
    SET image_url = 'https://dlgyrqxlfcjwddruxcqu.supabase.co/storage/v1/object/public/products/mazzia-3-fromages-grande.jpg'
    WHERE restaurant_id = v_restaurant_id
      AND name = 'Mazzia 3 Fromages (Grande)';

END $$;
