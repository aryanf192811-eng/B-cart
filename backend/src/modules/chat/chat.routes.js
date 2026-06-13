const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../../middleware/auth');
const { query } = require('../../config/db');
const fs = require('fs');
const path = require('path');

let Groq;
try {
  Groq = require('groq-sdk');
} catch { Groq = null; }

const router = Router();
router.use(requireAuth);

function generateCsv(ctx) {
  const lines = ['section,field,value'];
  for (const prod of (ctx.products || [])) {
    lines.push(`products,${prod.sku} - ${prod.name},on_hand=${prod.on_hand_qty} free=${prod.free_to_use_qty} min=${prod.min_stock_qty}`);
  }
  for (const v of (ctx.topVendors || [])) {
    lines.push(`vendors,${v.name},score=${v.reliability_score}`);
  }
  for (const a of (ctx.alerts || [])) {
    lines.push(`alerts,${a.alert_type},${a.message}`);
  }
  return lines.join('\n');
}

async function buildContext() {
  const [productsRes, lowStockRes, openSoRes, openMoRes, openPoRes, topVendorsRes, alertsRes] = await Promise.all([
    query(`SELECT id, name, sku, on_hand_qty, free_to_use_qty, min_stock_qty, unit FROM product_stock_view LIMIT 50`),
    query(`SELECT id, name, sku, on_hand_qty, unit FROM product_stock_view WHERE is_low_stock = true`),
    query(`SELECT status, COUNT(*) AS cnt FROM sales_orders GROUP BY status`),
    query(`SELECT status, COUNT(*) AS cnt FROM manufacturing_orders GROUP BY status`),
    query(`SELECT status, COUNT(*) AS cnt FROM purchase_orders GROUP BY status`),
    query(`SELECT name, reliability_score FROM vendor_reliability_view LIMIT 5`),
    query(`
      SELECT 'STOCK_CRITICAL' AS alert_type, p.name AS message
      FROM products p WHERE p.on_hand_qty < p.min_stock_qty AND p.is_active = true
      UNION ALL
      SELECT 'DELAYED_ORDER', so.so_number
      FROM sales_orders so WHERE so.status='confirmed' AND so.confirmed_at < NOW()-INTERVAL '3 days'
      LIMIT 10
    `),
  ]);

  return {
    products: productsRes.rows,
    lowStock: lowStockRes.rows,
    openSO: openSoRes.rows,
    openMO: openMoRes.rows,
    openPO: openPoRes.rows,
    topVendors: topVendorsRes.rows,
    alerts: alertsRes.rows,
  };
}

// ── POST /api/chat ────────────────────────────────────────────
router.post('/',
  [body('message').isString().isLength({ min: 1, max: 2000 }).withMessage('Message required (max 2000 chars)')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    try {
      const { message, history } = req.body;
      const ctx = await buildContext();

      const apiKey = process.env.GROQ_API_KEY;
      const useGroq = Groq && apiKey && apiKey !== '' && apiKey !== 'paste_here';

      if (useGroq) {
        const groq = new Groq({ apiKey });
        const systemPrompt = `You are the assistant for B-cart for Shiv Furniture Works. Answer using ONLY the LIVE_CONTEXT below. If asked a question that needs data not in context, say so. Be concise, use ₹ for prices, never invent SKUs or numbers.

LIVE_CONTEXT: ${JSON.stringify(ctx)}`;

        const messages = [
          { role: 'system', content: systemPrompt },
          ...(history || []).map(m => ({ 
            role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user', 
            content: m.parts ? m.parts[0].text : m.content || '' 
          })),
          { role: 'user', content: message }
        ];

        const chatCompletion = await groq.chat.completions.create({
          messages: messages,
          model: 'llama3-8b-8192',
          temperature: 0.3,
          max_tokens: 800,
        });

        return res.json({
          response: chatCompletion.choices[0]?.message?.content || '',
          source: 'groq',
          context_size: JSON.stringify(ctx).length,
        });
      }

      // CSV fallback
      const tmpDir = path.join(__dirname, '../../../tmp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const csvPath = path.join(tmpDir, 'erp_snapshot.csv');
      fs.writeFileSync(csvPath, generateCsv(ctx));

      const text = message.toLowerCase();
      let reply;
      if (text.includes('low stock') || text.includes('shortage')) {
        reply = ctx.lowStock.length
          ? `${ctx.lowStock.length} products are below their minimum stock level: ${ctx.lowStock.map(p => `${p.name} (${p.on_hand_qty} ${p.unit})`).join(', ')}`
          : 'All products are at or above minimum stock levels.';
      } else if (text.includes('vendor') || text.includes('supplier')) {
        reply = `Top vendors by reliability: ${ctx.topVendors.map(v => `${v.name} (${v.reliability_score}%)`).join(', ')}`;
      } else if (text.includes('alert') || text.includes('issue')) {
        reply = ctx.alerts.length ? ctx.alerts.map(a => `• [${a.alert_type}] ${a.message}`).join('\n') : 'No active alerts.';
      } else if (text.includes('stock') || text.includes('inventory')) {
        reply = `Total products: ${ctx.products.length}. Low stock items: ${ctx.lowStock.length}. Snapshot saved to /tmp/erp_snapshot.csv.`;
      } else if (text.includes('order') || text.includes('sales')) {
        const soStr = ctx.openSO.map(s => `${s.status}: ${s.cnt}`).join(', ');
        reply = `Sales orders by status — ${soStr}.`;
      } else if (text.includes('manufactur') || text.includes('production')) {
        const moStr = ctx.openMO.map(m => `${m.status}: ${m.cnt}`).join(', ');
        reply = `Manufacturing orders by status — ${moStr}.`;
      } else {
        reply = `I'm running in offline mode (no Groq API key configured). Snapshot CSV available at /api/chat/snapshot.csv. Try asking about low stock, vendors, alerts, orders, or inventory.`;
      }

      return res.json({ response: reply, source: 'csv_fallback' });
    } catch (err) { next(err); }
  }
);

// ── GET /api/chat/snapshot.csv ────────────────────────────────
router.get('/snapshot.csv', async (req, res, next) => {
  try {
    const ctx = await buildContext();
    const csv = generateCsv(ctx);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="erp_snapshot.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

module.exports = router;
