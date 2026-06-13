const { Router } = require('express');
const { requireAuth } = require('../../middleware/auth');
const { query } = require('../../config/db');

const router = Router();
router.use(requireAuth);

// ── GET /api/audit ────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const conditions = [], params = [];
    let idx = 1;

    if (req.query.module)      { conditions.push(`al.module = $${idx++}`);      params.push(req.query.module); }
    if (req.query.user_id)     { conditions.push(`al.user_id = $${idx++}`);     params.push(req.query.user_id); }
    if (req.query.action)      { conditions.push(`al.action = $${idx++}`);      params.push(req.query.action); }
    if (req.query.entity_type) { conditions.push(`al.entity_type = $${idx++}`); params.push(req.query.entity_type); }
    if (req.query.from)        { conditions.push(`al.created_at >= $${idx++}`); params.push(req.query.from); }
    if (req.query.to)          { conditions.push(`al.created_at <= $${idx++}::date + INTERVAL '1 day'`); params.push(req.query.to); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRes = await query(`SELECT COUNT(*) AS total FROM audit_logs al ${where}`, params);
    const total = parseInt(countRes.rows[0].total);

    const { rows } = await query(
      `SELECT al.*, u.full_name AS user_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({ rows, total, page, limit });
  } catch (err) { next(err); }
});

// ── GET /api/audit/stats ──────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const conditions = [], params = [];
    let idx = 1;
    if (req.query.from) { conditions.push(`created_at >= $${idx++}`); params.push(req.query.from); }
    if (req.query.to)   { conditions.push(`created_at <= $${idx++}::date + INTERVAL '1 day'`); params.push(req.query.to); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await query(`
      SELECT
        COUNT(*) AS total_logs,
        COUNT(*) FILTER (WHERE action = 'Created') AS records_created,
        COUNT(*) FILTER (WHERE action = 'Updated') AS records_updated,
        COUNT(*) FILTER (WHERE action IN ('Deleted', 'Status_Changed')) AS records_changed
      FROM audit_logs ${where}
    `, params);

    res.json({ stats: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
