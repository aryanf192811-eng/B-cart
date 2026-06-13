-- 001_init.sql — Core schema for ForgeOps Mini ERP

-- 1. roles
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  login_id VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role_id INTEGER REFERENCES roles(id),
  position VARCHAR(100),
  address TEXT,
  mobile VARCHAR(20),
  avatar_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. user_module_access
CREATE TABLE IF NOT EXISTS user_module_access (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  module VARCHAR(50) NOT NULL,
  access_level VARCHAR(10) CHECK (access_level IN ('admin','user','none')),
  UNIQUE(user_id, module)
);

-- 4. vendors
CREATE TABLE IF NOT EXISTS vendors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(20),
  address TEXT,
  gst_number VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. customers
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(20),
  address TEXT,
  gst_number VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. work_centers
CREATE TABLE IF NOT EXISTS work_centers (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  capacity_per_hour INTEGER DEFAULT 1,
  hourly_cost DECIMAL(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. products
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  unit VARCHAR(20) DEFAULT 'Units',
  sales_price DECIMAL(12,2) DEFAULT 0,
  cost_price DECIMAL(12,2) DEFAULT 0,
  on_hand_qty DECIMAL(12,3) DEFAULT 0,
  min_stock_qty DECIMAL(12,3) DEFAULT 0,
  lead_time_days INTEGER DEFAULT 7,
  procure_on_demand BOOLEAN DEFAULT false,
  procurement_type VARCHAR(20) CHECK (procurement_type IN ('purchase','manufacturing') OR procurement_type IS NULL),
  default_vendor_id INTEGER REFERENCES vendors(id),
  default_bom_id INTEGER,  -- FK added after bom table creation
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. bom
CREATE TABLE IF NOT EXISTS bom (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(20) UNIQUE NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty_produced DECIMAL(12,3) DEFAULT 1,
  status VARCHAR(20) DEFAULT 'confirmed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add deferred FK from products to bom
ALTER TABLE products ADD CONSTRAINT fk_products_default_bom
  FOREIGN KEY (default_bom_id) REFERENCES bom(id);

-- 9. bom_components
CREATE TABLE IF NOT EXISTS bom_components (
  id SERIAL PRIMARY KEY,
  bom_id INTEGER NOT NULL REFERENCES bom(id) ON DELETE CASCADE,
  component_id INTEGER NOT NULL REFERENCES products(id),
  qty DECIMAL(12,3) NOT NULL
);

-- 10. bom_operations
CREATE TABLE IF NOT EXISTS bom_operations (
  id SERIAL PRIMARY KEY,
  bom_id INTEGER NOT NULL REFERENCES bom(id) ON DELETE CASCADE,
  work_center_id INTEGER NOT NULL REFERENCES work_centers(id),
  name VARCHAR(150) NOT NULL,
  duration_mins INTEGER NOT NULL,
  sequence INTEGER NOT NULL
);

-- 11. sales_orders
CREATE TABLE IF NOT EXISTS sales_orders (
  id SERIAL PRIMARY KEY,
  so_number VARCHAR(20) UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  salesperson_id INTEGER REFERENCES users(id),
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','confirmed','partially_delivered','fully_delivered','cancelled')),
  total_amount DECIMAL(14,2) DEFAULT 0,
  confirmed_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. so_lines
CREATE TABLE IF NOT EXISTS so_lines (
  id SERIAL PRIMARY KEY,
  so_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty_ordered DECIMAL(12,3) NOT NULL,
  qty_delivered DECIMAL(12,3) DEFAULT 0,
  unit_price DECIMAL(12,2) NOT NULL,
  CHECK (qty_delivered <= qty_ordered)
);

-- 13. purchase_orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  po_number VARCHAR(20) UNIQUE NOT NULL,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  responsible_id INTEGER REFERENCES users(id),
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','confirmed','partially_received','fully_received','cancelled')),
  total_amount DECIMAL(14,2) DEFAULT 0,
  expected_delivery_date DATE,
  received_at TIMESTAMPTZ,
  source_type VARCHAR(20),
  source_ref VARCHAR(50),
  razorpay_order_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  payment_status VARCHAR(20) DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','paid','refunded')),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. po_lines
CREATE TABLE IF NOT EXISTS po_lines (
  id SERIAL PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty_ordered DECIMAL(12,3) NOT NULL,
  qty_received DECIMAL(12,3) DEFAULT 0,
  rejected_qty DECIMAL(12,3) DEFAULT 0,
  unit_price DECIMAL(12,2) NOT NULL,
  CHECK (qty_received <= qty_ordered)
);

-- 15. manufacturing_orders
CREATE TABLE IF NOT EXISTS manufacturing_orders (
  id SERIAL PRIMARY KEY,
  mo_number VARCHAR(20) UNIQUE NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  bom_id INTEGER REFERENCES bom(id),
  qty DECIMAL(12,3) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','confirmed','in_progress','to_close','done','cancelled')),
  assignee_id INTEGER REFERENCES users(id),
  schedule_date DATE,
  source_type VARCHAR(20),
  source_ref VARCHAR(50),
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. mo_components
CREATE TABLE IF NOT EXISTS mo_components (
  id SERIAL PRIMARY KEY,
  mo_id INTEGER NOT NULL REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
  component_id INTEGER NOT NULL REFERENCES products(id),
  qty_required DECIMAL(12,3) NOT NULL,
  qty_consumed DECIMAL(12,3) DEFAULT 0
);

-- 17. work_orders
CREATE TABLE IF NOT EXISTS work_orders (
  id SERIAL PRIMARY KEY,
  mo_id INTEGER NOT NULL REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
  work_center_id INTEGER NOT NULL REFERENCES work_centers(id),
  operation_name VARCHAR(150) NOT NULL,
  duration_mins INTEGER NOT NULL,
  real_duration_secs INTEGER DEFAULT 0,
  sequence INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','paused','done')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 18. work_order_time_logs
CREATE TABLE IF NOT EXISTS work_order_time_logs (
  id SERIAL PRIMARY KEY,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  action VARCHAR(10) CHECK (action IN ('start','pause','resume','done')) NOT NULL,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. stock_ledger
CREATE TABLE IF NOT EXISTS stock_ledger (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  move_type VARCHAR(15) NOT NULL
    CHECK (move_type IN ('IN','OUT','RESERVE','UNRESERVE','ADJUST')),
  qty DECIMAL(12,3) NOT NULL,
  reference_type VARCHAR(30),
  reference_id INTEGER,
  reference_number VARCHAR(20),
  balance_after DECIMAL(12,3),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  module VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  entity_ref VARCHAR(50),
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
