-- ============================================================================
-- MIGRATION: 20261014000001_storage_buckets.sql
-- DESCRIPTION: Create public storage bucket for product images
-- ============================================================================

-- Create a public bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT DO NOTHING;

-- Allow anonymous/public read access to objects in the products bucket
DROP POLICY IF EXISTS "Public read access for products bucket" ON storage.objects;
CREATE POLICY "Public read access for products bucket"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'products');

-- Ensure the storage schema is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
