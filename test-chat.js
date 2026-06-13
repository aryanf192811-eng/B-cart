const { query } = require('./backend/src/config/db');

async function test() {
  try {
    await query(`
      CREATE OR REPLACE VIEW vendor_reliability_view AS
      SELECT
        v.id AS vendor_id, v.name,
        COUNT(DISTINCT po.id) AS total_orders,
        COUNT(DISTINCT CASE WHEN po.status IN ('fully_received','partially_received') THEN po.id END) AS completed_orders,
        COALESCE(ROUND(AVG(CASE WHEN po.status = 'fully_received'
             AND po.received_at::date <= po.expected_delivery_date THEN 100.0 ELSE 0 END)::numeric, 1), 0) AS on_time_rate,
        COALESCE(ROUND((SUM(pol.qty_received) * 100.0 / NULLIF(SUM(pol.qty_ordered), 0))::numeric, 1), 0) AS fulfillment_rate,
        COALESCE(ROUND((100.0 - SUM(COALESCE(pol.rejected_qty, 0)) * 100.0 / NULLIF(SUM(pol.qty_received), 0))::numeric, 1), 100) AS quality_rate,
        COALESCE(ROUND((
          AVG(CASE WHEN po.received_at::date <= po.expected_delivery_date THEN 100.0 ELSE 0 END) * 0.5
          + (SUM(pol.qty_received) * 100.0 / NULLIF(SUM(pol.qty_ordered), 0)) * 0.3
          + (100.0 - SUM(COALESCE(pol.rejected_qty, 0)) * 100.0 / NULLIF(SUM(pol.qty_received), 0)) * 0.2
        )::numeric, 1), 0) AS reliability_score
      FROM vendors v
      LEFT JOIN purchase_orders po ON po.vendor_id = v.id AND po.status != 'draft'
      LEFT JOIN po_lines pol ON pol.po_id = po.id
      GROUP BY v.id, v.name;
    `);
    
    const res = await query(`SELECT name, reliability_score FROM vendor_reliability_view LIMIT 5`);
    console.log("Success view!", res.rows);
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
test();
