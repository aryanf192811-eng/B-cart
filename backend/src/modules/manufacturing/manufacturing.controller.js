const { query, withTransaction } = require('../../config/db');
const { auditLog } = require('../../middleware/audit');
const { nextNumber } = require('../../utils/sequence');
const { writeStockMove } = require('../../services/stockLedger');
const { assertTransition } = require('../../services/stateMachine');
const { streamPDF, header, kv, drawTable, footer } = require('../../utils/pdf');

function emitSocket(req, event, data) {
  req.app.locals.io?.emit(event, data);
}

// ── GET /api/manufacturing ────────────────────────────────────
async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { status, mine, late, search } = req.query;

    const SORTABLE = ['id', 'mo_number', 'created_at'];
    let sortField = 'mo.id';
    if (req.query.sort && SORTABLE.includes(req.query.sort)) sortField = `mo.${req.query.sort}`;
    const sortOrder = req.query.order === 'desc' ? 'DESC' : 'ASC';

    const conditions = [];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(mo.mo_number ILIKE $${idx} OR p.name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (status) {
      conditions.push(`mo.status = $${idx}`);
      params.push(status);
      idx++;
    }
    if (mine === 'true') {
      conditions.push(`mo.assignee_id = $${idx}`);
      params.push(req.user.id);
      idx++;
    }
    if (late === 'true') {
      conditions.push(`mo.schedule_date < CURRENT_DATE AND mo.status NOT IN ('done', 'cancelled')`);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRes = await query(
      `SELECT COUNT(*) AS total FROM manufacturing_orders mo
       JOIN products p ON p.id = mo.product_id ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].total);

    const dataRes = await query(
      `SELECT mo.*, p.name AS product_name, u.full_name AS assignee_name
       FROM manufacturing_orders mo
       JOIN products p ON p.id = mo.product_id
       LEFT JOIN users u ON u.id = mo.assignee_id
       ${where}
       ORDER BY ${sortField} ${sortOrder}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({ rows: dataRes.rows, total, page, limit });
  } catch (err) { next(err); }
}

// ── GET /api/manufacturing/counts ─────────────────────────────
async function counts(req, res, next) {
  try {
    const countsRes = await query(`
      SELECT
        COUNT(*) AS "all",
        COUNT(*) FILTER (WHERE status = 'draft') AS "draft",
        COUNT(*) FILTER (WHERE status = 'confirmed') AS "confirmed",
        COUNT(*) FILTER (WHERE status = 'in_progress') AS "in_progress",
        COUNT(*) FILTER (WHERE status = 'to_close') AS "to_close",
        COUNT(*) FILTER (WHERE status = 'done') AS "done",
        COUNT(*) FILTER (WHERE schedule_date < CURRENT_DATE AND status NOT IN ('done', 'cancelled')) AS "late",
        COUNT(*) FILTER (WHERE assignee_id IS NULL) AS "not_assigned"
      FROM manufacturing_orders
    `);
    res.json({ counts: countsRes.rows[0] });
  } catch (err) { next(err); }
}

// ── GET /api/manufacturing/:id ────────────────────────────────
async function getById(req, res, next) {
  try {
    const { id } = req.params;
    const moRes = await query(
      `SELECT mo.*, p.name AS product_name, u.full_name AS assignee_name
       FROM manufacturing_orders mo
       JOIN products p ON p.id = mo.product_id
       LEFT JOIN users u ON u.id = mo.assignee_id
       WHERE mo.id = $1`,
      [id]
    );
    if (moRes.rows.length === 0) return res.status(404).json({ error: 'MO not found' });

    const componentsRes = await query(
      `SELECT mc.*, p.name AS component_name, p.sku AS component_sku,
              p.on_hand_qty, COALESCE(psv.free_to_use_qty, 0) AS free_to_use_qty
       FROM mo_components mc
       JOIN products p ON p.id = mc.component_id
       LEFT JOIN product_stock_view psv ON psv.id = mc.component_id
       WHERE mc.mo_id = $1`,
      [id]
    );

    const workOrdersRes = await query(
      `SELECT wo.*, wc.name AS work_center_name, wc.code AS work_center_code
       FROM work_orders wo
       JOIN work_centers wc ON wc.id = wo.work_center_id
       WHERE wo.mo_id = $1 ORDER BY wo.sequence`,
      [id]
    );

    const mo = moRes.rows[0];
    mo.components = componentsRes.rows.map(c => ({
      ...c,
      availability: parseFloat(c.free_to_use_qty) >= parseFloat(c.qty_required)
    }));
    mo.work_orders = workOrdersRes.rows;

    res.json({ manufacturing_order: mo });
  } catch (err) { next(err); }
}

// ── POST /api/manufacturing ───────────────────────────────────
async function create(req, res, next) {
  try {
    const { product_id, bom_id, qty, assignee_id, schedule_date } = req.body;

    const mo = await withTransaction(async (client) => {
      const moNumber = await nextNumber(client, 'MO', 'manufacturing_orders', 'mo_number');

      const { rows } = await client.query(
        `INSERT INTO manufacturing_orders (mo_number, product_id, bom_id, qty, status, assignee_id, schedule_date, created_by)
         VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7) RETURNING *`,
        [moNumber, product_id, bom_id || null, qty || 1, assignee_id || null, schedule_date || null, req.user.id]
      );
      const moRow = rows[0];

      if (bom_id) {
        const bomComponents = await client.query(`SELECT component_id, qty FROM bom_components WHERE bom_id = $1`, [bom_id]);
        for (const bc of bomComponents.rows) {
          await client.query(
            `INSERT INTO mo_components (mo_id, component_id, qty_required, qty_consumed)
             VALUES ($1, $2, $3, 0)`,
            [moRow.id, bc.component_id, parseFloat(bc.qty) * (qty || 1)]
          );
        }

        const bomOps = await client.query(`SELECT work_center_id, name, duration_mins, sequence FROM bom_operations WHERE bom_id = $1 ORDER BY sequence`, [bom_id]);
        for (const op of bomOps.rows) {
          await client.query(
            `INSERT INTO work_orders (mo_id, work_center_id, operation_name, sequence, status, duration_mins)
             VALUES ($1, $2, $3, $4, 'pending', $5)`,
            [moRow.id, op.work_center_id, op.name, op.sequence, parseFloat(op.duration_mins) * (qty || 1)]
          );
        }
      }

      await auditLog(req, {
        module: 'Manufacturing', action: 'Created', entityType: 'manufacturing_order',
        entityId: moRow.id, entityRef: moRow.mo_number,
      });

      return moRow;
    });

    emitSocket(req, 'mo:created', { id: mo.id });
    res.status(201).json({ manufacturing_order: mo });
  } catch (err) { next(err); }
}

// ── PUT /api/manufacturing/:id ────────────────────────────────
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { assignee_id, schedule_date } = req.body;

    const mo = await withTransaction(async (client) => {
      const oldRes = await client.query('SELECT * FROM manufacturing_orders WHERE id = $1 FOR UPDATE', [id]);
      if (oldRes.rows.length === 0) {
        const err = new Error('MO not found'); err.code = 'NOT_FOUND'; err.status = 404; throw err;
      }
      const oldRow = oldRes.rows[0];

      if (['done', 'cancelled'].includes(oldRow.status)) {
        throw new Error('Cannot edit MO in this state');
      }

      const { rows } = await client.query(
        `UPDATE manufacturing_orders SET
           assignee_id = COALESCE($1, assignee_id),
           schedule_date = COALESCE($2, schedule_date),
           updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [assignee_id, schedule_date, id]
      );
      const moRow = rows[0];

      await auditLog(req, {
        module: 'Manufacturing', action: 'Updated', entityType: 'manufacturing_order',
        entityId: moRow.id, entityRef: moRow.mo_number, fieldName: 'assignee_id', newValue: assignee_id
      });

      return moRow;
    });

    emitSocket(req, 'mo:updated', { id: mo.id });
    res.json({ manufacturing_order: mo });
  } catch (err) { next(err); }
}

// ── POST /api/manufacturing/:id/confirm ───────────────────────
async function confirm(req, res, next) {
  try {
    const { id } = req.params;

    const mo = await withTransaction(async (client) => {
      const moRes = await client.query('SELECT status, mo_number FROM manufacturing_orders WHERE id = $1 FOR UPDATE', [id]);
      if (moRes.rows.length === 0) {
        const err = new Error('MO not found'); err.code = 'NOT_FOUND'; err.status = 404; throw err;
      }
      const moRow = moRes.rows[0];

      assertTransition('MO', moRow.status, 'confirmed');

      const comps = await client.query('SELECT * FROM mo_components WHERE mo_id = $1', [id]);
      for (const comp of comps.rows) {
        const pRes = await client.query(`SELECT free_to_use_qty FROM product_stock_view WHERE id = $1`, [comp.component_id]);
        const freeToUse = parseFloat(pRes.rows[0].free_to_use_qty);
        const reqQty = parseFloat(comp.qty_required);

        if (freeToUse < reqQty) {
          const err = new Error(`Insufficient stock for component ID ${comp.component_id}. Needed ${reqQty}, available ${freeToUse}`);
          err.code = 'INSUFFICIENT_STOCK'; err.status = 422; throw err;
        }

        await writeStockMove(client, {
          productId: comp.component_id, moveType: 'RESERVE', qty: reqQty,
          referenceType: 'MO', referenceId: comp.id, referenceNumber: moRow.mo_number,
          userId: req.user.id
        });
      }

      await client.query(`UPDATE manufacturing_orders SET status = 'confirmed', updated_at = NOW() WHERE id = $1`, [id]);

      await auditLog(req, {
        module: 'Manufacturing', action: 'Status_Changed', entityType: 'manufacturing_order',
        entityId: id, entityRef: moRow.mo_number, oldValue: moRow.status, newValue: 'confirmed'
      });

      return moRow;
    });

    emitSocket(req, 'mo:confirmed', { id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── WORK ORDER ENDPOINTS ──────────────────────────────────────

async function woAction(req, res, next, actionType) {
  try {
    const { id, woId } = req.params;

    const result = await withTransaction(async (client) => {
      const moRes = await client.query('SELECT status, mo_number FROM manufacturing_orders WHERE id = $1 FOR UPDATE', [id]);
      if (moRes.rows.length === 0) {
        const err = new Error('MO not found'); err.code = 'NOT_FOUND'; err.status = 404; throw err;
      }
      const moRow = moRes.rows[0];

      const woRes = await client.query('SELECT * FROM work_orders WHERE id = $1 AND mo_id = $2 FOR UPDATE', [woId, id]);
      if (woRes.rows.length === 0) {
        const err = new Error('Work order not found'); err.code = 'NOT_FOUND'; err.status = 404; throw err;
      }
      const woRow = woRes.rows[0];

      let nextWoStatus;
      let nextMoStatus = moRow.status;
      if (actionType === 'start') {
        assertTransition('WO', woRow.status, 'in_progress');
        nextWoStatus = 'in_progress';

        if (moRow.status === 'confirmed') {
          nextMoStatus = 'in_progress';
          await client.query(`UPDATE manufacturing_orders SET status = 'in_progress', updated_at = NOW() WHERE id = $1`, [id]);
        }

        await client.query(`UPDATE work_orders SET status = $1, started_at = COALESCE(started_at, NOW()) WHERE id = $2`, [nextWoStatus, woId]);
      } else if (actionType === 'pause') {
        assertTransition('WO', woRow.status, 'paused');
        nextWoStatus = 'paused';
        await client.query(`UPDATE work_orders SET status = $1 WHERE id = $2`, [nextWoStatus, woId]);
      } else if (actionType === 'resume') {
        assertTransition('WO', woRow.status, 'in_progress');
        nextWoStatus = 'in_progress';
        await client.query(`UPDATE work_orders SET status = $1 WHERE id = $2`, [nextWoStatus, woId]);
      } else if (actionType === 'done') {
        assertTransition('WO', woRow.status, 'done');
        nextWoStatus = 'done';
        await client.query(`UPDATE work_orders SET status = $1, completed_at = NOW() WHERE id = $2`, [nextWoStatus, woId]);

        // Check if all WOs done
        const allWo = await client.query('SELECT status FROM work_orders WHERE mo_id = $1', [id]);
        if (allWo.rows.every(w => w.status === 'done')) {
          nextMoStatus = 'to_close';
          await client.query(`UPDATE manufacturing_orders SET status = 'to_close', updated_at = NOW() WHERE id = $1`, [id]);
        }
      }

      await client.query(
        `INSERT INTO work_order_time_logs (work_order_id, action) VALUES ($1, $2)`,
        [woId, actionType]
      );

      return { mo_status: nextMoStatus, wo_status: nextWoStatus };
    });

    emitSocket(req, `wo:${actionType}`, { moId: id, woId });
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
}

const startWo = (req, res, next) => woAction(req, res, next, 'start');
const pauseWo = (req, res, next) => woAction(req, res, next, 'pause');
const resumeWo = (req, res, next) => woAction(req, res, next, 'resume');
const doneWo = (req, res, next) => woAction(req, res, next, 'done');

// ── POST /api/manufacturing/:id/produce ───────────────────────
async function produce(req, res, next) {
  try {
    const { id } = req.params;

    const result = await withTransaction(async (client) => {
      const moRes = await client.query(
        `SELECT mo.*, p.name AS product_name, so.so_number
         FROM manufacturing_orders mo
         JOIN products p ON p.id = mo.product_id
         LEFT JOIN sales_orders so ON so.so_number = mo.source_ref AND mo.source_type = 'auto_from_so'
         WHERE mo.id = $1 FOR UPDATE OF mo`, [id]
      );
      if (moRes.rows.length === 0) {
        const err = new Error('MO not found'); err.code = 'NOT_FOUND'; err.status = 404; throw err;
      }
      const moRow = moRes.rows[0];

      assertTransition('MO', moRow.status, 'done');

      // Consume components
      const comps = await client.query('SELECT * FROM mo_components WHERE mo_id = $1 FOR UPDATE', [id]);
      for (const comp of comps.rows) {
        const reqQty = parseFloat(comp.qty_required);
        // OUT
        await writeStockMove(client, {
          productId: comp.component_id, moveType: 'OUT', qty: reqQty,
          referenceType: 'MO', referenceId: id, referenceNumber: moRow.mo_number,
          userId: req.user.id
        });
        // UNRESERVE
        await writeStockMove(client, {
          productId: comp.component_id, moveType: 'UNRESERVE', qty: reqQty,
          referenceType: 'MO', referenceId: id, referenceNumber: moRow.mo_number,
          userId: req.user.id
        });
        await client.query(`UPDATE mo_components SET qty_consumed = $1 WHERE id = $2`, [reqQty, comp.id]);
      }

      // IN Finished Goods
      await writeStockMove(client, {
        productId: moRow.product_id, moveType: 'IN', qty: parseFloat(moRow.qty),
        referenceType: 'MO', referenceId: id, referenceNumber: moRow.mo_number,
        userId: req.user.id
      });

      // Auto-reserve for originating SO
      if (moRow.source_type === 'auto_from_so' && moRow.source_ref) {
        const soLineRes = await client.query(`
          SELECT sl.id FROM so_lines sl
          JOIN sales_orders so ON so.id = sl.so_id
          WHERE so.so_number = $1 AND sl.product_id = $2 LIMIT 1
        `, [moRow.source_ref, moRow.product_id]);
        if (soLineRes.rows.length > 0) {
          await writeStockMove(client, {
            productId: moRow.product_id, moveType: 'RESERVE', qty: parseFloat(moRow.qty),
            referenceType: 'SO', referenceId: soLineRes.rows[0].id, referenceNumber: moRow.source_ref,
            userId: req.user.id,
            notes: `Auto-reserved from MO ${moRow.mo_number}`
          });
        }
      }

      await client.query(`UPDATE manufacturing_orders SET status = 'done', completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);

      // PRODUCT PASSPORT
      const prefix = moRow.product_name.split(' ').map(w => w[0].toUpperCase()).join('').substring(0, 2);
      const seq = String(moRow.id).padStart(6, '0');
      const passportId = `${prefix}-${new Date().getFullYear()}-${seq}`;
      const batchNumber = moRow.source_type === 'auto_from_so' ? `BATCH-${moRow.so_number}` : `BATCH-MO-${moRow.id}`;

      const { rows: passRows } = await client.query(
        `INSERT INTO product_passports (passport_id, product_id, mo_id, batch_number, qty_produced, manufactured_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [passportId, moRow.product_id, id, batchNumber, parseFloat(moRow.qty), req.user.id]
      );
      const pid = passRows[0].id;

      // Components trace
      for (const comp of comps.rows) {
        const prodRes = await client.query('SELECT name FROM products WHERE id = $1', [comp.component_id]);
        const componentName = prodRes.rows[0].name;

        const poRes = await client.query(
          `SELECT po.vendor_id, po.id AS po_id
           FROM po_lines pl
           JOIN purchase_orders po ON po.id = pl.po_id
           WHERE pl.product_id = $1 AND po.status = 'fully_received'
           ORDER BY po.received_at DESC LIMIT 1`,
          [comp.component_id]
        );
        const sourceVendorId = poRes.rows[0]?.vendor_id || null;
        const sourcePoId = poRes.rows[0]?.po_id || null;

        await client.query(
          `INSERT INTO passport_components (passport_id, component_id, component_name, source_vendor_id, source_po_id, qty_used)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [pid, comp.component_id, componentName, sourceVendorId, sourcePoId, comp.qty_required]
        );
      }

      await auditLog(req, {
        module: 'Manufacturing', action: 'Status_Changed', entityType: 'manufacturing_order',
        entityId: id, entityRef: moRow.mo_number, oldValue: moRow.status, newValue: 'done'
      });

      return moRow;
    });

    emitSocket(req, 'mo:produced', { id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── POST /api/manufacturing/:id/cancel ────────────────────────
async function cancel(req, res, next) {
  try {
    const { id } = req.params;

    const result = await withTransaction(async (client) => {
      const moRes = await client.query('SELECT status, mo_number FROM manufacturing_orders WHERE id = $1 FOR UPDATE', [id]);
      if (moRes.rows.length === 0) {
        const err = new Error('MO not found'); err.code = 'NOT_FOUND'; err.status = 404; throw err;
      }
      const moRow = moRes.rows[0];

      assertTransition('MO', moRow.status, 'cancelled');

      if (['confirmed', 'in_progress', 'to_close'].includes(moRow.status)) {
        const comps = await client.query('SELECT * FROM mo_components WHERE mo_id = $1', [id]);
        for (const comp of comps.rows) {
          await writeStockMove(client, {
            productId: comp.component_id, moveType: 'UNRESERVE', qty: parseFloat(comp.qty_required),
            referenceType: 'MO', referenceId: id, referenceNumber: moRow.mo_number,
            userId: req.user.id
          });
        }
      }

      await client.query(`UPDATE manufacturing_orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]);

      await auditLog(req, {
        module: 'Manufacturing', action: 'Status_Changed', entityType: 'manufacturing_order',
        entityId: id, entityRef: moRow.mo_number, oldValue: moRow.status, newValue: 'cancelled'
      });

      return moRow;
    });

    emitSocket(req, 'mo:cancelled', { id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── GET /api/manufacturing/:id/pdf ────────────────────────────
async function generatePdf(req, res, next) {
  try {
    const { id } = req.params;
    const moRes = await query(
      `SELECT mo.*, p.name AS product_name, p.sku, b.reference AS bom_ref, u.full_name AS assignee_name
       FROM manufacturing_orders mo
       JOIN products p ON p.id = mo.product_id
       LEFT JOIN bom b ON b.id = mo.bom_id
       LEFT JOIN users u ON u.id = mo.assignee_id
       WHERE mo.id = $1`, [id]
    );
    if (moRes.rows.length === 0) return res.status(404).json({ error: 'MO not found' });
    const mo = moRes.rows[0];

    const compsRes = await query(
      `SELECT mc.*, p.name AS component_name, p.sku AS component_sku,
              p.on_hand_qty, COALESCE(psv.free_to_use_qty, 0) AS free_to_use_qty
       FROM mo_components mc
       JOIN products p ON p.id = mc.component_id
       LEFT JOIN product_stock_view psv ON psv.id = mc.component_id
       WHERE mc.mo_id = $1`, [id]
    );
    const woRes = await query(
      `SELECT wo.*, wc.name AS wc_name FROM work_orders wo
       JOIN work_centers wc ON wc.id = wo.work_center_id WHERE wo.mo_id = $1 ORDER BY wo.sequence`, [id]
    );

    const comps = compsRes.rows;
    const wos = woRes.rows;
    const totalExpected = wos.reduce((s, w) => s + parseFloat(w.duration_mins || 0), 0);
    const totalReal = wos.reduce((s, w) => s + parseFloat(w.real_duration_secs || 0), 0);

    streamPDF(res, `mo-${mo.mo_number}.pdf`, (doc) => {
      let y = header(doc, 'Manufacturing Order', `${mo.product_name} × ${mo.qty}`, mo.mo_number, mo.status);

      kv(doc, 48, y, 'Product', `${mo.product_name} (${mo.sku})`);
      kv(doc, 240, y, 'BoM Reference', mo.bom_ref || '— (manual)');
      kv(doc, 390, y, 'Quantity', mo.qty);
      y += 40;
      kv(doc, 48, y, 'Status', mo.status.replace(/_/g, ' ').toUpperCase());
      kv(doc, 240, y, 'Assignee', mo.assignee_name || 'Unassigned');
      kv(doc, 390, y, 'Schedule Date', mo.schedule_date ? new Date(mo.schedule_date).toLocaleDateString('en-IN') : 'Not set');
      y += 44;

      doc.fillColor('#475467').font('Helvetica').fontSize(10).text('Components', 48, y);
      y += 14;
      y = drawTable(doc, {
        headers: ['Component', 'SKU', 'Required', 'Consumed', 'Available'],
        rows: comps.map(c => [
          c.component_name, c.component_sku,
          parseFloat(c.qty_required).toFixed(2),
          parseFloat(c.qty_consumed).toFixed(2),
          parseFloat(c.free_to_use_qty) >= parseFloat(c.qty_required) ? '✓ OK' : '⚠ SHORT'
        ]),
        startY: y,
        colWidths: [175, 65, 65, 65, 65],
        align: ['left', 'left', 'right', 'right', 'right'],
      });

      y += 8;
      doc.fillColor('#475467').font('Helvetica').fontSize(10).text('Work Orders', 48, y);
      y += 14;
      y = drawTable(doc, {
        headers: ['Seq', 'Operation', 'Work Center', 'Expected (min)', 'Real (sec)'],
        rows: wos.map(w => [w.sequence, w.operation_name, w.wc_name, w.duration_mins, w.real_duration_secs || 0]),
        startY: y,
        colWidths: [35, 190, 120, 80, 75],
        align: ['right', 'left', 'left', 'right', 'right'],
      });

      doc.fillColor('#0F1419').font('Helvetica-Bold').fontSize(9)
         .text(`Total expected: ${totalExpected} min   Total real: ${totalReal} sec`, 48, y, { align: 'right', width: doc.page.width - 96 });

      footer(doc);
    });
  } catch (err) { next(err); }
}

module.exports = {
  list, counts, getById, create, update, confirm, produce, cancel, generatePdf,
  startWo, pauseWo, resumeWo, doneWo
};
