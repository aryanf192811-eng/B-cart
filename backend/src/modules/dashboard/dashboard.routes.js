const { Router } = require('express');
const { requireAuth } = require('../../middleware/auth');
const { query } = require('../../config/db');

const router = Router();
router.use(requireAuth);

// ── GET /api/dashboard/kpis ───────────────────────────────────
router.get('/kpis', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [salesRes, purchaseRes, moRes, inventoryRes] = await Promise.all([
      query(`
        SELECT
          COUNT(*) AS "all",
          COUNT(*) FILTER (WHERE status = 'draft') AS "draft",
          COUNT(*) FILTER (WHERE status = 'confirmed') AS "confirmed",
          COUNT(*) FILTER (WHERE status = 'partially_delivered') AS "partially_delivered",
          COUNT(*) FILTER (WHERE status = 'fully_delivered') AS "fully_delivered",
          COUNT(*) FILTER (WHERE status = 'confirmed' AND confirmed_at < NOW() - INTERVAL '3 days') AS "late",
          COUNT(*) FILTER (WHERE salesperson_id = $1) AS "mine",
          COALESCE(SUM(total_amount) FILTER (WHERE status IN ('partially_delivered', 'fully_delivered')), 0) AS "revenue"
        FROM sales_order_view
      `, [userId]),

      query(`
        SELECT
          COUNT(DISTINCT po.id) AS "all",
          COUNT(DISTINCT po.id) FILTER (WHERE po.status = 'draft') AS "draft",
          COUNT(DISTINCT po.id) FILTER (WHERE po.status = 'confirmed') AS "confirmed",
          COUNT(DISTINCT po.id) FILTER (WHERE po.status = 'partially_received') AS "partially_received",
          COUNT(DISTINCT po.id) FILTER (WHERE po.status = 'fully_received') AS "fully_received",
          COUNT(DISTINCT po.id) FILTER (WHERE po.status = 'confirmed' AND po.expected_delivery_date < CURRENT_DATE AND po.status != 'fully_received') AS "late",
          COUNT(DISTINCT po.id) FILTER (WHERE po.responsible_id = $1) AS "mine",
          COALESCE(SUM(pl.qty_received), 0) AS "total_received_qty",
          COALESCE(SUM(pl.rejected_qty), 0) AS "total_rejected_qty"
        FROM purchase_order_view po
        LEFT JOIN po_lines pl ON pl.po_id = po.id
      `, [userId]),

      query(`
        SELECT
          COUNT(*) AS "all",
          COUNT(*) FILTER (WHERE status = 'draft') AS "draft",
          COUNT(*) FILTER (WHERE status = 'confirmed') AS "confirmed",
          COUNT(*) FILTER (WHERE status = 'in_progress') AS "in_progress",
          COUNT(*) FILTER (WHERE status = 'to_close') AS "to_close",
          COUNT(*) FILTER (WHERE status = 'done') AS "done",
          COUNT(*) FILTER (WHERE schedule_date < CURRENT_DATE AND status NOT IN ('done','cancelled')) AS "late",
          COUNT(*) FILTER (WHERE assignee_id IS NULL AND status NOT IN ('done','cancelled')) AS "not_assigned",
          COUNT(*) FILTER (WHERE assignee_id = $1) AS "mine"
        FROM manufacturing_orders
      `, [userId]),

      query(`
        SELECT
          COUNT(*) AS total_products,
          COUNT(*) FILTER (WHERE on_hand_qty < min_stock_qty) AS low_stock_count,
          COALESCE(SUM(on_hand_qty * cost_price), 0) AS total_value
        FROM product_stock_view
        WHERE is_active = true
      `),
    ]);

    res.json({
      sales: salesRes.rows[0],
      purchase: purchaseRes.rows[0],
      manufacturing: moRes.rows[0],
      inventory: inventoryRes.rows[0],
    });
  } catch (err) { next(err); }
});

module.exports = router;
