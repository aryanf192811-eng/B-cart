const { Router } = require('express');
const { requireAuth } = require('../../middleware/auth');
const { requireModule } = require('../../middleware/rbac');
const { query, withTransaction } = require('../../config/db');
const { auditLog } = require('../../middleware/audit');
const { streamPDF, header, kv, drawTable, footer, COLORS } = require('../../utils/pdf');

const router = Router();
router.use(requireAuth);

// ── GET /api/passports ────────────────────────────────────────
router.get('/', requireModule('Manufacturing', 'user'), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const conditions = [], params = [];
    let idx = 1;

    if (req.query.qc_status) { conditions.push(`pp.qc_status = $${idx++}`); params.push(req.query.qc_status); }
    if (req.query.product_id) { conditions.push(`pp.product_id = $${idx++}`); params.push(req.query.product_id); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const countRes = await query(`SELECT COUNT(*) AS total FROM product_passports pp ${where}`, params);
    const total = parseInt(countRes.rows[0].total);

    const { rows } = await query(
      `SELECT pp.*, p.name AS product_name, p.sku, u.full_name AS manufactured_by_name
       FROM product_passports pp
       JOIN products p ON p.id = pp.product_id
       LEFT JOIN users u ON u.id = pp.manufactured_by
       ${where}
       ORDER BY pp.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({ rows, total, page, limit });
  } catch (err) { next(err); }
});

// ── GET /api/passports/:id ────────────────────────────────────
router.get('/:id', requireModule('Manufacturing', 'user'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const ppRes = await query(
      `SELECT pp.*, p.name AS product_name, p.sku, u.full_name AS manufactured_by_name
       FROM product_passports pp
       JOIN products p ON p.id = pp.product_id
       LEFT JOIN users u ON u.id = pp.manufactured_by
       WHERE pp.id = $1`,
      [id]
    );
    if (ppRes.rows.length === 0) return res.status(404).json({ error: 'Passport not found' });

    const compsRes = await query(
      `SELECT pc.*, p.name AS component_name, p.sku AS component_sku, v.name AS vendor_name
       FROM passport_components pc
       JOIN products p ON p.id = pc.component_id
       LEFT JOIN vendors v ON v.id = pc.source_vendor_id
       WHERE pc.passport_id = $1`,
      [id]
    );

    const moRes = await query('SELECT * FROM manufacturing_orders WHERE id = $1', [ppRes.rows[0].mo_id]);

    const pp = ppRes.rows[0];
    pp.components = compsRes.rows;
    pp.manufacturing_order = moRes.rows[0] || null;

    res.json({ passport: pp });
  } catch (err) { next(err); }
});

// ── PUT /api/passports/:id/qc ─────────────────────────────────
router.put('/:id/qc', requireModule('Manufacturing', 'admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    if (!['passed', 'failed'].includes(status)) {
      return res.status(400).json({ error: "status must be 'passed' or 'failed'" });
    }

    const result = await withTransaction(async (client) => {
      const oldRes = await client.query('SELECT * FROM product_passports WHERE id = $1 FOR UPDATE', [id]);
      if (oldRes.rows.length === 0) {
        const err = new Error('Passport not found'); err.status = 404; throw err;
      }
      const oldRow = oldRes.rows[0];

      const { rows } = await client.query(
        `UPDATE product_passports
         SET qc_status = $1, qc_notes = $2, qc_reviewed_by = $3, qc_reviewed_at = NOW()
         WHERE id = $4 RETURNING *`,
        [status, notes || null, req.user.id, id]
      );

      await auditLog(req, {
        module: 'Manufacturing', action: 'Updated', entityType: 'product_passport',
        entityId: id, entityRef: oldRow.passport_id, fieldName: 'qc_status',
        oldValue: oldRow.qc_status, newValue: status,
      });

      return rows[0];
    });

    req.app.locals.io?.emit('passport:qc_updated', { id, status });
    res.json({ passport: result });
  } catch (err) { next(err); }
});

// ── GET /api/passports/:id/pdf ────────────────────────────────
router.get('/:id/pdf', requireModule('Manufacturing', 'user'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const ppRes = await query(
      `SELECT pp.*, p.name AS product_name, p.sku, u.full_name AS manufactured_by_name
       FROM product_passports pp
       JOIN products p ON p.id = pp.product_id
       LEFT JOIN users u ON u.id = pp.manufactured_by
       WHERE pp.id = $1`,
      [id]
    );
    if (ppRes.rows.length === 0) return res.status(404).json({ error: 'Passport not found' });

    const compsRes = await query(
      `SELECT pc.*, p.name AS component_name, p.sku AS component_sku, v.name AS vendor_name, po.po_number
       FROM passport_components pc
       JOIN products p ON p.id = pc.component_id
       LEFT JOIN vendors v ON v.id = pc.source_vendor_id
       LEFT JOIN purchase_orders po ON po.id = pc.source_po_id
       WHERE pc.passport_id = $1`,
      [id]
    );

    const pp = ppRes.rows[0];
    const comps = compsRes.rows;

    streamPDF(res, `passport-${pp.passport_id}.pdf`, (doc) => {
      let y = header(doc, 'Digital Product Passport', pp.product_name, pp.passport_id, pp.qc_status || 'pending');

      // QC band
      const qcColor = pp.qc_status === 'passed' ? COLORS.bandSuccess : pp.qc_status === 'failed' ? COLORS.bandDanger : COLORS.bandWarn;
      doc.rect(48, y, doc.page.width - 96, 20).fill(qcColor);
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9)
         .text(`QC STATUS: ${(pp.qc_status || 'pending').toUpperCase()}`, 56, y + 6);
      y += 28;

      // Hero passport ID
      doc.fillColor(COLORS.rust).font('Courier-Bold').fontSize(28)
         .text(pp.passport_id, 48, y, { align: 'center', width: doc.page.width - 96 });
      y += 44;

      // KV block
      kv(doc, 48, y, 'Product', pp.product_name);
      kv(doc, 240, y, 'SKU', pp.sku);
      kv(doc, 380, y, 'Batch Number', pp.batch_number);
      y += 40;
      kv(doc, 48, y, 'Manufactured By', pp.manufactured_by_name || 'System');
      kv(doc, 240, y, 'Date', new Date(pp.manufacture_date).toLocaleDateString('en-IN'));
      kv(doc, 380, y, 'Qty Produced', pp.qty_produced);
      y += 44;

      // Component traceability table
      doc.fillColor(COLORS.steel).font('Helvetica').fontSize(10).text('Component Traceability', 48, y);
      y += 14;
      y = drawTable(doc, {
        headers: ['Component', 'Qty Used', 'Vendor', 'Source PO', 'Batch Ref'],
        rows: comps.map(c => [
          c.component_name, c.qty_used, c.vendor_name || '—', c.po_number || '—', c.batch_reference || '—'
        ]),
        startY: y,
        colWidths: [160, 60, 120, 80, 80],
        align: ['left', 'right', 'left', 'left', 'left'],
      });

      // QC notes
      if (pp.qc_notes) {
        y += 8;
        doc.rect(48, y, doc.page.width - 96, 48).strokeColor(COLORS.rule).lineWidth(0.5).stroke();
        doc.fillColor(COLORS.steel).font('Helvetica').fontSize(8).text('QC NOTES', 56, y + 6);
        doc.fillColor(COLORS.ink).font('Helvetica').fontSize(9).text(pp.qc_notes, 56, y + 18, { width: doc.page.width - 112 });
      }

      footer(doc);
    });
  } catch (err) { next(err); }
});

module.exports = router;
