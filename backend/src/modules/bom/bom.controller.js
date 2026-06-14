const { query, withTransaction } = require('../../config/db');
const { auditLog } = require('../../middleware/audit');
const { nextNumber } = require('../../utils/sequence');

function emitSocket(req, event, data) {
  req.app.locals.io?.emit(event, data);
}

// ── GET /api/bom ────────────────────────────────────────────
async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { search, product_id } = req.query;

    const SORTABLE = ['id', 'reference', 'created_at'];
    let sortField = 'b.id';
    if (req.query.sort && SORTABLE.includes(req.query.sort)) sortField = `b.${req.query.sort}`;
    const sortOrder = req.query.order === 'desc' ? 'DESC' : 'ASC';

    const conditions = [];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(b.reference ILIKE $${idx} OR p.name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (product_id) {
      conditions.push(`b.product_id = $${idx}`);
      params.push(product_id);
      idx++;
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRes = await query(
      `SELECT COUNT(*) AS total FROM bom b
       JOIN products p ON p.id = b.product_id ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].total);

    const dataRes = await query(
      `SELECT b.*, p.name AS product_name, p.sku AS product_sku,
              (SELECT COUNT(*) FROM bom_components WHERE bom_id = b.id) AS component_count,
              (SELECT COUNT(*) FROM bom_operations WHERE bom_id = b.id) AS operation_count
       FROM bom b
       JOIN products p ON p.id = b.product_id
       ${where}
       ORDER BY ${sortField} ${sortOrder}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({ rows: dataRes.rows, total, page, limit });
  } catch (err) { next(err); }
}

// ── GET /api/bom/:id ────────────────────────────────────────
async function getById(req, res, next) {
  try {
    const { id } = req.params;

    const bomResult = await query(
      `SELECT b.*, p.name AS product_name, p.sku AS product_sku
       FROM bom b JOIN products p ON p.id = b.product_id
       WHERE b.id = $1`,
      [id]
    );
    if (bomResult.rows.length === 0) {
      return res.status(404).json({ error: 'BoM not found' });
    }

    const components = await query(
      `SELECT bc.*, p.name AS component_name, p.sku AS component_sku,
              psv.on_hand_qty,
              COALESCE(psv.free_to_use_qty, 0) AS free_to_use_qty
       FROM bom_components bc
       JOIN products p ON p.id = bc.component_id
       LEFT JOIN product_stock_view psv ON psv.id = bc.component_id
       WHERE bc.bom_id = $1
       ORDER BY bc.id`,
      [id]
    );

    const operations = await query(
      `SELECT bo.*, wc.name AS work_center_name, wc.code AS work_center_code
       FROM bom_operations bo
       JOIN work_centers wc ON wc.id = bo.work_center_id
       WHERE bo.bom_id = $1
       ORDER BY bo.sequence`,
      [id]
    );

    const bom = bomResult.rows[0];
    bom.components = components.rows;
    bom.operations = operations.rows;

    res.json({ bom });
  } catch (err) { next(err); }
}

// ── POST /api/bom ───────────────────────────────────────────
async function create(req, res, next) {
  try {
    const { product_id, qty_produced, components, operations } = req.body;
    let { reference } = req.body;

    // Validate components non-empty
    if (!components || !Array.isArray(components) || components.length === 0) {
      return res.status(400).json({ error: 'components array must be non-empty' });
    }

    // Validate no self-loop
    for (const c of components) {
      if (parseInt(c.component_id) === parseInt(product_id)) {
        return res.status(400).json({
          error: 'Component cannot be the same as the finished product (self-loop)',
        });
      }
    }

    // Validate operations sequences unique
    if (operations && operations.length > 0) {
      const seqs = operations.map((o) => o.sequence);
      if (new Set(seqs).size !== seqs.length) {
        return res.status(400).json({ error: 'Operation sequences must be unique' });
      }
      if (seqs.some((s) => s < 1)) {
        return res.status(400).json({ error: 'Operation sequence must be ≥ 1' });
      }
    }

    const bom = await withTransaction(async (client) => {
      // Auto-generate reference if not provided
      if (!reference) {
        reference = await nextNumber(client, 'BOM', 'bom', 'reference');
      }

      // Verify product exists
      const productCheck = await client.query(
        'SELECT id FROM products WHERE id = $1', [product_id]
      );
      if (productCheck.rows.length === 0) {
        const err = new Error('Product not found');
        err.code = 'NOT_FOUND'; err.status = 404; throw err;
      }

      // Insert bom
      const { rows } = await client.query(
        `INSERT INTO bom (reference, product_id, qty_produced)
         VALUES ($1, $2, $3) RETURNING *`,
        [reference, product_id, qty_produced || 1]
      );
      const bomRow = rows[0];

      // Insert components
      for (const c of components) {
        await client.query(
          `INSERT INTO bom_components (bom_id, component_id, qty)
           VALUES ($1, $2, $3)`,
          [bomRow.id, c.component_id, c.qty]
        );
      }

      // Insert operations
      if (operations && operations.length > 0) {
        for (const op of operations) {
          await client.query(
            `INSERT INTO bom_operations (bom_id, work_center_id, name, duration_mins, sequence)
             VALUES ($1, $2, $3, $4, $5)`,
            [bomRow.id, op.work_center_id, op.name, op.duration_mins, op.sequence]
          );
        }
      }

      // Audit
      await client.query(
        `INSERT INTO audit_logs
           (user_id, module, action, entity_type, entity_id, entity_ref)
         VALUES ($1, 'BoM', 'Created', 'bom', $2, $3)`,
        [req.user?.id, bomRow.id, bomRow.reference]
      );

      return bomRow;
    });

    emitSocket(req, 'bom:created', { id: bom.id });
    res.status(201).json({ bom });
  } catch (err) { next(err); }
}

// ── PUT /api/bom/:id ────────────────────────────────────────
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { product_id, qty_produced, components, operations } = req.body;

    // Validate self-loop if components provided
    if (components) {
      const pid = product_id || (await query('SELECT product_id FROM bom WHERE id=$1', [id])).rows[0]?.product_id;
      for (const c of components) {
        if (parseInt(c.component_id) === parseInt(pid)) {
          return res.status(400).json({
            error: 'Component cannot be the same as the finished product (self-loop)',
          });
        }
      }
    }

    const bom = await withTransaction(async (client) => {
      const oldResult = await client.query('SELECT * FROM bom WHERE id = $1 FOR UPDATE', [id]);
      if (oldResult.rows.length === 0) {
        const err = new Error('BoM not found');
        err.code = 'NOT_FOUND'; err.status = 404; throw err;
      }

      const { rows } = await client.query(
        `UPDATE bom SET
           product_id = COALESCE($1, product_id),
           qty_produced = COALESCE($2, qty_produced)
         WHERE id = $3 RETURNING *`,
        [product_id, qty_produced, id]
      );
      const bomRow = rows[0];

      // Replace components if provided
      if (components && Array.isArray(components)) {
        await client.query('DELETE FROM bom_components WHERE bom_id = $1', [id]);
        for (const c of components) {
          await client.query(
            'INSERT INTO bom_components (bom_id, component_id, qty) VALUES ($1,$2,$3)',
            [id, c.component_id, c.qty]
          );
        }

        await client.query(
          `INSERT INTO audit_logs
             (user_id, module, action, entity_type, entity_id, entity_ref, field_name, new_value)
           VALUES ($1, 'BoM', 'Updated', 'bom', $2, $3, 'components', $4)`,
          [req.user?.id, bomRow.id, bomRow.reference, JSON.stringify(components)]
        );
      }

      // Replace operations if provided
      if (operations && Array.isArray(operations)) {
        await client.query('DELETE FROM bom_operations WHERE bom_id = $1', [id]);
        for (const op of operations) {
          await client.query(
            `INSERT INTO bom_operations (bom_id, work_center_id, name, duration_mins, sequence)
             VALUES ($1,$2,$3,$4,$5)`,
            [id, op.work_center_id, op.name, op.duration_mins, op.sequence]
          );
        }

        await client.query(
          `INSERT INTO audit_logs
             (user_id, module, action, entity_type, entity_id, entity_ref, field_name, new_value)
           VALUES ($1, 'BoM', 'Updated', 'bom', $2, $3, 'operations', $4)`,
          [req.user?.id, bomRow.id, bomRow.reference, JSON.stringify(operations)]
        );
      }

      return bomRow;
    });

    emitSocket(req, 'bom:updated', { id: bom.id });
    res.json({ bom });
  } catch (err) { next(err); }
}

// ── DELETE /api/bom/:id ─────────────────────────────────────
async function remove(req, res, next) {
  try {
    const { id } = req.params;

    const bomResult = await query('SELECT reference FROM bom WHERE id = $1', [id]);
    if (bomResult.rows.length === 0) {
      return res.status(404).json({ error: 'BoM not found' });
    }

    // Block if referenced by MOs
    const moCount = await query(
      'SELECT COUNT(*) AS cnt FROM manufacturing_orders WHERE bom_id = $1',
      [id]
    );
    if (parseInt(moCount.rows[0].cnt) > 0) {
      return res.status(409).json({
        error: `BoM in use by ${moCount.rows[0].cnt} MO${parseInt(moCount.rows[0].cnt) > 1 ? 's' : ''}`,
      });
    }

    // Also clear default_bom_id references
    await query('UPDATE products SET default_bom_id = NULL WHERE default_bom_id = $1', [id]);

    // Hard delete (cascades components + operations)
    await query('DELETE FROM bom WHERE id = $1', [id]);

    await auditLog(req, {
      module: 'BoM', action: 'Deleted', entityType: 'bom',
      entityId: parseInt(id), entityRef: bomResult.rows[0].reference,
    });

    emitSocket(req, 'bom:deleted', { id: parseInt(id) });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { list, getById, create, update, remove };
