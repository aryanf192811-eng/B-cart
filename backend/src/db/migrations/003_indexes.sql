-- 003_indexes.sql — Performance indexes

CREATE INDEX idx_stock_ledger_product_date ON stock_ledger(product_id, created_at DESC);
CREATE INDEX idx_stock_ledger_move_type ON stock_ledger(move_type);
CREATE INDEX idx_stock_ledger_ref ON stock_ledger(reference_type, reference_id);
CREATE INDEX idx_so_status ON sales_orders(status);
CREATE INDEX idx_so_salesperson ON sales_orders(salesperson_id);
CREATE INDEX idx_po_vendor ON purchase_orders(vendor_id, status);
CREATE INDEX idx_po_responsible ON purchase_orders(responsible_id);
CREATE INDEX idx_wo_work_center ON work_orders(work_center_id, status);
CREATE INDEX idx_mo_status ON manufacturing_orders(status);
CREATE INDEX idx_mo_assignee ON manufacturing_orders(assignee_id);
CREATE INDEX idx_audit_module_date ON audit_logs(module, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
