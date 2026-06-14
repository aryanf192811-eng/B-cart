-- 002_intelligence.sql — Product passports + intelligence views

-- 21. product_passports
CREATE TABLE IF NOT EXISTS product_passports (
  id SERIAL PRIMARY KEY,
  passport_id VARCHAR(50) UNIQUE NOT NULL,
  mo_id INTEGER NOT NULL REFERENCES manufacturing_orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  batch_number VARCHAR(100) NOT NULL,
  qty_produced DECIMAL(12,3) NOT NULL,
  manufactured_by INTEGER REFERENCES users(id),
  manufacture_date TIMESTAMPTZ DEFAULT NOW(),
  qc_status VARCHAR(20) CHECK (qc_status IN ('pending','passed','failed')) DEFAULT 'pending',
  qc_notes TEXT,
  qc_reviewed_by INTEGER REFERENCES users(id),
  qc_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. passport_components
CREATE TABLE IF NOT EXISTS passport_components (
  id SERIAL PRIMARY KEY,
  passport_id INTEGER NOT NULL REFERENCES product_passports(id) ON DELETE CASCADE,
  component_id INTEGER NOT NULL REFERENCES products(id),
  component_name VARCHAR(200) NOT NULL,
  qty_used DECIMAL(12,3) NOT NULL,
  source_vendor_id INTEGER REFERENCES vendors(id),
  source_po_id INTEGER REFERENCES purchase_orders(id),
  batch_reference VARCHAR(100)
);

-- Intelligence Views

CREATE OR REPLACE VIEW product_stock_view AS
SELECT p.*,
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
WHERE p.is_active = true;

CREATE OR REPLACE VIEW smart_procurement_view AS
SELECT
  p.id, p.name, p.sku, p.unit,
  p.on_hand_qty,
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
    THEN (p.on_hand_qty + 
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
    (p.on_hand_qty + 
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
WHERE p.is_active = true;

CREATE OR REPLACE VIEW vendor_reliability_view AS
SELECT
  v.id AS vendor_id, v.name,
  COUNT(DISTINCT po.id) AS total_orders,
  COUNT(DISTINCT CASE WHEN po.status IN ('fully_received','partially_received') THEN po.id END) AS completed_orders,
  COALESCE(ROUND(AVG(CASE WHEN po.status = 'fully_received'
       AND po.received_at::date <= po.expected_delivery_date THEN 100.0 ELSE 0 END)::numeric, 1), 100) AS on_time_rate,
  COALESCE(ROUND((SUM(pol.qty_received) * 100.0 / NULLIF(SUM(pol.qty_ordered), 0))::numeric, 1), 100) AS fulfillment_rate,
  COALESCE(ROUND((100.0 - SUM(COALESCE(pol.rejected_qty, 0)) * 100.0 / NULLIF(SUM(pol.qty_received), 0))::numeric, 1), 100) AS quality_rate,
  COALESCE(ROUND((
    AVG(CASE WHEN po.received_at::date <= po.expected_delivery_date THEN 100.0 ELSE 0 END) * 0.5
    + (SUM(pol.qty_received) * 100.0 / NULLIF(SUM(pol.qty_ordered), 0)) * 0.3
    + (100.0 - SUM(COALESCE(pol.rejected_qty, 0)) * 100.0 / NULLIF(SUM(pol.qty_received), 0)) * 0.2
  )::numeric, 1), 100) AS reliability_score
FROM vendors v
LEFT JOIN purchase_orders po ON po.vendor_id = v.id AND po.status != 'draft'
LEFT JOIN po_lines pol ON pol.po_id = po.id
WHERE v.is_active = true
GROUP BY v.id, v.name
ORDER BY reliability_score DESC NULLS LAST;

CREATE OR REPLACE VIEW work_center_load_view AS
SELECT wc.id, wc.code, wc.name, wc.capacity_per_hour, wc.hourly_cost,
  COUNT(CASE WHEN wo.status = 'pending' THEN 1 END) AS pending_orders,
  COUNT(CASE WHEN wo.status IN ('in_progress','paused') THEN 1 END) AS active_orders,
  COALESCE(SUM(CASE WHEN wo.status IN ('pending','in_progress','paused') THEN wo.duration_mins ELSE 0 END), 0) AS queued_minutes,
  ROUND(
    COALESCE(SUM(CASE WHEN wo.status IN ('pending','in_progress','paused') THEN wo.duration_mins ELSE 0 END), 0)
    * 100.0 / NULLIF(480 * wc.capacity_per_hour, 0)
  , 1) AS utilization_pct,
  CASE WHEN COALESCE(SUM(CASE WHEN wo.status IN ('pending','in_progress','paused') THEN wo.duration_mins ELSE 0 END), 0)
       * 100.0 / NULLIF(480 * wc.capacity_per_hour, 0) > 80 THEN true ELSE false END AS is_bottleneck
FROM work_centers wc
LEFT JOIN work_orders wo ON wo.work_center_id = wc.id
WHERE wc.is_active = true
GROUP BY wc.id, wc.code, wc.name, wc.capacity_per_hour, wc.hourly_cost;
