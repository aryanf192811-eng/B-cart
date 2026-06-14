const { query, withTransaction } = require('../../config/db');
const { auditLog, diffAndAudit } = require('../../middleware/audit');
const { nextNumber } = require('../../utils/sequence');
const { writeStockMove } = require('../../services/stockLedger');
const { assertTransition } = require('../../services/stateMachine');
const { publishEvent } = require('../../events/eventBus');
const { streamPDF, header, kv, drawTable, footer } = require('../../utils/pdf');

function emitSocket(req, event, data) {
  req.app.locals.io?.emit(event, data);
}

// ── GET /api/sales ────────────────────────────────────────────
async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { status, mine, late, search } = req.query;

    const SORTABLE = ['id', 'so_number', 'created_at', 'total_amount'];
    let sortField = 'so.id';
    if (req.query.sort && SORTABLE.includes(req.query.sort)) sortField = `so.${req.query.sort}`;
    const sortOrder = req.query.order === 'desc' ? 'DESC' : 'ASC';

    const conditions = [];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(so.so_number ILIKE $${idx} OR c.name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (status) {
      conditions.push(`so.status = $${idx}`);
      params.push(status);
      idx++;
    }
    if (mine === 'true') {
      conditions.push(`so.salesperson_id = $${idx}`);
      params.push(req.user.id);
      idx++;
    }
    if (late === 'true') {
      conditions.push(`so.status = 'confirmed' AND so.confirmed_at < NOW() - INTERVAL '3 days'`);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRes = await query(
      `SELECT COUNT(*) AS total FROM sales_order_view so
       LEFT JOIN customers c ON c.id = so.customer_id ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].total);

    const dataRes = await query(
      `SELECT so.*, c.name AS customer_name, u.full_name AS salesperson_name
       FROM sales_order_view so
       LEFT JOIN customers c ON c.id = so.customer_id
       LEFT JOIN users u ON u.id = so.salesperson_id
       ${where}
       ORDER BY ${sortField} ${sortOrder}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({ rows: dataRes.rows, total, page, limit });
  } catch (err) { next(err); }
}

// ── GET /api/sales/counts ─────────────────────────────────────
async function counts(req, res, next) {
  try {
    const countsRes = await query(`
      SELECT
        COUNT(*) AS "all",
        COUNT(*) FILTER (WHERE status = 'draft') AS "draft",
        COUNT(*) FILTER (WHERE status = 'confirmed') AS "confirmed",
        COUNT(*) FILTER (WHERE status = 'partially_delivered') AS "partially_delivered",
        COUNT(*) FILTER (WHERE status = 'fully_delivered') AS "fully_delivered",
        COUNT(*) FILTER (WHERE status = 'confirmed' AND confirmed_at < NOW() - INTERVAL '3 days') AS "late",
        COUNT(*) FILTER (WHERE salesperson_id = $1) AS "mine"
      FROM sales_orders
    `, [req.user.id]);

    res.json({ counts: countsRes.rows[0] });
  } catch (err) { next(err); }
}

// ── GET /api/sales/:id ────────────────────────────────────────
async function getById(req, res, next) {
  try {
    const { id } = req.params;
    const soRes = await query(
      `SELECT so.*, c.name AS customer_name, u.full_name AS salesperson_name
       FROM sales_order_view so
       LEFT JOIN customers c ON c.id = so.customer_id
       LEFT JOIN users u ON u.id = so.salesperson_id
       WHERE so.id = $1`,
      [id]
    );
    if (soRes.rows.length === 0) return res.status(404).json({ error: 'Sales Order not found' });

    const linesRes = await query(
      `SELECT sl.*, p.name AS product_name, p.sku AS product_sku,
              psv.on_hand_qty, COALESCE(psv.free_to_use_qty, 0) AS free_to_use_qty
       FROM so_lines sl
       JOIN products p ON p.id = sl.product_id
       LEFT JOIN product_stock_view psv ON psv.id = sl.product_id
       WHERE sl.so_id = $1`,
      [id]
    );

    const so = soRes.rows[0];
    so.lines = linesRes.rows.map(l => ({
      ...l,
      availability: parseFloat(l.free_to_use_qty) >= (parseFloat(l.qty_ordered) - parseFloat(l.qty_delivered))
    }));

    res.json({ sales_order: so });
  } catch (err) { next(err); }
}

// ── POST /api/sales ───────────────────────────────────────────
async function create(req, res, next) {
  try {
    const { customer_id, salesperson_id, lines } = req.body;

    const so = await withTransaction(async (client) => {
      const soNumber = await nextNumber(client, 'SO', 'sales_orders', 'so_number');
      let totalAmount = 0;

      for (const line of lines) {
        totalAmount += parseFloat(line.qty_ordered) * parseFloat(line.unit_price);
      }

      const { rows } = await client.query(
        `INSERT INTO sales_orders (so_number, customer_id, salesperson_id, status, created_by)
         VALUES ($1, $2, $3, 'draft', $4) RETURNING *`,
        [soNumber, customer_id, salesperson_id || req.user.id, req.user.id]
      );
      const soRow = rows[0];

      for (const line of lines) {
        await client.query(
          `INSERT INTO so_lines (so_id, product_id, qty_ordered, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [soRow.id, line.product_id, line.qty_ordered, line.unit_price]
        );
      }

      await auditLog(req, {
        module: 'Sales', action: 'Created', entityType: 'sales_order',
        entityId: soRow.id, entityRef: soRow.so_number,
      });

      return soRow;
    });

    emitSocket(req, 'sales:created', { id: so.id });
    res.status(201).json({ sales_order: so });
  } catch (err) { next(err); }
}

// ── PUT /api/sales/:id ────────────────────────────────────────
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { customer_id, salesperson_id, lines } = req.body;

    const so = await withTransaction(async (client) => {
      const oldRes = await client.query('SELECT * FROM sales_orders WHERE id = $1 FOR UPDATE', [id]);
      if (oldRes.rows.length === 0) {
        const err = new Error('Sales Order not found'); err.code = 'NOT_FOUND'; err.status = 404; throw err;
      }
      const oldRow = oldRes.rows[0];

      if (oldRow.status !== 'draft') {
        throw new Error('Can only edit SO in draft state');
      }

      let totalAmount = 0;
      for (const line of lines) {
        totalAmount += parseFloat(line.qty_ordered) * parseFloat(line.unit_price);
      }

      const { rows } = await client.query(
        `UPDATE sales_orders SET
           customer_id = COALESCE($1, customer_id),
           salesperson_id = COALESCE($2, salesperson_id),
           updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [customer_id, salesperson_id, id]
      );
      const soRow = rows[0];

      await client.query('DELETE FROM so_lines WHERE so_id = $1', [id]);
      for (const line of lines) {
        await client.query(
          `INSERT INTO so_lines (so_id, product_id, qty_ordered, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [id, line.product_id, line.qty_ordered, line.unit_price]
        );
      }

      await auditLog(req, {
        module: 'Sales', action: 'Updated', entityType: 'sales_order',
        entityId: soRow.id, entityRef: soRow.so_number, fieldName: 'lines', newValue: JSON.stringify(lines)
      });

      return soRow;
    });

    emitSocket(req, 'sales:updated', { id: so.id });
    res.json({ sales_order: so });
  } catch (err) { next(err); }
}

// ── POST /api/sales/:id/confirm ───────────────────────────────
async function confirm(req, res, next) {
  try {
    const { id } = req.params;

    const result = await withTransaction(async (client) => {
      const soRes = await client.query('SELECT status, so_number FROM sales_orders WHERE id = $1 FOR UPDATE', [id]);
      if (soRes.rows.length === 0) {
        const err = new Error('Sales Order not found'); err.code = 'NOT_FOUND'; err.status = 404; throw err;
      }
      const soRow = soRes.rows[0];

      assertTransition('SO', soRow.status, 'confirmed');

      await client.query(
        `UPDATE sales_orders SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW()
         WHERE id = $1`, [id]
      );

      await auditLog(req, {
        module: 'Sales', action: 'Status_Changed', entityType: 'sales_order',
        entityId: id, entityRef: soRow.so_number, oldValue: soRow.status, newValue: 'confirmed'
      });

      // Publish event asynchronously via Outbox inside the transaction
      await publishEvent(client, 'SalesOrderConfirmed', { soId: id, userId: req.user.id });

      return { soNumber: soRow.so_number };
    });

    emitSocket(req, 'sales:confirmed', { id });
    res.json({ ok: true, confirmed: true, procurement_summary: "Procurement triggered in background" });
  } catch (err) { next(err); }
}

// ── POST /api/sales/:id/deliver ───────────────────────────────
async function deliver(req, res, next) {
  try {
    const { id } = req.params;
    const { lines } = req.body;

    const so = await withTransaction(async (client) => {
      const soRes = await client.query('SELECT status, so_number FROM sales_orders WHERE id = $1 FOR UPDATE', [id]);
      if (soRes.rows.length === 0) {
        const err = new Error('Sales Order not found'); err.code = 'NOT_FOUND'; err.status = 404; throw err;
      }
      const soRow = soRes.rows[0];

      // Validate transition: draft -> error, confirmed/partial -> partial/fully
      if (!['confirmed', 'partially_delivered'].includes(soRow.status)) {
        assertTransition('SO', soRow.status, 'partially_delivered'); // Will throw INVALID_TRANSITION
      }

      for (const reqLine of lines) {
        const lineRes = await client.query(`SELECT * FROM so_lines WHERE id = $1 FOR UPDATE`, [reqLine.id]);
        if (lineRes.rows.length === 0) continue;
        const line = lineRes.rows[0];

        const newDelivered = parseFloat(reqLine.qty_delivered);
        const currentDelivered = parseFloat(line.qty_delivered);
        const delta = newDelivered - currentDelivered;

        if (delta > 0) {
          const pRes = await client.query(`SELECT free_to_use_qty FROM product_stock_view WHERE id = $1`, [line.product_id]);
          const freeToUse = parseFloat(pRes.rows[0].free_to_use_qty);

          // We also have to unreserve. So delta can use reserved + free_to_use
          // If we reserved earlier, free_to_use doesn't include it.
          // Wait, writeStockMove(OUT) will just check on_hand_qty.
          // So INSUFFICIENT_STOCK will be thrown if on_hand_qty < delta.
          // BUT business logic: delta must be <= reserved + freeToUse?
          // Since OUT reduces on_hand, and UNRESERVE reduces reserved, it's fine.
          // writeStockMove OUT handles on_hand limit natively.

          await writeStockMove(client, {
            productId: line.product_id, moveType: 'OUT', qty: delta,
            referenceType: 'SO', referenceId: line.id, referenceNumber: soRow.so_number,
            userId: req.user.id
          });

          const resQuery = await client.query(`
            SELECT 
              COALESCE(SUM(CASE WHEN move_type = 'RESERVE' THEN qty ELSE 0 END), 0) -
              COALESCE(SUM(CASE WHEN move_type = 'UNRESERVE' THEN qty ELSE 0 END), 0) AS currently_reserved
            FROM stock_ledger 
            WHERE reference_type = 'SO' AND reference_id = $1
          `, [line.id]);
          const currentlyReserved = parseFloat(resQuery.rows[0].currently_reserved);
          const unreserveQty = Math.min(delta, currentlyReserved);

          if (unreserveQty > 0) {
            await writeStockMove(client, {
              productId: line.product_id, moveType: 'UNRESERVE', qty: unreserveQty,
              referenceType: 'SO', referenceId: line.id, referenceNumber: soRow.so_number,
              userId: req.user.id
            });
          }

          await client.query(`UPDATE so_lines SET qty_delivered = $1 WHERE id = $2`, [newDelivered, line.id]);
        }
      }

      // Check if fully delivered
      const checkRes = await client.query(`SELECT SUM(qty_ordered) as ord, SUM(qty_delivered) as del FROM so_lines WHERE so_id = $1`, [id]);
      const isFully = parseFloat(checkRes.rows[0].ord) <= parseFloat(checkRes.rows[0].del);
      const nextStatus = isFully ? 'fully_delivered' : 'partially_delivered';

      await client.query(`UPDATE sales_orders SET status = $1, updated_at = NOW() WHERE id = $2`, [nextStatus, id]);

      await auditLog(req, {
        module: 'Sales', action: 'Status_Changed', entityType: 'sales_order',
        entityId: id, entityRef: soRow.so_number, oldValue: soRow.status, newValue: nextStatus
      });

      return { nextStatus };
    });

    emitSocket(req, 'sales:delivered', { id, status: so.nextStatus });
    res.json({ ok: true, status: so.nextStatus });
  } catch (err) { next(err); }
}

// ── POST /api/sales/:id/cancel ────────────────────────────────
async function cancel(req, res, next) {
  try {
    const { id } = req.params;

    const result = await withTransaction(async (client) => {
      const soRes = await client.query('SELECT status, so_number FROM sales_orders WHERE id = $1 FOR UPDATE', [id]);
      if (soRes.rows.length === 0) {
        const err = new Error('Sales Order not found'); err.code = 'NOT_FOUND'; err.status = 404; throw err;
      }
      const soRow = soRes.rows[0];

      assertTransition('SO', soRow.status, 'cancelled');

      if (['confirmed', 'partially_delivered'].includes(soRow.status)) {
        const { rows: linesWithRes } = await client.query(`
          SELECT sl.*,
            COALESCE(
              (SELECT COALESCE(SUM(CASE WHEN move_type = 'RESERVE' THEN qty ELSE 0 END), 0) -
                      COALESCE(SUM(CASE WHEN move_type = 'UNRESERVE' THEN qty ELSE 0 END), 0)
               FROM stock_ledger
               WHERE reference_type = 'SO' AND reference_id = sl.id
              ), 0
            ) AS currently_reserved
          FROM so_lines sl
          WHERE sl.so_id = $1
        `, [id]);

        for (const line of linesWithRes) {
          const currentlyReserved = parseFloat(line.currently_reserved);
          const pendingToDeliver = parseFloat(line.qty_ordered) - parseFloat(line.qty_delivered);
          const unreserveQty = Math.min(pendingToDeliver, currentlyReserved);

          if (unreserveQty > 0) {
            await writeStockMove(client, {
              productId: line.product_id, moveType: 'UNRESERVE', qty: unreserveQty,
              referenceType: 'SO', referenceId: line.id, referenceNumber: soRow.so_number,
              userId: req.user.id
            });
          }
        }
      }

      await client.query(`UPDATE sales_orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]);

      await auditLog(req, {
        module: 'Sales', action: 'Status_Changed', entityType: 'sales_order',
        entityId: id, entityRef: soRow.so_number, oldValue: soRow.status, newValue: 'cancelled'
      });

      return soRow;
    });

    emitSocket(req, 'sales:cancelled', { id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── GET /api/sales/:id/pdf ────────────────────────────────────
async function generatePdf(req, res, next) {
  try {
    const { id } = req.params;
    const soRes = await query(
      `SELECT so.*, c.name AS customer_name, u.full_name AS salesperson_name
       FROM sales_orders so
       LEFT JOIN customers c ON c.id = so.customer_id
       LEFT JOIN users u ON u.id = so.salesperson_id
       WHERE so.id = $1`, [id]
    );
    if (soRes.rows.length === 0) return res.status(404).json({ error: 'SO not found' });
    const so = soRes.rows[0];

    const linesRes = await query(
      `SELECT sl.*, p.name AS product_name, p.sku
       FROM so_lines sl JOIN products p ON p.id = sl.product_id WHERE sl.so_id = $1`, [id]
    );
    const lines = linesRes.rows;
    const grandTotal = lines.reduce((sum, l) => sum + parseFloat(l.qty_ordered) * parseFloat(l.unit_price), 0);

    streamPDF(res, `invoice-${so.so_number}.pdf`, (doc) => {
      let y = header(doc, 'Sales Invoice', `Customer: ${so.customer_name}`, so.so_number, so.status);

      kv(doc, 48, y, 'Customer', so.customer_name);
      kv(doc, 240, y, 'Salesperson', so.salesperson_name || '—');
      kv(doc, 390, y, 'Date', new Date(so.created_at).toLocaleDateString('en-IN'));
      y += 40;
      kv(doc, 48, y, 'Status', so.status.replace(/_/g, ' ').toUpperCase());
      kv(doc, 240, y, 'Confirmed', so.confirmed_at ? new Date(so.confirmed_at).toLocaleDateString('en-IN') : 'Pending');
      y += 44;

      y = drawTable(doc, {
        headers: ['Product', 'SKU', 'Ordered', 'Delivered', 'Unit Price (₹)', 'Total (₹)'],
        rows: lines.map(l => [
          l.product_name, l.sku,
          parseFloat(l.qty_ordered).toFixed(2),
          parseFloat(l.qty_delivered).toFixed(2),
          parseFloat(l.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          (parseFloat(l.qty_ordered) * parseFloat(l.unit_price)).toLocaleString('en-IN', { minimumFractionDigits: 2 })
        ]),
        startY: y,
        colWidths: [160, 65, 55, 65, 85, 75],
        align: ['left', 'left', 'right', 'right', 'right', 'right'],
      });

      // Total
      doc.fillColor('#0F1419').font('Helvetica-Bold').fontSize(11)
         .text(`Grand Total: ₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
               48, y, { align: 'right', width: doc.page.width - 96 });
      y += 18;
      doc.fillColor('#475467').font('Helvetica').fontSize(8)
         .text('Status reflects live data at time of printing.', 48, y);

      footer(doc);
    });
  } catch (err) { next(err); }
}

module.exports = { list, counts, getById, create, update, confirm, deliver, cancel, generatePdf };
