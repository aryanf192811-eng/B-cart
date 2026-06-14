-- 006_erp_overhaul.sql
-- Phase 1 of ERP Single Source of Truth Overhaul

BEGIN;

-- 1. Add OTP infrastructure columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expiry TIMESTAMPTZ;

-- 2. Create product_images table for the new product gallery intelligence
CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one primary image per product using a partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_primary 
ON product_images(product_id) 
WHERE is_primary = true;

COMMIT;
