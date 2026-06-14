const { Router } = require('express');
const { body } = require('express-validator');
const { requireAuth } = require('../../middleware/auth');
const { requireModule } = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const { query, withTransaction } = require('../../config/db');
const { auditLog } = require('../../middleware/audit');
const { writeStockMove } = require('../../services/stockLedger');

const router = Router();
router.use(requireAuth);

// ── GET /api/inventory/ledger ─────────────────────────────────
router.get('/ledger', requireModule('Purchase', 'user'), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const conditions = [], params = [];
    let idx = 1;

    if (req.query.product_id) { conditions.push(`sl.product_id = $${idx++}`); params.push(req.query.product_id); }
    if (req.query.move_type)  { conditions.push(`sl.move_type = $${idx++}`);  params.push(req.query.move_type); }
    if (req.query.from)       { conditions.push(`sl.created_at >= $${idx++}`); params.push(req.query.from); }
    if (req.query.to)         { conditions.push(`sl.created_at <= $${idx++}::date + INTERVAL '1 day'`); params.push(req.query.to); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRes = await query(`SELECT COUNT(*) AS total FROM stock_ledger sl ${where}`, params);
    const total = parseInt(countRes.rows[0].total);

    const { rows } = await query(
      `SELECT sl.*, p.name AS product_name, p.sku, u.full_name AS user_name
       FROM stock_ledger sl
       JOIN products p ON p.id = sl.product_id
       LEFT JOIN users u ON u.id = sl.created_by
       ${where}
       ORDER BY sl.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({ rows, total, page, limit });
  } catch (err) { next(err); }
});

// ── GET /api/inventory/summary ────────────────────────────────
router.get('/summary', requireModule('Purchase', 'user'), async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT p.id, p.name, p.sku, p.unit, p.cost_price,
             p.on_hand_qty,
             COALESCE(psv.free_to_use_qty, 0) AS free_to_use_qty,
             p.on_hand_qty * p.cost_price AS total_value,
             COALESCE(SUM(CASE WHEN sl.move_type = 'IN'  AND sl.created_at >= NOW() - INTERVAL '30 days' THEN sl.qty ELSE 0 END), 0) AS incoming_30d,
             COALESCE(SUM(CASE WHEN sl.move_type = 'OUT' AND sl.created_at >= NOW() - INTERVAL '30 days' THEN sl.qty ELSE 0 END), 0) AS outgoing_30d
      FROM products p
      LEFT JOIN product_stock_view psv ON psv.id = p.id
      LEFT JOIN stock_ledger sl ON sl.product_id = p.id
      WHERE p.is_active = true
      GROUP BY p.id, p.name, p.sku, p.unit, p.cost_price, p.on_hand_qty, psv.free_to_use_qty
      ORDER BY p.name
    `);

    res.json({ rows });
  } catch (err) { next(err); }
});

// ── POST /api/inventory/adjust ────────────────────────────────
router.post('/adjust',
  requireModule('Purchase', 'admin'),
  validate([
    body('product_id').isInt({ min: 1 }).withMessage('product_id required'),
    body('delta_qty').isFloat().withMessage('delta_qty required'),
    body('notes').optional().isString(),
  ]),
  async (req, res, next) => {
    try {
      const { product_id, delta_qty, notes } = req.body;
      if (delta_qty === 0) return res.status(400).json({ error: 'delta_qty cannot be 0' });

      const result = await withTransaction(async (client) => {
        await writeStockMove(client, {
          productId: product_id,
          moveType: 'ADJUST',
          qty: delta_qty,
          referenceType: 'MANUAL',
          referenceNumber: 'MANUAL',
          userId: req.user.id,
          notes,
        });

        await auditLog(req, {
          module: 'Inventory', action: 'Updated', entityType: 'product',
          entityId: product_id, entityRef: 'MANUAL_ADJUST', fieldName: 'on_hand_qty',
          newValue: delta_qty.toString(),
        });

        return { adjusted: true, delta_qty };
      });

      res.json(result);
    } catch (err) { next(err); }
  }
);

module.exports = router;
