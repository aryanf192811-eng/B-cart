-- seed.sql — Realistic seed data for ForgeOps Mini ERP
-- Note: User password_hash values are injected by seed.js before execution.

-- ============================================================
-- Roles (6 roles)
-- ============================================================
INSERT INTO roles (name, description) VALUES
  ('Admin', 'Full system access'),
  ('Manager', 'Managerial access across modules'),
  ('Sales User', 'Sales module access'),
  ('Purchase User', 'Purchase module access'),
  ('Manufacturing User', 'Manufacturing module access'),
  ('Inventory Manager', 'Inventory and stock management');

-- ============================================================
-- Users (4 users) — password_hash placeholder replaced by seed.js
-- ============================================================
INSERT INTO users (login_id, email, password_hash, full_name, role_id, position, is_active) VALUES
  ('admin', 'admin@forgeops.in', '__BCRYPT_HASH__', 'System Administrator', 1, 'Administrator', true),
  ('ravi.jadeja', 'ravi.jadeja@forgeops.in', '__BCRYPT_HASH__', 'Ravi Jadeja', 3, 'Sales Executive', true),
  ('vijay.sharma', 'vijay.sharma@forgeops.in', '__BCRYPT_HASH__', 'Vijay Sharma', 4, 'Purchase Manager', true),
  ('salman.sheikh', 'salman.sheikh@forgeops.in', '__BCRYPT_HASH__', 'Salman Sheikh', 5, 'Production Lead', true);

-- ============================================================
-- Admin module access (all 6 modules)
-- ============================================================
INSERT INTO user_module_access (user_id, module, access_level) VALUES
  (1, 'Sales', 'admin'),
  (1, 'Purchase', 'admin'),
  (1, 'Manufacturing', 'admin'),
  (1, 'Product', 'admin'),
  (1, 'BoM', 'admin'),
  (1, 'Inventory', 'admin');

-- ============================================================
-- Vendors (4)
-- ============================================================
INSERT INTO vendors (name, email, phone, address, gst_number) VALUES
  ('ABC Wood Industries', 'contact@abcwood.in', '9876543210', '45 Industrial Area, Jodhpur, Rajasthan', '08AABCU9603R1ZM'),
  ('Plastofact IN', 'sales@plastofact.in', '9876543211', '12 MIDC, Pune, Maharashtra', '27AADCP5612L1ZK'),
  ('ORM Metals', 'info@ormmetals.in', '9876543212', '78 Steel Market, Ludhiana, Punjab', '03AAECO7654N1ZJ'),
  ('FastScrew Supplies', 'orders@fastscrew.in', '9876543213', '23 Hardware Lane, Rajkot, Gujarat', '24AAFCF1234M1ZH');

-- ============================================================
-- Customers (3)
-- ============================================================
INSERT INTO customers (name, email, phone, address, gst_number) VALUES
  ('Suzuki India', 'procurement@suzuki.in', '9812345670', 'Manesar Plant, Gurugram, Haryana', '06AACCS1234P1ZA'),
  ('MRF Ltd.', 'vendor-mgmt@mrf.co.in', '9812345671', 'MRF Towers, Chennai, Tamil Nadu', '33AABCM9876R1ZB'),
  ('Reliance Constructions', 'purchase@relcons.in', '9812345672', 'BKC Complex, Mumbai, Maharashtra', '27AARCR5432K1ZC');

-- ============================================================
-- Work Centers (3)
-- ============================================================
INSERT INTO work_centers (code, name, capacity_per_hour, hourly_cost) VALUES
  ('WC-ASM', 'Assembly Line', 2, 500.00),
  ('WC-PNT', 'Paint Floor', 1, 350.00),
  ('WC-PKG', 'Packaging', 4, 200.00);

-- ============================================================
-- Products (6)
-- ============================================================
INSERT INTO products (sku, name, category, unit, sales_price, cost_price, on_hand_qty, min_stock_qty, lead_time_days, procure_on_demand, procurement_type, default_vendor_id) VALUES
  ('DT-001', 'Dining Table', 'Furniture', 'Units', 8500.00, 5500.00, 5.000, 3.000, 7, true, 'manufacturing', NULL),
  ('OC-001', 'Office Chair', 'Furniture', 'Units', 4200.00, 2800.00, 12.000, 5.000, 7, true, 'manufacturing', NULL),
  ('WL-001', 'Wooden Legs', 'Components', 'Units', 250.00, 150.00, 80.000, 50.000, 5, true, 'purchase', 1),
  ('WT-001', 'Wooden Top', 'Components', 'Units', 1200.00, 800.00, 15.000, 10.000, 5, true, 'purchase', 1),
  ('SC-001', 'Screws (pack of 12)', 'Components', 'Packs', 50.00, 30.00, 200.000, 100.000, 3, false, NULL, 4),
  ('FB-001', 'Fabric (m)', 'Raw Materials', 'Meters', 180.00, 110.00, 35.000, 20.000, 5, true, 'purchase', 2);

-- ============================================================
-- BoMs (2)
-- ============================================================
-- BOM-000001: Dining Table
INSERT INTO bom (reference, product_id, qty_produced, status) VALUES
  ('BOM-000001', 1, 1, 'confirmed');

INSERT INTO bom_components (bom_id, component_id, qty) VALUES
  (1, 3, 4.000),   -- 4x Wooden Legs
  (1, 4, 1.000),   -- 1x Wooden Top
  (1, 5, 12.000);  -- 12x Screws

INSERT INTO bom_operations (bom_id, work_center_id, name, duration_mins, sequence) VALUES
  (1, 1, 'Assembly', 60, 1),
  (1, 2, 'Paint', 30, 2),
  (1, 3, 'Pack', 20, 3);

-- BOM-000002: Office Chair
INSERT INTO bom (reference, product_id, qty_produced, status) VALUES
  ('BOM-000002', 2, 1, 'confirmed');

INSERT INTO bom_components (bom_id, component_id, qty) VALUES
  (2, 3, 5.000),   -- 5x Wooden Legs
  (2, 6, 2.000),   -- 2x Fabric
  (2, 5, 8.000);   -- 8x Screws

INSERT INTO bom_operations (bom_id, work_center_id, name, duration_mins, sequence) VALUES
  (2, 1, 'Assembly', 45, 1),
  (2, 3, 'Pack', 15, 2);

-- Link default_bom_id on products
UPDATE products SET default_bom_id = 1 WHERE sku = 'DT-001';
UPDATE products SET default_bom_id = 2 WHERE sku = 'OC-001';

-- ============================================================
-- Demo Purchase Orders (5 completed)
-- ============================================================

-- PO-000001: ABC Wood, on-time, fully received
INSERT INTO purchase_orders (po_number, vendor_id, responsible_id, status, total_amount, expected_delivery_date, received_at, source_type, created_by, created_at)
VALUES ('PO-000001', 1, 3, 'fully_received', 12000.00, '2026-05-20', '2026-05-18 10:00:00+05:30', 'manual', 3, '2026-05-10 09:00:00+05:30');

INSERT INTO po_lines (po_id, product_id, qty_ordered, qty_received, rejected_qty, unit_price) VALUES
  (1, 3, 40.000, 40.000, 0.000, 150.00),
  (1, 4, 10.000, 10.000, 0.000, 800.00);

-- PO-000002: ABC Wood, late delivery, some rejected
INSERT INTO purchase_orders (po_number, vendor_id, responsible_id, status, total_amount, expected_delivery_date, received_at, source_type, created_by, created_at)
VALUES ('PO-000002', 1, 3, 'fully_received', 9000.00, '2026-05-25', '2026-05-28 14:00:00+05:30', 'manual', 3, '2026-05-15 09:00:00+05:30');

INSERT INTO po_lines (po_id, product_id, qty_ordered, qty_received, rejected_qty, unit_price) VALUES
  (2, 3, 30.000, 30.000, 3.000, 150.00),
  (2, 4, 5.000, 5.000, 1.000, 800.00);

-- PO-000003: ABC Wood, on-time
INSERT INTO purchase_orders (po_number, vendor_id, responsible_id, status, total_amount, expected_delivery_date, received_at, source_type, created_by, created_at)
VALUES ('PO-000003', 1, 3, 'fully_received', 6000.00, '2026-06-05', '2026-06-04 11:00:00+05:30', 'manual', 3, '2026-05-28 09:00:00+05:30');

INSERT INTO po_lines (po_id, product_id, qty_ordered, qty_received, rejected_qty, unit_price) VALUES
  (3, 3, 20.000, 20.000, 0.000, 150.00),
  (3, 4, 3.000, 3.000, 0.000, 800.00);

-- PO-000004: FastScrew, on-time
INSERT INTO purchase_orders (po_number, vendor_id, responsible_id, status, total_amount, expected_delivery_date, received_at, source_type, created_by, created_at)
VALUES ('PO-000004', 4, 3, 'fully_received', 3000.00, '2026-05-22', '2026-05-21 16:00:00+05:30', 'manual', 3, '2026-05-12 09:00:00+05:30');

INSERT INTO po_lines (po_id, product_id, qty_ordered, qty_received, rejected_qty, unit_price) VALUES
  (4, 5, 100.000, 100.000, 0.000, 30.00);

-- PO-000005: FastScrew, on-time
INSERT INTO purchase_orders (po_number, vendor_id, responsible_id, status, total_amount, expected_delivery_date, received_at, source_type, created_by, created_at)
VALUES ('PO-000005', 4, 3, 'fully_received', 3000.00, '2026-06-08', '2026-06-07 09:00:00+05:30', 'manual', 3, '2026-06-01 09:00:00+05:30');

INSERT INTO po_lines (po_id, product_id, qty_ordered, qty_received, rejected_qty, unit_price) VALUES
  (5, 5, 100.000, 100.000, 0.000, 30.00);

-- ============================================================
-- Stock Ledger — IN moves for received POs
-- ============================================================
-- PO-000001 received
INSERT INTO stock_ledger (product_id, move_type, qty, reference_type, reference_id, reference_number, balance_after, notes, created_by, created_at) VALUES
  (3, 'IN', 40.000, 'PO', 1, 'PO-000001', 40.000, 'PO receipt', 3, '2026-05-18 10:00:00+05:30'),
  (4, 'IN', 10.000, 'PO', 1, 'PO-000001', 10.000, 'PO receipt', 3, '2026-05-18 10:05:00+05:30');

-- PO-000002 received (net of rejected)
INSERT INTO stock_ledger (product_id, move_type, qty, reference_type, reference_id, reference_number, balance_after, notes, created_by, created_at) VALUES
  (3, 'IN', 27.000, 'PO', 2, 'PO-000002', 67.000, 'PO receipt (3 rejected)', 3, '2026-05-28 14:00:00+05:30'),
  (4, 'IN', 4.000, 'PO', 2, 'PO-000002', 14.000, 'PO receipt (1 rejected)', 3, '2026-05-28 14:05:00+05:30');

-- PO-000003 received
INSERT INTO stock_ledger (product_id, move_type, qty, reference_type, reference_id, reference_number, balance_after, notes, created_by, created_at) VALUES
  (3, 'IN', 20.000, 'PO', 3, 'PO-000003', 87.000, 'PO receipt', 3, '2026-06-04 11:00:00+05:30'),
  (4, 'IN', 3.000, 'PO', 3, 'PO-000003', 17.000, 'PO receipt', 3, '2026-06-04 11:05:00+05:30');

-- PO-000004 received
INSERT INTO stock_ledger (product_id, move_type, qty, reference_type, reference_id, reference_number, balance_after, notes, created_by, created_at) VALUES
  (5, 'IN', 100.000, 'PO', 4, 'PO-000004', 100.000, 'PO receipt', 3, '2026-05-21 16:00:00+05:30');

-- PO-000005 received
INSERT INTO stock_ledger (product_id, move_type, qty, reference_type, reference_id, reference_number, balance_after, notes, created_by, created_at) VALUES
  (5, 'IN', 100.000, 'PO', 5, 'PO-000005', 200.000, 'PO receipt', 3, '2026-06-07 09:00:00+05:30');

-- ============================================================
-- Demo Sales Orders
-- ============================================================

-- SO-000001: Fully delivered to Suzuki India
INSERT INTO sales_orders (so_number, customer_id, salesperson_id, status, total_amount, confirmed_at, created_by, created_at)
VALUES ('SO-000001', 1, 2, 'fully_delivered', 42500.00, '2026-05-20 10:00:00+05:30', 2, '2026-05-19 09:00:00+05:30');

INSERT INTO so_lines (so_id, product_id, qty_ordered, qty_delivered, unit_price) VALUES
  (1, 1, 3.000, 3.000, 8500.00),
  (1, 2, 2.000, 2.000, 4200.00);

-- Stock OUT moves for SO-000001 delivery
INSERT INTO stock_ledger (product_id, move_type, qty, reference_type, reference_id, reference_number, balance_after, notes, created_by, created_at) VALUES
  (1, 'OUT', 3.000, 'SO', 1, 'SO-000001', 2.000, 'SO delivery', 2, '2026-05-22 14:00:00+05:30'),
  (2, 'OUT', 2.000, 'SO', 1, 'SO-000001', 10.000, 'SO delivery', 2, '2026-05-22 14:05:00+05:30');

-- SO-000002: Partially delivered to MRF
INSERT INTO sales_orders (so_number, customer_id, salesperson_id, status, total_amount, confirmed_at, created_by, created_at)
VALUES ('SO-000002', 2, 2, 'partially_delivered', 25500.00, '2026-06-05 11:00:00+05:30', 2, '2026-06-04 10:00:00+05:30');

INSERT INTO so_lines (so_id, product_id, qty_ordered, qty_delivered, unit_price) VALUES
  (2, 1, 2.000, 1.000, 8500.00),
  (2, 2, 2.000, 0.000, 4200.00);

-- Stock OUT for partial delivery of SO-000002
INSERT INTO stock_ledger (product_id, move_type, qty, reference_type, reference_id, reference_number, balance_after, notes, created_by, created_at) VALUES
  (1, 'OUT', 1.000, 'SO', 2, 'SO-000002', 1.000, 'Partial SO delivery', 2, '2026-06-08 10:00:00+05:30');

-- ============================================================
-- Demo Manufacturing Order (draft)
-- ============================================================
INSERT INTO manufacturing_orders (mo_number, product_id, bom_id, qty, status, assignee_id, schedule_date, created_by, created_at)
VALUES ('MO-000001', 1, 1, 5.000, 'draft', 4, '2026-06-20', 4, '2026-06-10 09:00:00+05:30');

-- Update on_hand_qty to reflect final balances after all stock moves
-- DT-001: started 5, sold 3+1 = 4 → 1 remaining  (but seed says 5 initially... 
--   the seed sets on_hand_qty to 5, and the stock_ledger OUT moves are the history.
--   We keep products.on_hand_qty consistent with the last balance_after in stock_ledger)
UPDATE products SET on_hand_qty = 1.000 WHERE sku = 'DT-001';  -- after selling 4 from initial implicit stock
UPDATE products SET on_hand_qty = 10.000 WHERE sku = 'OC-001'; -- after selling 2
-- Components stay at their seeded values (PO IN moves represent historical receipts that built up to current qty)
-- WL-001: 80 (current on-hand as seeded)
-- WT-001: 15 (current on-hand as seeded) 
-- SC-001: 200 (current on-hand as seeded)
-- FB-001: 35 (current on-hand as seeded)
