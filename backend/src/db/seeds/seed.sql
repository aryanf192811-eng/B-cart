-- seed.sql — Realistic seed data for B-cart
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
  ('admin', 'admin@B-cart.in', '__BCRYPT_HASH__', 'System Administrator', 1, 'Administrator', true),
  ('ravi.jadeja', 'ravi.jadeja@B-cart.in', '__BCRYPT_HASH__', 'Ravi Jadeja', 3, 'Sales Executive', true),
  ('vijay.sharma', 'vijay.sharma@B-cart.in', '__BCRYPT_HASH__', 'Vijay Sharma', 4, 'Purchase Manager', true),
  ('salman.sheikh', 'salman.sheikh@B-cart.in', '__BCRYPT_HASH__', 'Salman Sheikh', 5, 'Production Lead', true);

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
  ('WC-PKG', 'Packaging', 4, 200.00),
  ('WC-QC', 'QC Lab', 5, 450.00),
  ('WC-CNC', 'CNC Machining', 3, 850.00),
  ('WC-WLD', 'Welding Station', 2, 600.00);

-- ============================================================
-- Product Categories (3)
-- ============================================================
INSERT INTO product_categories (name, description) VALUES
  ('Furniture', 'Finished furniture products'),
  ('Components', 'Manufactured or purchased parts'),
  ('Raw Materials', 'Basic raw materials');

-- ============================================================
-- Products (6)
-- ============================================================
INSERT INTO products (sku, name, category_id, unit, sales_price, cost_price, on_hand_qty, min_stock_qty, lead_time_days, procure_on_demand, procurement_type, default_vendor_id, image_url) VALUES
('DT-001', 'Dining Table', 1, 'Units', 8500.00, 5500.00, 1.000, 3.000, 15, true, 'manufacturing', null, '/uploads/products/product-dt-001.png'),
('OC-001', 'Office Chair', 1, 'Units', 4200.00, 2800.00, 10.000, 5.000, 7, false, 'purchase', 2, '/uploads/products/product-oc-001.png'),
('WL-001', 'Wooden Legs', 2, 'Units', 250.00, 150.00, 80.000, 40.000, 5, false, 'purchase', 1, '/uploads/products/product-wl-001.png'),
('WT-001', 'Wooden Top', 2, 'Units', 1200.00, 800.00, 15.000, 10.000, 5, false, 'purchase', 1, '/uploads/products/product-wt-001.png'),
('SC-001', 'Screws (pack of 12)', 2, 'Packs', 50.00, 30.00, 200.000, 100.000, 2, false, 'purchase', 1, '/uploads/products/product-sc-001.png'),
('FB-001', 'Fabric (m)', 3, 'Meters', 120.00, 80.00, 50.000, 20.000, 10, false, 'purchase', 2, '/uploads/products/product-fb-001.png')
ON CONFLICT (sku) DO NOTHING;

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

-- PO-000006: Plastofact IN, on-time but poor quality
INSERT INTO purchase_orders (po_number, vendor_id, responsible_id, status, total_amount, expected_delivery_date, received_at, source_type, created_by, created_at)
VALUES ('PO-000006', 2, 3, 'fully_received', 12000.00, '2026-06-02', '2026-06-01 10:00:00+05:30', 'manual', 3, '2026-05-25 09:00:00+05:30');

INSERT INTO po_lines (po_id, product_id, qty_ordered, qty_received, rejected_qty, unit_price) VALUES
  (6, 6, 100.000, 100.000, 15.000, 120.00);

-- PO-000007: Plastofact IN, late
INSERT INTO purchase_orders (po_number, vendor_id, responsible_id, status, total_amount, expected_delivery_date, received_at, source_type, created_by, created_at)
VALUES ('PO-000007', 2, 3, 'fully_received', 6000.00, '2026-06-10', '2026-06-13 14:00:00+05:30', 'manual', 3, '2026-06-01 09:00:00+05:30');

INSERT INTO po_lines (po_id, product_id, qty_ordered, qty_received, rejected_qty, unit_price) VALUES
  (7, 6, 50.000, 50.000, 2.000, 120.00);

-- PO-000008: ORM Metals, perfect score
INSERT INTO purchase_orders (po_number, vendor_id, responsible_id, status, total_amount, expected_delivery_date, received_at, source_type, created_by, created_at)
VALUES ('PO-000008', 3, 3, 'fully_received', 15000.00, '2026-06-12', '2026-06-11 09:00:00+05:30', 'manual', 3, '2026-06-05 09:00:00+05:30');

-- Let's pretend ORM Metals supplies product 2 (Office Chair) just for mockup
INSERT INTO po_lines (po_id, product_id, qty_ordered, qty_received, rejected_qty, unit_price) VALUES
  (8, 2, 5.000, 5.000, 0.000, 3000.00);

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

-- PO-000006 received
INSERT INTO stock_ledger (product_id, move_type, qty, reference_type, reference_id, reference_number, balance_after, notes, created_by, created_at) VALUES
  (6, 'IN', 85.000, 'PO', 6, 'PO-000006', 85.000, 'PO receipt (15 rejected)', 3, '2026-06-01 10:00:00+05:30');

-- PO-000007 received
INSERT INTO stock_ledger (product_id, move_type, qty, reference_type, reference_id, reference_number, balance_after, notes, created_by, created_at) VALUES
  (6, 'IN', 48.000, 'PO', 7, 'PO-000007', 133.000, 'PO receipt (2 rejected)', 3, '2026-06-13 14:00:00+05:30');

-- PO-000008 received
INSERT INTO stock_ledger (product_id, move_type, qty, reference_type, reference_id, reference_number, balance_after, notes, created_by, created_at) VALUES
  (2, 'IN', 5.000, 'PO', 8, 'PO-000008', 5.000, 'PO receipt', 3, '2026-06-11 09:00:00+05:30');

-- ============================================================
-- Smart Procurement Mockup Data (OUT stock moves last 30d)
-- ============================================================
-- Fabric (FB-001) high consumption
INSERT INTO stock_ledger (product_id, move_type, qty, reference_type, reference_id, reference_number, balance_after, notes, created_by, created_at) VALUES
  (6, 'OUT', 50.000, 'MO', 99, 'MO-DEMO', 83.000, 'MO Consumption', 4, NOW() - INTERVAL '10 days'),
  (6, 'OUT', 40.000, 'MO', 99, 'MO-DEMO', 43.000, 'MO Consumption', 4, NOW() - INTERVAL '4 days'),
  (6, 'OUT', 35.000, 'MO', 99, 'MO-DEMO', 8.000, 'MO Consumption', 4, NOW() - INTERVAL '1 days');
-- Wait, we need to make sure on_hand_qty in products matches these!
-- Fabric on_hand_qty in seed is 50. So 133 - 50 - 40 - 35 = 8.
-- Let's update the final UPDATE products SET at the bottom of the script.

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
UPDATE products SET on_hand_qty = 8.000 WHERE sku = 'FB-001'; -- After the new mockup OUT moves for Fabric

-- ============================================================
-- Demo Completed Manufacturing Order for Product Passports
-- ============================================================
INSERT INTO manufacturing_orders (mo_number, product_id, bom_id, qty, status, assignee_id, schedule_date, source_type, source_ref, confirmed_at, completed_at, created_by, created_at)
VALUES ('MO-000002', 1, 1, 3.000, 'done', 4, '2026-05-18', 'manual', NULL, '2026-05-18 10:00:00+05:30', '2026-05-20 16:30:00+05:30', 4, '2026-05-18 09:00:00+05:30');

INSERT INTO mo_components (mo_id, component_id, qty_required, qty_consumed) VALUES
  (2, 3, 12.000, 12.000),
  (2, 4, 3.000, 3.000),
  (2, 5, 36.000, 36.000);

-- Provide some completed work orders
INSERT INTO work_orders (mo_id, work_center_id, operation_name, duration_mins, real_duration_secs, sequence, status, started_at, completed_at) VALUES
  (2, 1, 'Assembly', 180, 10800, 1, 'done', '2026-05-18 11:00:00+05:30', '2026-05-19 14:00:00+05:30'),
  (2, 2, 'Paint', 90, 5600, 2, 'done', '2026-05-19 15:00:00+05:30', '2026-05-20 10:00:00+05:30'),
  (2, 3, 'Pack', 60, 3600, 3, 'done', '2026-05-20 11:00:00+05:30', '2026-05-20 16:00:00+05:30');

-- The passport for this completed MO
INSERT INTO product_passports (passport_id, mo_id, product_id, batch_number, qty_produced, manufactured_by, manufacture_date, qc_status, qc_notes, qc_reviewed_by, qc_reviewed_at)
VALUES ('PASS-DT-1002', 2, 1, 'BATCH-202605-DT01', 3.000, 4, '2026-05-20 16:30:00+05:30', 'passed', 'All tables pass visual and structural tests.', 1, '2026-05-21 10:00:00+05:30');

-- Passport components (Traceability)
INSERT INTO passport_components (passport_id, component_id, component_name, qty_used, source_vendor_id, source_po_id, batch_reference) VALUES
  (1, 3, 'Wooden Legs', 12.000, 1, 1, 'PO-000001-B1'),
  (1, 4, 'Wooden Top', 3.000, 1, 1, 'PO-000001-B1'),
  (1, 5, 'Screws (pack of 12)', 36.000, 4, 4, 'PO-000004-B1');

-- ============================================================
-- Demo Active Work Orders for Bottleneck Radar
-- ============================================================
-- We will add a few draft MOs that got confirmed, and have active work orders clogging up the Paint and Assembly lines.
INSERT INTO manufacturing_orders (mo_number, product_id, bom_id, qty, status, assignee_id, schedule_date, confirmed_at, created_by, created_at) VALUES
  ('MO-000003', 2, 2, 50.000, 'in_progress', 4, '2026-06-14', '2026-06-13 09:00:00+05:30', 4, '2026-06-13 08:00:00+05:30'),
  ('MO-000004', 1, 1, 20.000, 'in_progress', 4, '2026-06-15', '2026-06-13 10:00:00+05:30', 4, '2026-06-13 09:30:00+05:30');

-- High load on Work Center 1 (Assembly Line: cap 2, so 960 mins)
INSERT INTO work_orders (mo_id, work_center_id, operation_name, duration_mins, sequence, status) VALUES
  (3, 1, 'Assembly - Bulk Chairs', 1200, 1, 'in_progress'), -- Overloads WC-ASM (1200 > 960)
  (3, 3, 'Pack - Bulk Chairs', 300, 2, 'pending');

-- High load on Work Center 2 (Paint Floor: cap 1, so 480 mins)
INSERT INTO work_orders (mo_id, work_center_id, operation_name, duration_mins, sequence, status) VALUES
  (4, 1, 'Assembly - Tables', 400, 1, 'pending'),
  (4, 2, 'Paint - Tables', 600, 2, 'pending'), -- Overloads WC-PNT (600 > 480)
  (4, 3, 'Pack - Tables', 200, 3, 'pending');

-- ============================================================
-- Demo Audit Logs
-- ============================================================
INSERT INTO audit_logs (user_id, module, action, entity_type, entity_id, entity_ref, field_name, old_value, new_value, created_at) VALUES
  (1, 'System', 'Login', 'User', 1, 'admin', NULL, NULL, 'Success', NOW() - INTERVAL '2 days'),
  (2, 'Sales', 'Created', 'SalesOrder', 1, 'SO-000001', NULL, NULL, 'Created SO', NOW() - INTERVAL '1 days'),
  (2, 'Sales', 'Updated', 'SalesOrder', 1, 'SO-000001', 'status', 'draft', 'confirmed', NOW() - INTERVAL '23 hours'),
  (2, 'Sales', 'Created', 'SalesOrder', 2, 'SO-000002', NULL, NULL, 'Created SO', NOW() - INTERVAL '20 hours'),
  (2, 'Sales', 'Updated', 'SalesOrder', 2, 'SO-000002', 'status', 'draft', 'confirmed', NOW() - INTERVAL '19 hours'),
  (2, 'Sales', 'Updated', 'SalesOrder', 2, 'SO-000002', 'status', 'confirmed', 'delivered', NOW() - INTERVAL '18 hours'),
  (1, 'Purchase', 'Created', 'PurchaseOrder', 1, 'PO-000001', NULL, NULL, 'Created PO', NOW() - INTERVAL '5 days'),
  (1, 'Purchase', 'Updated', 'PurchaseOrder', 1, 'PO-000001', 'status', 'draft', 'confirmed', NOW() - INTERVAL '4 days'),
  (1, 'Purchase', 'Updated', 'PurchaseOrder', 1, 'PO-000001', 'status', 'confirmed', 'received', NOW() - INTERVAL '2 days'),
  (3, 'Manufacturing', 'Created', 'ManufacturingOrder', 1, 'MO-000001', NULL, NULL, 'Created MO', NOW() - INTERVAL '2 days'),
  (3, 'Manufacturing', 'Updated', 'ManufacturingOrder', 1, 'MO-000001', 'status', 'draft', 'confirmed', NOW() - INTERVAL '1 days'),
  (3, 'Manufacturing', 'Updated', 'ManufacturingOrder', 1, 'MO-000001', 'status', 'confirmed', 'in_progress', NOW() - INTERVAL '12 hours'),
  (3, 'Manufacturing', 'Updated', 'ManufacturingOrder', 1, 'MO-000001', 'status', 'in_progress', 'done', NOW() - INTERVAL '10 hours');
