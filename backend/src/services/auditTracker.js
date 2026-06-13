/**
 * Centralized audit-diff tracker used by every controller.
 * Compares oldRow vs newRow for tracked fields and inserts one
 * audit_logs row per changed field.
 */

const TRACKED = {
  product: [
    'name', 'sales_price', 'cost_price', 'min_stock_qty', 'lead_time_days',
    'procure_on_demand', 'procurement_type', 'default_vendor_id', 'default_bom_id',
  ],
  vendor: ['name', 'email', 'phone', 'address', 'gst_number'],
  customer: ['name', 'email', 'phone', 'address', 'gst_number'],
  bom: ['reference', 'product_id', 'qty_produced'],
  work_center: ['code', 'name', 'capacity_per_hour', 'hourly_cost'],
};

/**
 * @param {import('pg').PoolClient} client
 * @param {Object} req - Express request (for req.user.id)
 * @param {Object} opts
 * @param {string} opts.module       - e.g. 'Product', 'Purchase'
 * @param {string} opts.entityType   - key in TRACKED map
 * @param {number} opts.entityId
 * @param {string} opts.entityRef    - e.g. SKU or reference
 * @param {Object} opts.oldRow
 * @param {Object} opts.newRow
 */
async function trackChanges(client, req, {
  module,
  entityType,
  entityId,
  entityRef,
  oldRow,
  newRow,
}) {
  const fields = TRACKED[entityType] || [];
  for (const f of fields) {
    if (String(oldRow[f] ?? '') !== String(newRow[f] ?? '')) {
      await client.query(
        `INSERT INTO audit_logs
           (user_id, module, action, entity_type, entity_id,
            entity_ref, field_name, old_value, new_value)
         VALUES ($1, $2, 'Updated', $3, $4, $5, $6, $7, $8)`,
        [
          req.user?.id || null,
          module,
          entityType,
          entityId,
          entityRef,
          f,
          String(oldRow[f] ?? ''),
          String(newRow[f] ?? ''),
        ]
      );
    }
  }
}

module.exports = { trackChanges, TRACKED };
