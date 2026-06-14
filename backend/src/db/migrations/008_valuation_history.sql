-- 008_valuation_history.sql

CREATE TABLE IF NOT EXISTS product_valuation_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_cost DECIMAL(12,2) DEFAULT 0,
  new_cost DECIMAL(12,2) NOT NULL,
  qty_before DECIMAL(12,3) DEFAULT 0,
  qty_added DECIMAL(12,3) DEFAULT 0,
  source_type VARCHAR(20), -- e.g., 'PO_RECEIPT', 'MANUAL_ADJUST'
  source_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id)
);
