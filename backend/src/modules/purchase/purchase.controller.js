const { query, withTransaction } = require('../../config/db');
const { auditLog } = require('../../middleware/audit');
const { nextNumber } = require('../../utils/sequence');
const { writeStockMove } = require('../../services/stockLedger');
const { assertTransition } = require('../../services/stateMachine');
const { streamPDF, header, kv, drawTable, footer } = require('../../utils/pdf');

// Razorpay
const crypto = require('crypto');
let Razorpay, rzp;
try {
  Razorpay = require('razorpay');
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'paste_here') {
    rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  }
} catch { Razorpay = null; }

function emitSocket(req, event, data) {
  req.app.locals.io?.emit(event, data);
}

// ── GET /api/purchase ─────────────────────────────────────────
async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { status, mine, late, search } = req.query;

    const SORTABLE = ['id', 'po_number', 'created_at', 'total_amount'];
    let sortField = 'po.id';
    if (req.query.sort && SORTABLE.includes(req.query.sort)) sortField = `po.${req.query.sort}`;
    const sortOrder = req.query.order === 'desc' ? 'DESC' : 'ASC';

    const conditions = [];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(po.po_number ILIKE $${idx} OR v.name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (status) {
      conditions.push(`po.status = $${idx}`);
      params.push(status);
      idx++;
    }
    if (mine === 'true') {
      conditions.push(`po.responsible_id = $${idx}`);
      params.push(req.user.id);
      idx++;
    }
    if (late === 'true') {
      conditions.push(`po.status = 'confirmed' AND po.expected_delivery_date < CURRENT_DATE AND po.status != 'fully_received'`);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRes = await query(
      `SELECT COUNT(*) AS total FROM purchase_orders po
       LEFT JOIN vendors v ON v.id = po.vendor_id ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].total);

    const dataRes = await query(
      `SELECT po.*, v.name AS vendor_name, u.full_name AS responsible_name
       FROM purchase_orders po
       LEFT JOIN vendors v ON v.id = po.vendor_id
       LEFT JOIN users u ON u.id = po.responsible_id
       ${where}
       ORDER BY ${sortField} ${sortOrder}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({ rows: dataRes.rows, total, page, limit });
  } catch (err) { next(err); }
}

// ── GET /api/purchase/counts ──────────────────────────────────
async function counts(req, res, next) {
  try {
    const countsRes = await query(`
      SELECT
        COUNT(*) AS "all",
        COUNT(*) FILTER (WHERE status = 'draft') AS "draft",
        COUNT(*) FILTER (WHERE status = 'confirmed') AS "confirmed",
        COUNT(*) FILTER (WHERE status = 'partially_received') AS "partially_received",
        COUNT(*) FILTER (WHERE status = 'fully_received') AS "fully_received",
        COUNT(*) FILTER (WHERE status = 'confirmed' AND expected_delivery_date < CURRENT_DATE AND status != 'fully_received') AS "late",
        COUNT(*) FILTER (WHERE responsible_id = $1) AS "mine"
      FROM purchase_orders
    `, [req.user.id]);

    res.json({ counts: countsRes.rows[0] });
  } catch (err) { next(err); }
}

// ── GET /api/purchase/:id ─────────────────────────────────────
async function getById(req, res, next) {
  try {
    const { id } = req.params;
    const poRes = await query(
      `SELECT po.*, v.name AS vendor_name, u.full_name AS responsible_name
       FROM purchase_orders po
       LEFT JOIN vendors v ON v.id = po.vendor_id
       LEFT JOIN users u ON u.id = po.responsible_id
       WHERE po.id = $1`,
      [id]
    );
    if (poRes.rows.length === 0) return res.status(404).json({ error: 'Purchase Order not found' });

    const linesRes = await query(
      `SELECT pl.*, p.name AS product_name, p.sku AS product_sku
       FROM po_lines pl
       JOIN products p ON p.id = pl.product_id
       WHERE pl.po_id = $1`,
      [id]
    );

    const po = poRes.rows[0];
    po.lines = linesRes.rows;

    res.json({ purchase_order: po });
  } catch (err) { next(err); }
}

// ── POST /api/purchase ────────────────────────────────────────
async function create(req, res, next) {
  try {
    const { vendor_id, responsible_id, expected_delivery_date, lines } = req.body;

    const po = await withTransaction(async (client) => {
      const poNumber = await nextNumber(client, 'PO', 'purchase_orders', 'po_number');
      let totalAmount = 0;

      for (const line of lines) {
        totalAmount += parseFloat(line.qty_ordered) * parseFloat(line.unit_price);
      }

      const { rows } = await client.query(
        `INSERT INTO purchase_orders (po_number, vendor_id, responsible_id, expected_delivery_date, status, total_amount, created_by)
         VALUES ($1, $2, $3, $4, 'draft', $5, $6) RETURNING *`,
        [poNumber, vendor_id, responsible_id || req.user.id, expected_delivery_date || null, totalAmount, req.user.id]
      );
      const poRow = rows[0];

      for (const line of lines) {
        await client.query(
          `INSERT INTO po_lines (po_id, product_id, qty_ordered, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [poRow.id, line.product_id, line.qty_ordered, line.unit_price]
        );
      }

      await auditLog(req, {
        module: 'Purchase', action: 'Created', entityType: 'purchase_order',
        entityId: poRow.id, entityRef: poRow.po_number,
      });

      return poRow;
    });

    emitSocket(req, 'purchase:created', { id: po.id });
    res.status(201).json({ purchase_order: po });
  } catch (err) { next(err); }
}

// ── PUT /api/purchase/:id ─────────────────────────────────────
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { vendor_id, responsible_id, expected_delivery_date, lines } = req.body;

    const po = await withTransaction(async (client) => {
      const oldRes = await client.query('SELECT * FROM purchase_orders WHERE id = $1 FOR UPDATE', [id]);
      if (oldRes.rows.length === 0) {
        const err = new Error('Purchase Order not found'); err.code = 'NOT_FOUND'; err.status = 404; throw err;
      }
      const oldRow = oldRes.rows[0];

      if (oldRow.status !== 'draft') {
        throw new Error('Can only edit PO in draft state');
      }

      let totalAmount = 0;
      for (const line of lines) {
        totalAmount += parseFloat(line.qty_ordered) * parseFloat(line.unit_price);
      }

      const { rows } = await client.query(
        `UPDATE purchase_orders SET
           vendor_id = COALESCE($1, vendor_id),
           responsible_id = COALESCE($2, responsible_id),
           expected_delivery_date = COALESCE($3, expected_delivery_date),
           total_amount = $4,
           updated_at = NOW()
         WHERE id = $5 RETURNING *`,
        [vendor_id, responsible_id, expected_delivery_date, totalAmount, id]
      );
      const poRow = rows[0];

      await client.query('DELETE FROM po_lines WHERE po_id = $1', [id]);
      for (const line of lines) {
        await client.query(
          `INSERT INTO po_lines (po_id, product_id, qty_ordered, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [id, line.product_id, line.qty_ordered, line.unit_price]
        );
      }

      await auditLog(req, {
        module: 'Purchase', action: 'Updated', entityType: 'purchase_order',
        entityId: poRow.id, entityRef: poRow.po_number, fieldName: 'lines', newValue: JSON.stringify(lines)
      });

      return poRow;
    });

    emitSocket(req, 'purchase:updated', { id: po.id });
    res.json({ purchase_order: po });
  } catch (err) { next(err); }
}

// ── POST /api/purchase/:id/confirm ────────────────────────────
async function confirm(req, res, next) {
  try {
    const { id } = req.params;

    const po = await withTransaction(async (client) => {
      const poRes = await client.query('SELECT status, po_number FROM purchase_orders WHERE id = $1 FOR UPDATE', [id]);
      if (poRes.rows.length === 0) {
        const err = new Error('Purchase Order not found'); err.code = 'NOT_FOUND'; err.status = 404; throw err;
      }
      const poRow = poRes.rows[0];

      assertTransition('PO', poRow.status, 'confirmed');

      await client.query(
        `UPDATE purchase_orders SET status = 'confirmed', updated_at = NOW() WHERE id = $1`, [id]
      );

      await auditLog(req, {
        module: 'Purchase', action: 'Status_Changed', entityType: 'purchase_order',
        entityId: id, entityRef: poRow.po_number, oldValue: poRow.status, newValue: 'confirmed'
      });

      return poRow;
    });

    emitSocket(req, 'purchase:confirmed', { id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── POST /api/purchase/:id/receive ────────────────────────────
async function receive(req, res, next) {
  try {
    const { id } = req.params;
    const { lines } = req.body;

    const po = await withTransaction(async (client) => {
      const poRes = await client.query('SELECT status, po_number, source_type, source_ref FROM purchase_orders WHERE id = $1 FOR UPDATE', [id]);
      if (poRes.rows.length === 0) {
        const err = new Error('Purchase Order not found'); err.code = 'NOT_FOUND'; err.status = 404; throw err;
      }
      const poRow = poRes.rows[0];

      if (!['confirmed', 'partially_received'].includes(poRow.status)) {
        assertTransition('PO', poRow.status, 'partially_received'); // Will throw
      }

      for (const reqLine of lines) {
        const lineRes = await client.query(`SELECT * FROM po_lines WHERE id = $1 FOR UPDATE`, [reqLine.id]);
        if (lineRes.rows.length === 0) continue;
        const line = lineRes.rows[0];

        const newReceived = parseFloat(reqLine.qty_received);
        const currentReceived = parseFloat(line.qty_received);
        const deltaReceived = newReceived - currentReceived;

        const newRejected = parseFloat(reqLine.rejected_qty || 0);
        const currentRejected = parseFloat(line.rejected_qty);
        const deltaRejected = newRejected - currentRejected;

        const acceptedDelta = deltaReceived - deltaRejected;

        if (acceptedDelta > 0) {
          await writeStockMove(client, {
            productId: line.product_id, moveType: 'IN', qty: acceptedDelta,
            referenceType: 'PO', referenceId: line.id, referenceNumber: poRow.po_number,
            userId: req.user.id
          });

          if (poRow.source_type === 'auto_from_so' && poRow.source_ref) {
            const soLineRes = await client.query(`
              SELECT sl.id FROM so_lines sl
              JOIN sales_orders so ON so.id = sl.so_id
              WHERE so.so_number = $1 AND sl.product_id = $2 LIMIT 1
            `, [poRow.source_ref, line.product_id]);
            if (soLineRes.rows.length > 0) {
              await writeStockMove(client, {
                productId: line.product_id, moveType: 'RESERVE', qty: acceptedDelta,
                referenceType: 'SO', referenceId: soLineRes.rows[0].id, referenceNumber: poRow.source_ref,
                userId: req.user.id,
                notes: `Auto-reserved from PO ${poRow.po_number}`
              });
            }
          }
        }

        await client.query(`UPDATE po_lines SET qty_received = $1, rejected_qty = $2 WHERE id = $3`, [newReceived, newRejected, line.id]);
      }

      const checkRes = await client.query(`SELECT SUM(qty_ordered) as ord, SUM(qty_received) as rec FROM po_lines WHERE po_id = $1`, [id]);
      const isFully = parseFloat(checkRes.rows[0].ord) <= parseFloat(checkRes.rows[0].rec);
      const nextStatus = isFully ? 'fully_received' : 'partially_received';

      await client.query(`UPDATE purchase_orders SET status = $1, received_at = ${isFully ? 'NOW()' : 'received_at'}, updated_at = NOW() WHERE id = $2`, [nextStatus, id]);

      await auditLog(req, {
        module: 'Purchase', action: 'Status_Changed', entityType: 'purchase_order',
        entityId: id, entityRef: poRow.po_number, oldValue: poRow.status, newValue: nextStatus
      });

      return { nextStatus };
    });

    emitSocket(req, 'purchase:received', { id, status: po.nextStatus });
    res.json({ ok: true, status: po.nextStatus });
  } catch (err) { next(err); }
}

// ── POST /api/purchase/:id/cancel ─────────────────────────────
async function cancel(req, res, next) {
  try {
    const { id } = req.params;

    const result = await withTransaction(async (client) => {
      const poRes = await client.query('SELECT status, po_number FROM purchase_orders WHERE id = $1 FOR UPDATE', [id]);
      if (poRes.rows.length === 0) {
        const err = new Error('Purchase Order not found'); err.code = 'NOT_FOUND'; err.status = 404; throw err;
      }
      const poRow = poRes.rows[0];

      assertTransition('PO', poRow.status, 'cancelled');

      const lines = await client.query('SELECT SUM(qty_received) as total_rec FROM po_lines WHERE po_id = $1', [id]);
      if (parseFloat(lines.rows[0].total_rec) > 0) {
        return res.status(400).json({ error: 'Cannot cancel PO with received items' });
      }

      await client.query(`UPDATE purchase_orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]);

      await auditLog(req, {
        module: 'Purchase', action: 'Status_Changed', entityType: 'purchase_order',
        entityId: id, entityRef: poRow.po_number, oldValue: poRow.status, newValue: 'cancelled'
      });

      return poRow;
    });

    if (!res.headersSent) {
      emitSocket(req, 'purchase:cancelled', { id });
      res.json({ ok: true });
    }
  } catch (err) { next(err); }
}

// ── POST /api/purchase/:id/pay ──────────────────────────────
async function pay(req, res, next) {
  try {
    const { id } = req.params;
    const poRes = await query(
      `SELECT po.*, v.name AS vendor_name FROM purchase_orders po LEFT JOIN vendors v ON v.id = po.vendor_id WHERE po.id = $1`, [id]
    );
    if (poRes.rows.length === 0) return res.status(404).json({ error: 'PO not found' });
    const po = poRes.rows[0];

    if (po.payment_status === 'paid') return res.status(400).json({ error: 'Already paid' });
    if (po.status === 'draft') return res.status(400).json({ error: 'Confirm PO before payment' });
    const amount = Math.round(parseFloat(po.total_amount) * 100);
    if (amount <= 0) return res.status(400).json({ error: 'Amount must be > 0' });

    if (!rzp) {
      return res.status(503).json({ error: 'Razorpay not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env' });
    }

    const order = await rzp.orders.create({
      amount,
      currency: 'INR',
      receipt: po.po_number,
      notes: { po_id: po.id, vendor: po.vendor_name },
    });

    await query('UPDATE purchase_orders SET razorpay_order_id = $1 WHERE id = $2', [order.id, id]);

    res.json({
      razorpay_order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      po_number: po.po_number,
      vendor: po.vendor_name,
    });
  } catch (err) { next(err); }
}

// ── POST /api/purchase/payment/verify ─────────────────────
async function verifyPayment(req, res, next) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, po_id } = req.body;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const expected = crypto.createHmac('sha256', secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id).digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE purchase_orders SET payment_status = 'paid', razorpay_payment_id = $1 WHERE id = $2`,
        [razorpay_payment_id, po_id]
      );
      await auditLog(req, {
        module: 'Purchase', action: 'Payment_Verified', entityType: 'purchase_order',
        entityId: po_id, fieldName: 'payment_status', newValue: 'paid',
      });
    });

    req.app.locals.io?.emit('purchase:paid', { id: po_id });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── GET /api/purchase/:id/pdf ───────────────────────────────
async function generatePdf(req, res, next) {
  try {
    const { id } = req.params;
    const poRes = await query(
      `SELECT po.*, v.name AS vendor_name, u.full_name AS responsible_name
       FROM purchase_orders po
       LEFT JOIN vendors v ON v.id = po.vendor_id
       LEFT JOIN users u ON u.id = po.responsible_id
       WHERE po.id = $1`, [id]
    );
    if (poRes.rows.length === 0) return res.status(404).json({ error: 'PO not found' });
    const po = poRes.rows[0];

    const linesRes = await query(
      `SELECT pl.*, p.name AS product_name, p.sku
       FROM po_lines pl JOIN products p ON p.id = pl.product_id WHERE pl.po_id = $1`, [id]
    );
    const lines = linesRes.rows;
    const grandTotal = lines.reduce((sum, l) => sum + parseFloat(l.qty_ordered) * parseFloat(l.unit_price), 0);

    streamPDF(res, `po-${po.po_number}.pdf`, (doc) => {
      let y = header(doc, 'Purchase Order', `Vendor: ${po.vendor_name}`, po.po_number, po.status);

      kv(doc, 48, y, 'Vendor', po.vendor_name);
      kv(doc, 240, y, 'Responsible', po.responsible_name || '—');
      kv(doc, 390, y, 'Expected Delivery', po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString('en-IN') : 'Not set');
      y += 40;
      kv(doc, 48, y, 'Status', po.status.replace(/_/g, ' ').toUpperCase());
      kv(doc, 240, y, 'Payment Status', (po.payment_status || 'unpaid').toUpperCase());
      kv(doc, 390, y, 'Received At', po.received_at ? new Date(po.received_at).toLocaleDateString('en-IN') : 'Pending');
      y += 44;

      y = drawTable(doc, {
        headers: ['Product', 'SKU', 'Ordered', 'Received', 'Rejected', 'Unit Cost (₹)', 'Total (₹)'],
        rows: lines.map(l => [
          l.product_name, l.sku,
          parseFloat(l.qty_ordered).toFixed(2),
          parseFloat(l.qty_received).toFixed(2),
          parseFloat(l.rejected_qty).toFixed(2),
          parseFloat(l.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
          (parseFloat(l.qty_ordered) * parseFloat(l.unit_price)).toLocaleString('en-IN', { minimumFractionDigits: 2 })
        ]),
        startY: y,
        colWidths: [140, 60, 50, 55, 50, 80, 70],
        align: ['left', 'left', 'right', 'right', 'right', 'right', 'right'],
      });

      doc.fillColor('#0F1419').font('Helvetica-Bold').fontSize(11)
         .text(`Grand Total: ₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
               48, y, { align: 'right', width: doc.page.width - 96 });

      footer(doc);
    });
  } catch (err) { next(err); }
}

module.exports = { list, counts, getById, create, update, confirm, receive, cancel, pay, verifyPayment, generatePdf };
