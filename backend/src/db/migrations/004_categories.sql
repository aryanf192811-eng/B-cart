-- 004_categories.sql — Dynamic Product Categories

-- 1. Create the categories table
CREATE TABLE IF NOT EXISTS product_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert existing categories from products table into product_categories
INSERT INTO product_categories (name)
SELECT DISTINCT category FROM products WHERE category IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- 3. Add category_id to products
ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES product_categories(id);

-- 4. Map the existing string categories to their new IDs
UPDATE products p
SET category_id = c.id
FROM product_categories c
WHERE p.category = c.name;

-- 5. Drop dependent views first
DROP VIEW IF EXISTS product_stock_view CASCADE;
DROP VIEW IF EXISTS smart_procurement_view CASCADE;

-- 6. Drop the old category column
ALTER TABLE products DROP COLUMN category;

-- 7. Recreate the views with the JOIN to product_categories

CREATE OR REPLACE VIEW product_stock_view AS
SELECT p.*,
  c.name AS category,
  COALESCE((
    SELECT SUM(sl.qty) FROM stock_ledger sl
    WHERE sl.product_id = p.id AND sl.move_type = 'RESERVE'
  ), 0) - COALESCE((
    SELECT SUM(sl.qty) FROM stock_ledger sl
    WHERE sl.product_id = p.id AND sl.move_type = 'UNRESERVE'
  ), 0) AS reserved_qty,
  p.on_hand_qty - (
    COALESCE((SELECT SUM(qty) FROM stock_ledger WHERE product_id = p.id AND move_type = 'RESERVE'), 0)
    - COALESCE((SELECT SUM(qty) FROM stock_ledger WHERE product_id = p.id AND move_type = 'UNRESERVE'), 0)
  ) AS free_to_use_qty,
  CASE WHEN p.on_hand_qty < p.min_stock_qty THEN true ELSE false END AS is_low_stock
FROM products p
LEFT JOIN product_categories c ON c.id = p.category_id
WHERE p.is_active = true;

CREATE OR REPLACE VIEW smart_procurement_view AS
SELECT
  p.id, p.name, p.sku, p.unit, p.category_id,
  c.name AS category,
  p.on_hand_qty,
  p.min_stock_qty,
  p.lead_time_days,
  p.default_vendor_id,
  v.name AS default_vendor_name,
  COALESCE(
    (SELECT SUM(qty) FROM stock_ledger
     WHERE product_id = p.id AND move_type = 'OUT'
     AND created_at >= NOW() - INTERVAL '30 days') / 30.0, 0
  ) AS avg_daily_consumption,
  CASE
    WHEN COALESCE((SELECT SUM(qty) FROM stock_ledger
         WHERE product_id = p.id AND move_type = 'OUT'
         AND created_at >= NOW() - INTERVAL '30 days') / 30.0, 0) > 0
    THEN p.on_hand_qty / ((SELECT SUM(qty) FROM stock_ledger
         WHERE product_id = p.id AND move_type = 'OUT'
         AND created_at >= NOW() - INTERVAL '30 days') / 30.0)
    ELSE NULL
  END AS days_remaining,
  GREATEST(0, CEIL(
    COALESCE((SELECT SUM(qty) FROM stock_ledger
         WHERE product_id = p.id AND move_type = 'OUT'
         AND created_at >= NOW() - INTERVAL '30 days') / 30.0, 0)
    * (p.lead_time_days + 7) - p.on_hand_qty
  )) AS recommended_order_qty
FROM products p
LEFT JOIN vendors v ON v.id = p.default_vendor_id
LEFT JOIN product_categories c ON c.id = p.category_id
WHERE p.is_active = true;
