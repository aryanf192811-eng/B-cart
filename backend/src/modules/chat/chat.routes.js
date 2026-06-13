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

function generateJson(ctx) {
  return JSON.stringify(ctx, null, 2);
}

async function buildContext() {
  const [productsRes, lowStockRes, openSoRes, openMoRes, openPoRes, topVendorsRes, alertsRes, workCentersRes] = await Promise.all([
    query(`SELECT id, name, sku, on_hand_qty, free_to_use_qty, min_stock_qty, unit FROM product_stock_view LIMIT 50`),
    query(`SELECT id, name, sku, on_hand_qty, unit FROM product_stock_view WHERE is_low_stock = true`),
    query(`SELECT status, COUNT(*) AS cnt FROM sales_orders GROUP BY status`),
    query(`SELECT status, COUNT(*) AS cnt FROM manufacturing_orders GROUP BY status`),
    query(`SELECT status, COUNT(*) AS cnt FROM purchase_orders GROUP BY status`),
    query(`SELECT name, reliability_score FROM vendor_reliability_view ORDER BY reliability_score DESC NULLS LAST LIMIT 5`),
    query(`
      SELECT 'STOCK_CRITICAL' AS alert_type, p.name AS message
      FROM products p WHERE p.on_hand_qty < p.min_stock_qty AND p.is_active = true
      UNION ALL
      SELECT 'DELAYED_ORDER', so.so_number
      FROM sales_orders so WHERE so.status='confirmed' AND so.confirmed_at < NOW()-INTERVAL '3 days'
      LIMIT 10
    `),
    query(`SELECT name, capacity_per_hour FROM work_centers`)
  ]);

  return {
    products: productsRes.rows,
    lowStock: lowStockRes.rows,
    openSO: openSoRes.rows,
    openMO: openMoRes.rows,
    openPO: openPoRes.rows,
    topVendors: topVendorsRes.rows,
    alerts: alertsRes.rows,
    workCenters: workCentersRes.rows
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
        const systemPrompt = `You are the operations assistant for B-cart, an ERP system for Shiv Furniture Works.
Answer using ONLY the LIVE_CONTEXT below.
If asked a question that needs data not in context, politely say that you don't have access to that information right now.
Provide highly analytical and concise responses. Use ₹ for prices. Never invent SKUs or numbers.
You have context regarding inventory levels, active orders (sales, manufacturing, purchase), top vendors, active alerts, and work centers. Use this data to help the user understand their operations.

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
          model: 'llama-3.1-8b-instant',
          temperature: 0.3,
          max_tokens: 800,
        });

        return res.json({
          response: chatCompletion.choices[0]?.message?.content || '',
          source: 'groq',
          context_size: JSON.stringify(ctx).length,
        });
      }

      // JSON fallback
      const tmpDir = path.join(__dirname, '../../../tmp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const jsonPath = path.join(tmpDir, 'erp_snapshot.json');
      fs.writeFileSync(jsonPath, generateJson(ctx));

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
      } else if (text.includes('stock') || text.includes('inventory') || text.includes('product')) {
        reply = `Total products in system: ${ctx.products.length}. Low stock items: ${ctx.lowStock.length}. We currently have ${ctx.alerts.filter(a => a.alert_type === 'STOCK_CRITICAL').length} critical stock alerts.`;
      } else if (text.includes('order') || text.includes('sales') || text.includes('purchase')) {
        const soStr = ctx.openSO.map(s => `${s.status}: ${s.cnt}`).join(', ') || 'None';
        const poStr = ctx.openPO.map(s => `${s.status}: ${s.cnt}`).join(', ') || 'None';
        reply = `Sales orders by status: ${soStr}. Purchase orders by status: ${poStr}.`;
      } else if (text.includes('manufactur') || text.includes('production') || text.includes('mo')) {
        const moStr = ctx.openMO.map(m => `${m.status}: ${m.cnt}`).join(', ') || 'None';
        reply = `Manufacturing orders by status: ${moStr}. Active work centers: ${ctx.workCenters.map(w => `${w.name} (${w.capacity_per_hour}/hr)`).join(', ')}.`;
      } else {
        reply = `I'm running in offline mode (no Groq API key configured). Snapshot JSON available at /api/chat/snapshot.json. Try asking about:\n- Low stock items\n- Best vendors\n- Alerts and issues\n- Inventory overview\n- Sales & Purchase orders\n- Manufacturing capacity & active orders`;
      }

      return res.json({ response: reply, source: 'json_fallback' });
    } catch (err) { next(err); }
  }
);

// ── GET /api/chat/snapshot.json ────────────────────────────────
router.get('/snapshot.json', async (req, res, next) => {
  try {
    const ctx = await buildContext();
    const jsonStr = generateJson(ctx);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="erp_snapshot.json"');
    res.send(jsonStr);
  } catch (err) { next(err); }
});

module.exports = router;
