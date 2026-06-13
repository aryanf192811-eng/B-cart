const { Router } = require('express');
const { body } = require('express-validator');
const { requireAuth } = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const { query } = require('../../config/db');
const { auditLog } = require('../../middleware/audit');
const { trackChanges } = require('../../services/auditTracker');

const router = Router();
router.use(requireAuth);

const SORTABLE = ['id', 'code', 'name', 'capacity_per_hour', 'hourly_cost', 'created_at'];

function emitSocket(req, event, data) {
  req.app.locals.io?.emit(event, data);
}

// GET /api/work-centers
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    let sortField = 'id';
    if (req.query.sort && SORTABLE.includes(req.query.sort)) sortField = req.query.sort;
    const sortOrder = req.query.order === 'desc' ? 'DESC' : 'ASC';

    // Use work_center_load_view for enriched data
    const countRes = await query(
      'SELECT COUNT(*) AS total FROM work_centers WHERE is_active = true'
    );
    const total = parseInt(countRes.rows[0].total);

    const dataRes = await query(
      `SELECT * FROM work_center_load_view
       ORDER BY ${sortField} ${sortOrder}
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({ rows: dataRes.rows, total, page, limit });
  } catch (err) { next(err); }
});

// GET /api/work-centers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM work_center_load_view WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Work center not found' });
    }
    res.json({ work_center: result.rows[0] });
  } catch (err) { next(err); }
});

// POST /api/work-centers
router.post(
  '/',
  requireAdmin,
  validate([
    body('code')
      .trim()
      .isLength({ min: 2, max: 20 }).withMessage('code must be 2-20 chars')
      .matches(/^[A-Z0-9\-]+$/).withMessage('code must be uppercase letters, digits, hyphens'),
    body('name')
      .trim()
      .isLength({ min: 2, max: 150 }).withMessage('name must be 2-150 chars'),
    body('capacity_per_hour')
      .optional()
      .isInt({ min: 1 }).withMessage('capacity must be ≥ 1'),
    body('hourly_cost')
      .optional()
      .isFloat({ min: 0 }).withMessage('hourly_cost must be ≥ 0'),
  ]),
  async (req, res, next) => {
    try {
      const { code, name, capacity_per_hour, hourly_cost } = req.body;
      const result = await query(
        `INSERT INTO work_centers (code, name, capacity_per_hour, hourly_cost)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [code, name, capacity_per_hour || 1, hourly_cost || 0]
      );
      const wc = result.rows[0];
      await auditLog(req, {
        module: 'Manufacturing', action: 'Created', entityType: 'work_center',
        entityId: wc.id, entityRef: wc.code,
      });
      emitSocket(req, 'work_center:created', { id: wc.id });
      res.status(201).json({ work_center: wc });
    } catch (err) { next(err); }
  }
);

// PUT /api/work-centers/:id
router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const oldResult = await query('SELECT * FROM work_centers WHERE id = $1', [id]);
    if (oldResult.rows.length === 0) return res.status(404).json({ error: 'Work center not found' });
    const oldRow = oldResult.rows[0];

    const { code, name, capacity_per_hour, hourly_cost } = req.body;
    const result = await query(
      `UPDATE work_centers SET
         code = COALESCE($1, code), name = COALESCE($2, name),
         capacity_per_hour = COALESCE($3, capacity_per_hour),
         hourly_cost = COALESCE($4, hourly_cost)
       WHERE id = $5 RETURNING *`,
      [code, name, capacity_per_hour, hourly_cost, id]
    );
    const newRow = result.rows[0];

    const { pool } = require('../../config/db');
    const client = await pool.connect();
    try {
      await trackChanges(client, req, {
        module: 'Manufacturing', entityType: 'work_center',
        entityId: parseInt(id), entityRef: newRow.code, oldRow, newRow,
      });
    } finally { client.release(); }

    emitSocket(req, 'work_center:updated', { id: newRow.id });
    res.json({ work_center: newRow });
  } catch (err) { next(err); }
});

// DELETE /api/work-centers/:id
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const wc = await query('SELECT code FROM work_centers WHERE id = $1', [id]);
    if (wc.rows.length === 0) return res.status(404).json({ error: 'Work center not found' });

    await query('UPDATE work_centers SET is_active = false WHERE id = $1', [id]);
    await auditLog(req, {
      module: 'Manufacturing', action: 'Deleted', entityType: 'work_center',
      entityId: parseInt(id), entityRef: wc.rows[0].code,
    });
    emitSocket(req, 'work_center:deleted', { id: parseInt(id) });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
