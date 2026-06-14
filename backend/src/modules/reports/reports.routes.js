const { Router } = require('express');
const { requireAuth } = require('../../middleware/auth');
const { query } = require('../../config/db');
const { streamPDF, header, kv, drawTable, footer, COLORS } = require('../../utils/pdf');

const router = Router();
router.use(requireAuth);

// ── GET /api/reports/stock/pdf ────────────────────────────────
router.get('/stock/pdf', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const fromDate = from || '2000-01-01';
    const toDate = to || new Date().toISOString().slice(0, 10);

    // Per-product stock movement summary
    const { rows: products } = await query(`
      SELECT p.id, p.sku, p.name, p.unit, p.cost_price,
             COALESCE(SUM(CASE WHEN sl.move_type = 'IN' AND sl.created_at BETWEEN $1 AND $2::date + INTERVAL '1 day' THEN sl.qty ELSE 0 END), 0) AS period_in,
             COALESCE(SUM(CASE WHEN sl.move_type = 'OUT' AND sl.created_at BETWEEN $1 AND $2::date + INTERVAL '1 day' THEN sl.qty ELSE 0 END), 0) AS period_out,
             (SELECT COALESCE(sl2.balance_after, psv.on_hand_qty)
              FROM stock_ledger sl2 WHERE sl2.product_id = p.id AND sl2.created_at < $1
              ORDER BY sl2.created_at DESC LIMIT 1) AS opening_qty,
             psv.on_hand_qty AS closing_qty
      FROM products p
      LEFT JOIN product_stock_view psv ON psv.id = p.id
      LEFT JOIN stock_ledger sl ON sl.product_id = p.id
      WHERE p.is_active = true
      GROUP BY p.id, p.sku, p.name, p.unit, p.cost_price, psv.on_hand_qty
      ORDER BY p.name
    `, [fromDate, toDate]);

    streamPDF(res, `stock-report-${fromDate}-${toDate}.pdf`, (doc) => {
      let y = header(doc, 'Stock Movement Report', `Period: ${fromDate}  to  ${toDate}`, null, null);

      y = drawTable(doc, {
        headers: ['Product', 'SKU', 'Opening', 'IN', 'OUT', 'Closing', 'Value (₹)'],
        rows: products.map(p => {
          const opening = parseFloat(p.opening_qty || 0);
          const value = (parseFloat(p.closing_qty) * parseFloat(p.cost_price)).toFixed(2);
          return [p.name, p.sku, opening.toFixed(2), parseFloat(p.period_in).toFixed(2),
                  parseFloat(p.period_out).toFixed(2), parseFloat(p.closing_qty).toFixed(2), value];
        }),
        startY: y,
        colWidths: [160, 70, 55, 55, 55, 55, 75],
        align: ['left', 'left', 'right', 'right', 'right', 'right', 'right'],
      });

      footer(doc);
    });
  } catch (err) { next(err); }
});

// ── GET /api/reports/vendor/pdf ───────────────────────────────
router.get('/vendor/pdf', async (req, res, next) => {
  try {
    const { rows: vendors } = await query(`
      SELECT * FROM vendor_reliability_view ORDER BY reliability_score DESC
    `);

    streamPDF(res, `vendor-performance-report.pdf`, (doc) => {
      let y = header(doc, 'Vendor Performance Report', `Ranking by reliability score — All time`, null, null);

      // Colored rows by score
      const x0 = 48;
      const colWidths = [30, 160, 55, 65, 80, 65, 55];
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);
      const rowH = 20, headerH = 24;

      doc.rect(x0, y, tableWidth, headerH).fill(COLORS.ink);
      ['#', 'Vendor', 'Orders', 'On-Time %', 'Fulfillment %', 'Quality %', 'Score'].forEach((h, i) => {
        const cx = x0 + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.fillColor('#FAFAF7').font('Helvetica-Bold').fontSize(9)
           .text(h, cx + 4, y + 8, { width: colWidths[i] - 8, align: i > 1 ? 'right' : 'left' });
      });
      y += headerH;

      vendors.forEach((v, ri) => {
        const score = parseFloat(v.reliability_score || 0);
        const bandColor = score >= 85 ? '#D1FAE5' : score >= 70 ? '#FEF3C7' : '#FEE2E2';
        doc.rect(x0, y, tableWidth, rowH).fill(bandColor);

        const cells = [ri + 1, v.name, v.total_orders, v.on_time_rate, v.fulfillment_rate, v.quality_rate, score];
        cells.forEach((cell, ci) => {
          const cx = x0 + colWidths.slice(0, ci).reduce((a, b) => a + b, 0);
          const textColor = ci === 6 ? (score >= 85 ? COLORS.bandSuccess : score >= 70 ? '#92400E' : COLORS.bandDanger) : COLORS.ink;
          doc.fillColor(textColor).font(ci > 1 ? 'Courier' : 'Helvetica').fontSize(9)
             .text(String(cell ?? ''), cx + 4, y + 6, { width: colWidths[ci] - 8, align: ci > 1 ? 'right' : 'left' });
        });
        y += rowH;
      });

      y += 8;
      // Legend
      doc.fillColor(COLORS.steel).font('Helvetica').fontSize(8).text('Score bands: ≥85 green · 70–84 amber · <70 red', 48, y);

      footer(doc);
    });
  } catch (err) { next(err); }
});

module.exports = router;
