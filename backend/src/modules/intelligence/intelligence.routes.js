const { Router } = require('express');
const { requireAuth } = require('../../middleware/auth');
const { requireModule } = require('../../middleware/rbac');
const { query } = require('../../config/db');

const router = Router();
router.use(requireAuth);

// ── GET /api/intelligence/procurement-alerts ──────────────────
router.get('/procurement-alerts',
  (req, res, next) => {
    // Allow Purchase OR Manufacturing
    requireModule('Purchase', 'user')(req, res, (err) => {
      if (!err) return next();
      requireModule('Manufacturing', 'user')(req, res, next);
    });
  },
  async (req, res, next) => {
    try {
      const { rows } = await query(`
        SELECT * FROM smart_procurement_view
        WHERE (days_remaining IS NOT NULL AND days_remaining < lead_time_days)
           OR (on_hand_qty + incoming_qty) < min_stock_qty
        ORDER BY days_remaining ASC NULLS LAST
      `);

      const critical_count = rows.filter(r => (parseFloat(r.on_hand_qty) + parseFloat(r.incoming_qty)) < parseFloat(r.min_stock_qty)).length;
      const warning_count = rows.filter(r => r.days_remaining !== null && parseFloat(r.days_remaining) < parseFloat(r.lead_time_days) && (parseFloat(r.on_hand_qty) + parseFloat(r.incoming_qty)) >= parseFloat(r.min_stock_qty)).length;

      res.json({ rows, summary: { critical_count, warning_count } });
    } catch (err) { next(err); }
  }
);

// ── GET /api/intelligence/vendor-scores ───────────────────────
router.get('/vendor-scores',
  requireModule('Purchase', 'user'),
  async (req, res, next) => {
    try {
      const { rows } = await query(`
        SELECT * FROM vendor_reliability_view ORDER BY reliability_score DESC
      `);
      res.json({ rows });
    } catch (err) { next(err); }
  }
);

// ── GET /api/intelligence/bottlenecks ─────────────────────────
router.get('/bottlenecks',
  requireModule('Manufacturing', 'user'),
  async (req, res, next) => {
    try {
      const { rows } = await query(`SELECT * FROM work_center_load_view`);
      const bottleneck_count = rows.filter(r => r.is_bottleneck).length;
      const total_centers = rows.length;
      res.json({ rows, summary: { bottleneck_count, total_centers } });
    } catch (err) { next(err); }
  }
);

// ── GET /api/intelligence/control-tower ───────────────────────
router.get('/control-tower',
  requireAuth,
  async (req, res, next) => {
    try {
      const { rows: alerts } = await query(`
        SELECT
          'STOCK_CRITICAL' AS alert_type,
          1 AS urgency,
          p.name AS subject,
          'Stock critically low: ' || psv.on_hand_qty || ' ' || p.unit || ' (min ' || p.min_stock_qty || ')' AS message,
          'Reorder immediately' AS action,
          'product' AS entity_type,
          p.id AS entity_id,
          p.sku AS entity_ref
        FROM products p
        LEFT JOIN product_stock_view psv ON psv.id = p.id
        WHERE psv.on_hand_qty < p.min_stock_qty AND p.is_active = true

        UNION ALL

        SELECT
          'BOTTLENECK' AS alert_type,
          2 AS urgency,
          wc.name AS subject,
          'Work center at ' || wclv.utilization_pct || '% utilization' AS message,
          'Reschedule or increase capacity' AS action,
          'work_center' AS entity_type,
          wc.id AS entity_id,
          wc.code AS entity_ref
        FROM work_center_load_view wclv
        JOIN work_centers wc ON wc.code = wclv.code
        WHERE wclv.is_bottleneck = true

        UNION ALL

        SELECT
          'DELAYED_ORDER' AS alert_type,
          2 AS urgency,
          so.so_number AS subject,
          'SO confirmed ' || EXTRACT(DAY FROM NOW() - so.confirmed_at) || ' days ago, not yet delivered' AS message,
          'Expedite delivery or contact customer' AS action,
          'sales_order' AS entity_type,
          so.id AS entity_id,
          so.so_number AS entity_ref
        FROM sales_orders so
        WHERE so.status = 'confirmed'
          AND so.confirmed_at < NOW() - INTERVAL '3 days'

        UNION ALL

        SELECT
          'SUPPLIER_RISK' AS alert_type,
          3 AS urgency,
          v.name AS subject,
          'Vendor reliability score: ' || vr.reliability_score || '% (below threshold)' AS message,
          'Consider alternate vendor or escalate' AS action,
          'vendor' AS entity_type,
          v.id AS entity_id,
          v.name AS entity_ref
        FROM vendor_reliability_view vr
        JOIN vendors v ON v.name = vr.name
        WHERE vr.reliability_score < 70 AND vr.total_orders >= 2

        ORDER BY urgency ASC
        LIMIT 50
      `);

      const counts = {
        STOCK_CRITICAL: alerts.filter(a => a.alert_type === 'STOCK_CRITICAL').length,
        BOTTLENECK: alerts.filter(a => a.alert_type === 'BOTTLENECK').length,
        DELAYED_ORDER: alerts.filter(a => a.alert_type === 'DELAYED_ORDER').length,
        SUPPLIER_RISK: alerts.filter(a => a.alert_type === 'SUPPLIER_RISK').length,
      };

      res.json({ alerts, counts });
    } catch (err) { next(err); }
  }
);

module.exports = router;
