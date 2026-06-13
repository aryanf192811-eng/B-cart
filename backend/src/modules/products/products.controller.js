const { query, withTransaction } = require('../../config/db');
const { writeStockMove } = require('../../services/stockLedger');
const { auditLog } = require('../../middleware/audit');
const { trackChanges } = require('../../services/auditTracker');

// ── helpers ─────────────────────────────────────────────────
const SORTABLE = ['id', 'sku', 'name', 'category', 'sales_price', 'cost_price',
  'on_hand_qty', 'min_stock_qty', 'created_at'];

function emitSocket(req, event, data) {
  req.app.locals.io?.emit(event, data);
}

// ── GET /api/products ───────────────────────────────────────
async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { search, category, low_stock } = req.query;

    let sortField = 'id';
    if (req.query.sort && SORTABLE.includes(req.query.sort)) sortField = req.query.sort;
    const sortOrder = req.query.order === 'desc' ? 'DESC' : 'ASC';

    const conditions = [];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(name ILIKE $${idx} OR sku ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (category) {
      conditions.push(`category = $${idx}`);
      params.push(category);
      idx++;
    }
    if (low_stock === 'true') {
      conditions.push('is_low_stock = true');
    }

    const where = conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : '';

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM product_stock_view WHERE 1=1 ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    const dataResult = await query(
      `SELECT * FROM product_stock_view WHERE 1=1 ${where}
       ORDER BY ${sortField} ${sortOrder}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({ rows: dataResult.rows, total, page, limit });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/products/:id ───────────────────────────────────
async function getById(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT * FROM product_stock_view WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const bomCount = await query(
      'SELECT COUNT(*) AS cnt FROM bom WHERE product_id = $1',
      [id]
    );

    const product = result.rows[0];
    product.bom_count = parseInt(bomCount.rows[0].cnt);

    res.json({ product });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/products ──────────────────────────────────────
async function create(req, res, next) {
  try {
    const {
      sku, name, category, unit, sales_price, cost_price,
      on_hand_qty, min_stock_qty, lead_time_days,
      procure_on_demand, procurement_type, default_vendor_id, default_bom_id,
    } = req.body;

    const product = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO products
           (sku, name, category, unit, sales_price, cost_price,
            on_hand_qty, min_stock_qty, lead_time_days,
            procure_on_demand, procurement_type, default_vendor_id, default_bom_id)
         VALUES ($1,$2,$3,$4,$5,$6, $7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [
          sku, name, category || null, unit || 'Units',
          sales_price || 0, cost_price || 0,
          0, // always start at 0 — opening stock via ledger
          min_stock_qty || 0, lead_time_days || 7,
          procure_on_demand || false, procurement_type || null,
          default_vendor_id || null, default_bom_id || null,
        ]
      );

      const p = rows[0];

      // If there's opening stock, write an ADJUST move
      const openingQty = parseFloat(on_hand_qty) || 0;
      if (openingQty > 0) {
        await writeStockMove(client, {
          productId: p.id,
          moveType: 'ADJUST',
          qty: openingQty,
          referenceType: 'MANUAL',
          referenceNumber: null,
          userId: req.user?.id,
          notes: 'Opening stock',
        });
      }

      // Audit
      await client.query(
        `INSERT INTO audit_logs
           (user_id, module, action, entity_type, entity_id, entity_ref)
         VALUES ($1, 'Product', 'Created', 'product', $2, $3)`,
        [req.user?.id, p.id, p.sku]
      );

      return p;
    });

    emitSocket(req, 'product:created', { id: product.id });
    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/products/:id ───────────────────────────────────
async function update(req, res, next) {
  try {
    const { id } = req.params;

    const product = await withTransaction(async (client) => {
      const oldResult = await client.query(
        'SELECT * FROM products WHERE id = $1 FOR UPDATE', [id]
      );
      if (oldResult.rows.length === 0) {
        const err = new Error('Product not found');
        err.code = 'NOT_FOUND'; err.status = 404; throw err;
      }
      const oldRow = oldResult.rows[0];

      const {
        name, category, unit, sales_price, cost_price,
        on_hand_qty, min_stock_qty, lead_time_days,
        procure_on_demand, procurement_type, default_vendor_id, default_bom_id,
      } = req.body;

      // Handle on_hand_qty change via stock ledger
      const newOnHand = on_hand_qty !== undefined ? parseFloat(on_hand_qty) : null;
      const oldOnHand = parseFloat(oldRow.on_hand_qty);

      if (newOnHand !== null && newOnHand !== oldOnHand) {
        const delta = newOnHand - oldOnHand;
        await writeStockMove(client, {
          productId: parseInt(id),
          moveType: 'ADJUST',
          qty: delta,
          referenceType: 'MANUAL',
          referenceNumber: null,
          userId: req.user?.id,
          notes: `Manual adjustment: ${oldOnHand} → ${newOnHand}`,
        });
      }

      const { rows } = await client.query(
        `UPDATE products SET
           name = COALESCE($1, name),
           category = COALESCE($2, category),
           unit = COALESCE($3, unit),
           sales_price = COALESCE($4, sales_price),
           cost_price = COALESCE($5, cost_price),
           min_stock_qty = COALESCE($6, min_stock_qty),
           lead_time_days = COALESCE($7, lead_time_days),
           procure_on_demand = COALESCE($8, procure_on_demand),
           procurement_type = COALESCE($9, procurement_type),
           default_vendor_id = $10,
           default_bom_id = $11,
           updated_at = NOW()
         WHERE id = $12
         RETURNING *`,
        [
          name, category, unit, sales_price, cost_price,
          min_stock_qty, lead_time_days, procure_on_demand, procurement_type,
          default_vendor_id !== undefined ? default_vendor_id : oldRow.default_vendor_id,
          default_bom_id !== undefined ? default_bom_id : oldRow.default_bom_id,
          id,
        ]
      );
      const newRow = rows[0];

      await trackChanges(client, req, {
        module: 'Product',
        entityType: 'product',
        entityId: parseInt(id),
        entityRef: newRow.sku,
        oldRow,
        newRow,
      });

      return newRow;
    });

    emitSocket(req, 'product:updated', { id: product.id });
    res.json({ product });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/products/:id ────────────────────────────────
async function remove(req, res, next) {
  try {
    const { id } = req.params;

    // Check references
    const refs = await query(
      `SELECT
        (SELECT COUNT(*) FROM so_lines WHERE product_id=$1) +
        (SELECT COUNT(*) FROM po_lines WHERE product_id=$1) +
        (SELECT COUNT(*) FROM mo_components WHERE component_id=$1) +
        (SELECT COUNT(*) FROM bom_components WHERE component_id=$1) AS cnt`,
      [id]
    );

    const product = await query('SELECT sku FROM products WHERE id = $1', [id]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Soft delete
    await query(
      'UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    await auditLog(req, {
      module: 'Product',
      action: 'Deleted',
      entityType: 'product',
      entityId: parseInt(id),
      entityRef: product.rows[0].sku,
    });

    emitSocket(req, 'product:deleted', { id: parseInt(id) });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/products/:id/inventory-breakdown ───────────────
async function inventoryBreakdown(req, res, next) {
  try {
    const { id } = req.params;

    // Product from stock view
    const pResult = await query(
      `SELECT id, name, on_hand_qty, free_to_use_qty, reserved_qty, unit
       FROM product_stock_view WHERE id = $1`,
      [id]
    );
    if (pResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Breakdown grouped by move_type + reference_type
    const breakdownResult = await query(
      `SELECT
         move_type, reference_type,
         SUM(qty) AS qty,
         COUNT(*) AS events,
         MAX(created_at) AS last_at
       FROM stock_ledger
       WHERE product_id = $1
       GROUP BY move_type, reference_type
       ORDER BY move_type, reference_type`,
      [id]
    );

    // Map to friendly categories
    const breakdown = [];
    const categoryMap = {};

    for (const row of breakdownResult.rows) {
      let category;
      let sign = 1;
      if (row.move_type === 'IN' && row.reference_type === 'PO') {
        category = 'Received via Purchase';
      } else if (row.move_type === 'IN' && row.reference_type === 'MO') {
        category = 'Manufactured';
      } else if (row.move_type === 'OUT' && row.reference_type === 'MO') {
        category = 'Consumed in Manufacturing';
        sign = -1;
      } else if (row.move_type === 'OUT' && row.reference_type === 'SO') {
        category = 'Delivered to Sales';
        sign = -1;
      } else if (row.move_type === 'RESERVE') {
        category = 'Reserved (Sales)';
        sign = -1;
      } else if (row.move_type === 'UNRESERVE') {
        category = 'Unreserved';
      } else if (row.move_type === 'ADJUST') {
        category = 'Manual Adjustments';
      } else {
        category = `${row.move_type} (${row.reference_type || 'Other'})`;
        if (row.move_type === 'OUT') sign = -1;
      }

      if (categoryMap[category]) {
        categoryMap[category].qty += parseFloat(row.qty) * sign;
        categoryMap[category].events += parseInt(row.events);
        if (new Date(row.last_at) > new Date(categoryMap[category].last_at)) {
          categoryMap[category].last_at = row.last_at;
        }
      } else {
        categoryMap[category] = {
          category,
          qty: parseFloat(row.qty) * sign,
          events: parseInt(row.events),
          last_at: row.last_at,
        };
      }
    }

    for (const key of Object.keys(categoryMap)) {
      breakdown.push(categoryMap[key]);
    }

    // Recent moves
    const recentResult = await query(
      `SELECT * FROM stock_ledger
       WHERE product_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [id]
    );

    res.json({
      product: pResult.rows[0],
      breakdown,
      recent_moves: recentResult.rows,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, remove, inventoryBreakdown };
