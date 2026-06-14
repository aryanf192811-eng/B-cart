-- 007_ssot.sql

-- 1. Drop dependent views first
DROP VIEW IF EXISTS smart_procurement_view;
DROP VIEW IF EXISTS product_stock_view;

-- 2. Drop redundant columns
ALTER TABLE products DROP COLUMN IF EXISTS on_hand_qty;
ALTER TABLE sales_orders DROP COLUMN IF EXISTS total_amount;
ALTER TABLE purchase_orders DROP COLUMN IF EXISTS total_amount;

-- 3. Recreate product_stock_view dynamically
CREATE OR REPLACE VIEW product_stock_view AS
SELECT p.*,
  COALESCE(sl.computed_on_hand, 0) AS on_hand_qty,
  COALESCE((
    SELECT SUM(qty) FROM stock_ledger
    WHERE product_id = p.id AND move_type = 'RESERVE'
  ), 0) - COALESCE((
    SELECT SUM(qty) FROM stock_ledger
    WHERE product_id = p.id AND move_type = 'UNRESERVE'
  ), 0) AS reserved_qty,
  COALESCE(sl.computed_on_hand, 0) - (
    COALESCE((SELECT SUM(qty) FROM stock_ledger WHERE product_id = p.id AND move_type = 'RESERVE'), 0)
    - COALESCE((SELECT SUM(qty) FROM stock_ledger WHERE product_id = p.id AND move_type = 'UNRESERVE'), 0)
  ) AS free_to_use_qty,
  CASE WHEN COALESCE(sl.computed_on_hand, 0) < p.min_stock_qty THEN true ELSE false END AS is_low_stock
FROM products p
LEFT JOIN (
  SELECT product_id,
    SUM(
      CASE 
        WHEN move_type = 'IN' THEN qty
        WHEN move_type = 'OUT' THEN -qty
        WHEN move_type = 'ADJUST' THEN qty
        ELSE 0 
      END
    ) AS computed_on_hand
  FROM stock_ledger
  GROUP BY product_id
) sl ON sl.product_id = p.id
WHERE p.is_active = true;

-- 4. Recreate smart_procurement_view
CREATE OR REPLACE VIEW smart_procurement_view AS
SELECT
  p.id, p.name, p.sku, p.unit,
  COALESCE(sl.computed_on_hand, 0) AS on_hand_qty,
  COALESCE(
    (SELECT SUM(pol.qty_ordered - COALESCE(pol.qty_received, 0)) 
     FROM po_lines pol
     JOIN purchase_orders po ON po.id = pol.po_id
     WHERE pol.product_id = p.id AND po.status NOT IN ('fully_received', 'cancelled')
    ), 0
  ) AS incoming_qty,
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
    THEN (COALESCE(sl.computed_on_hand, 0) + 
          COALESCE(
            (SELECT SUM(pol.qty_ordered - COALESCE(pol.qty_received, 0)) 
             FROM po_lines pol
             JOIN purchase_orders po ON po.id = pol.po_id
             WHERE pol.product_id = p.id AND po.status NOT IN ('fully_received', 'cancelled')
            ), 0
          )
         ) / ((SELECT SUM(qty) FROM stock_ledger
         WHERE product_id = p.id AND move_type = 'OUT'
         AND created_at >= NOW() - INTERVAL '30 days') / 30.0)
    ELSE NULL
  END AS days_remaining,
  GREATEST(0, CEIL(
    COALESCE((SELECT SUM(qty) FROM stock_ledger
         WHERE product_id = p.id AND move_type = 'OUT'
         AND created_at >= NOW() - INTERVAL '30 days') / 30.0, 0)
    * (p.lead_time_days + 7) - 
    (COALESCE(sl.computed_on_hand, 0) + 
          COALESCE(
            (SELECT SUM(pol.qty_ordered - COALESCE(pol.qty_received, 0)) 
             FROM po_lines pol
             JOIN purchase_orders po ON po.id = pol.po_id
             WHERE pol.product_id = p.id AND po.status NOT IN ('fully_received', 'cancelled')
            ), 0
          )
    )
  )) AS recommended_order_qty
FROM products p
LEFT JOIN vendors v ON v.id = p.default_vendor_id
LEFT JOIN (
  SELECT product_id,
    SUM(
      CASE 
        WHEN move_type = 'IN' THEN qty
        WHEN move_type = 'OUT' THEN -qty
        WHEN move_type = 'ADJUST' THEN qty
        ELSE 0 
      END
    ) AS computed_on_hand
  FROM stock_ledger
  GROUP BY product_id
) sl ON sl.product_id = p.id
WHERE p.is_active = true;

-- 5. Create sales_order_view
CREATE OR REPLACE VIEW sales_order_view AS
SELECT so.*,
  COALESCE((SELECT SUM(qty_ordered * unit_price) FROM so_lines WHERE so_id = so.id), 0) AS total_amount
FROM sales_orders so;

-- 6. Create purchase_order_view
CREATE OR REPLACE VIEW purchase_order_view AS
SELECT po.*,
  COALESCE((SELECT SUM(qty_ordered * unit_price) FROM po_lines WHERE po_id = po.id), 0) AS total_amount
FROM purchase_orders po;
