const { Router } = require('express');
const { body } = require('express-validator');
const { requireAuth } = require('../../middleware/auth');
const { requireModule, requireAdmin } = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const { query } = require('../../config/db');
const { auditLog } = require('../../middleware/audit');
const { trackChanges } = require('../../services/auditTracker');

const router = Router();
router.use(requireAuth);

const SORTABLE = ['id', 'name', 'email', 'phone', 'created_at'];

function emitSocket(req, event, data) {
  req.app.locals.io?.emit(event, data);
}

// GET /api/vendors
router.get('/', requireModule('Purchase', 'user'), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { search } = req.query;

    let sortField = 'id';
    if (req.query.sort && SORTABLE.includes(req.query.sort)) sortField = req.query.sort;
    const sortOrder = req.query.order === 'desc' ? 'DESC' : 'ASC';

    const conditions = ['is_active = true'];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(name ILIKE $${idx} OR email ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = 'WHERE ' + conditions.join(' AND ');

    const countRes = await query(`SELECT COUNT(*) AS total FROM vendors ${where}`, params);
    const total = parseInt(countRes.rows[0].total);

    const dataRes = await query(
      `SELECT * FROM vendors ${where} ORDER BY ${sortField} ${sortOrder} LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({ rows: dataRes.rows, total, page, limit });
  } catch (err) { next(err); }
});

// GET /api/vendors/:id
router.get('/:id', requireModule('Purchase', 'user'), async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM vendors WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vendor not found' });
    res.json({ vendor: result.rows[0] });
  } catch (err) { next(err); }
});

// GET /api/vendors/:id/performance
router.get('/:id/performance', requireModule('Purchase', 'user'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const reliabilityRes = await query(
      'SELECT * FROM vendor_reliability_view WHERE vendor_id = $1', [id]
    );
    if (reliabilityRes.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const recentPOs = await query(
      `SELECT id, po_number, status, total_amount, expected_delivery_date,
              received_at, created_at
       FROM purchase_orders WHERE vendor_id = $1
       ORDER BY created_at DESC LIMIT 10`,
      [id]
    );

    res.json({
      reliability: reliabilityRes.rows[0],
      recent_purchase_orders: recentPOs.rows,
    });
  } catch (err) { next(err); }
});

// POST /api/vendors
router.post(
  '/',
  requireModule('Purchase', 'admin'),
  validate([
    body('name').trim().isLength({ min: 2, max: 200 }).withMessage('name must be 2-200 chars'),
    body('email').optional({ nullable: true }).trim().isEmail().withMessage('Invalid email'),
    body('phone').optional({ nullable: true }).trim().isLength({ max: 20 }),
    body('gst_number').optional({ nullable: true }).trim().isLength({ max: 20 }),
  ]),
  async (req, res, next) => {
    try {
      const { name, email, phone, address, gst_number } = req.body;
      const result = await query(
        `INSERT INTO vendors (name, email, phone, address, gst_number)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [name, email || null, phone || null, address || null, gst_number || null]
      );
      const vendor = result.rows[0];
      await auditLog(req, {
        module: 'Purchase', action: 'Created', entityType: 'vendor',
        entityId: vendor.id, entityRef: vendor.name,
      });
      emitSocket(req, 'vendor:created', { id: vendor.id });
      res.status(201).json({ vendor });
    } catch (err) { next(err); }
  }
);

// PUT /api/vendors/:id
router.put('/:id', requireModule('Purchase', 'admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const oldResult = await query('SELECT * FROM vendors WHERE id = $1', [id]);
    if (oldResult.rows.length === 0) return res.status(404).json({ error: 'Vendor not found' });
    const oldRow = oldResult.rows[0];

    const { name, email, phone, address, gst_number } = req.body;
    const result = await query(
      `UPDATE vendors SET
         name = COALESCE($1, name), email = COALESCE($2, email),
         phone = COALESCE($3, phone), address = COALESCE($4, address),
         gst_number = COALESCE($5, gst_number)
       WHERE id = $6 RETURNING *`,
      [name, email, phone, address, gst_number, id]
    );
    const newRow = result.rows[0];

    const { pool } = require('../../config/db');
    const client = await pool.connect();
    try {
      await trackChanges(client, req, {
        module: 'Purchase', entityType: 'vendor',
        entityId: parseInt(id), entityRef: newRow.name, oldRow, newRow,
      });
    } finally { client.release(); }

    emitSocket(req, 'vendor:updated', { id: newRow.id });
    res.json({ vendor: newRow });
  } catch (err) { next(err); }
});

// DELETE /api/vendors/:id
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const vendor = await query('SELECT name FROM vendors WHERE id = $1', [id]);
    if (vendor.rows.length === 0) return res.status(404).json({ error: 'Vendor not found' });

    await query('UPDATE vendors SET is_active = false WHERE id = $1', [id]);
    await auditLog(req, {
      module: 'Purchase', action: 'Deleted', entityType: 'vendor',
      entityId: parseInt(id), entityRef: vendor.rows[0].name,
    });
    emitSocket(req, 'vendor:deleted', { id: parseInt(id) });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
