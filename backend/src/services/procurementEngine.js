const logger = require('../utils/logger');
const { writeStockMove } = require('./stockLedger');
const { nextNumber } = require('../utils/sequence');

/**
 * Auto-creates Purchase Orders and Manufacturing Orders when a Sales Order is confirmed.
 *
 * @param {import('pg').PoolClient} client - DB client inside a transaction
 * @param {Object} req - Express request
 * @param {Object} opts
 * @param {number} opts.soId - Sales Order ID
 */
async function runProcurement(client, req, { soId }) {
  const summary = {
    reserved: [],
    po_created: [],
    mo_created: [],
  };

  // 1. Load SO with all lines and joined product data
  const soResult = await client.query('SELECT so_number FROM sales_orders WHERE id = $1', [soId]);
  if (soResult.rows.length === 0) return summary;
  const soNumber = soResult.rows[0].so_number;

  const linesResult = await client.query(
    `SELECT sl.*, p.sku, p.name, p.procure_on_demand, p.procurement_type,
            p.default_vendor_id, p.default_bom_id, p.cost_price
     FROM so_lines sl
     JOIN products p ON p.id = sl.product_id
     WHERE sl.so_id = $1`,
    [soId]
  );

  const lines = linesResult.rows;

  // 2. For each so_line:
  for (const line of lines) {
    const qtyOrdered = parseFloat(line.qty_ordered);

    // a. Load product with current free_to_use_qty (lock product row FOR UPDATE)
    const pResult = await client.query(
      `SELECT id, on_hand_qty,
              (SELECT COALESCE(SUM(qty), 0) FROM stock_ledger WHERE product_id = p.id AND move_type = 'RESERVE') as total_reserved
       FROM products p WHERE id = $1 FOR UPDATE`,
      [line.product_id]
    );

    const product = pResult.rows[0];
    const onHand = parseFloat(product.on_hand_qty);
    const totalReserved = parseFloat(product.total_reserved);
    const freeToUse = Math.max(0, onHand - totalReserved);

    // b. shortfall = max(0, line.qty_ordered - free_to_use_qty)
    const shortfall = Math.max(0, qtyOrdered - freeToUse);

    // c. reserve_qty = min(line.qty_ordered, free_to_use_qty)
    const reserveQty = Math.min(qtyOrdered, freeToUse);

    // d. If reserve_qty > 0: writeStockMove(RESERVE)
    if (reserveQty > 0) {
      await writeStockMove(client, {
        productId: line.product_id,
        moveType: 'RESERVE',
        qty: reserveQty,
        referenceType: 'SO',
        referenceId: line.id, // using line ID or SO ID, using SO ID for reference tracking
        referenceNumber: soNumber,
        userId: req.user?.id,
        notes: `Reserved for SO line ${line.id}`,
      });
      summary.reserved.push({ productId: line.product_id, qty: reserveQty });
    }

    // e. If shortfall > 0 AND product.procure_on_demand = true:
    if (shortfall > 0 && line.procure_on_demand) {
      if (line.procurement_type === 'purchase') {
        if (!line.default_vendor_id) {
          throw new Error(`Product ${line.sku} requires a default vendor for purchasing.`);
        }

        // Auto-create a Purchase Order
        const poNumber = await nextNumber(client, 'PO', 'purchase_orders', 'po_number');
        const totalAmount = shortfall * parseFloat(line.cost_price || 0);

        const poResult = await client.query(
          `INSERT INTO purchase_orders (po_number, vendor_id, status, total_amount, source_type, source_ref, created_by)
           VALUES ($1, $2, 'draft', $3, 'auto_from_so', $4, $5) RETURNING id`,
          [poNumber, line.default_vendor_id, totalAmount, soNumber, req.user?.id]
        );
        const poId = poResult.rows[0].id;

        await client.query(
          `INSERT INTO po_lines (po_id, product_id, qty_ordered, unit_price)
           VALUES ($1, $2, $3, $4)`,
          [poId, line.product_id, shortfall, line.cost_price || 0]
        );

        // Audit
        await client.query(
          `INSERT INTO audit_logs (user_id, module, action, entity_type, entity_id, entity_ref)
           VALUES ($1, 'Purchase', 'Created', 'purchase_order', $2, $3)`,
          [req.user?.id, poId, poNumber]
        );

        summary.po_created.push(poId);

      } else if (line.procurement_type === 'manufacturing') {
        if (!line.default_bom_id) {
          throw new Error(`Product ${line.sku} requires a default BoM for manufacturing.`);
        }

        // Auto-create a Manufacturing Order
        const moNumber = await nextNumber(client, 'MO', 'manufacturing_orders', 'mo_number');

        const moResult = await client.query(
          `INSERT INTO manufacturing_orders (mo_number, product_id, bom_id, qty, status, source_type, source_ref, created_by)
           VALUES ($1, $2, $3, $4, 'draft', 'auto_from_so', $5, $6) RETURNING id`,
          [moNumber, line.product_id, line.default_bom_id, shortfall, soNumber, req.user?.id]
        );
        const moId = moResult.rows[0].id;

        // Populate mo_components
        const bomComponents = await client.query(
          `SELECT component_id, qty FROM bom_components WHERE bom_id = $1`,
          [line.default_bom_id]
        );
        for (const bc of bomComponents.rows) {
          await client.query(
            `INSERT INTO mo_components (mo_id, component_id, qty_required, qty_consumed)
             VALUES ($1, $2, $3, 0)`,
            [moId, bc.component_id, parseFloat(bc.qty) * shortfall]
          );
        }

        // Populate work_orders
        const bomOperations = await client.query(
          `SELECT work_center_id, name, duration_mins, sequence FROM bom_operations WHERE bom_id = $1 ORDER BY sequence`,
          [line.default_bom_id]
        );
        for (const op of bomOperations.rows) {
          await client.query(
            `INSERT INTO work_orders (mo_id, work_center_id, operation_name, sequence, status, duration_mins)
             VALUES ($1, $2, $3, $4, 'pending', $5)`,
            [moId, op.work_center_id, op.name, op.sequence, parseFloat(op.duration_mins) * shortfall]
          );
        }

        // Audit
        await client.query(
          `INSERT INTO audit_logs (user_id, module, action, entity_type, entity_id, entity_ref)
           VALUES ($1, 'Manufacturing', 'Created', 'manufacturing_order', $2, $3)`,
          [req.user?.id, moId, moNumber]
        );

        summary.mo_created.push(moId);
      }
    }
  }

  // 4. Emit socket events
  if (req.app.locals.io) {
    req.app.locals.io.emit('procurement:triggered', { soNumber, summary });
  }

  return summary;
}

module.exports = { runProcurement };
