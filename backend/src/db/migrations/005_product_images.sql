-- 005_product_images.sql
-- Adds image_url support to the products table.

ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
