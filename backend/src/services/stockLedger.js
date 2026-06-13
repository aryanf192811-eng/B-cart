const logger = require('../utils/logger');

/**
 * THE single way stock changes happen in the system.
 * Every mutation writes an append-only stock_ledger row.
 *
 * @param {import('pg').PoolClient} client - must be inside a transaction
 * @param {Object} params
 * @param {number} params.productId
 * @param {'IN'|'OUT'|'RESERVE'|'UNRESERVE'|'ADJUST'} params.moveType
 * @param {number} params.qty        - positive number always
 * @param {string} params.referenceType - 'SO','PO','MO','MANUAL'
 * @param {number} [params.referenceId]
 * @param {string} [params.referenceNumber]
 * @param {number} [params.userId]
 * @param {string} [params.notes]
 */
async function writeStockMove(client, {
  productId,
  moveType,
  qty,
  referenceType,
  referenceId = null,
  referenceNumber = null,
  userId = null,
  notes = null,
}) {
  // Lock the product row to prevent concurrent on_hand updates
  const { rows: productRows } = await client.query(
    'SELECT id, on_hand_qty FROM products WHERE id = $1 FOR UPDATE',
    [productId]
  );

  if (productRows.length === 0) {
    const err = new Error(`Product with id ${productId} not found`);
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  let currentQty = parseFloat(productRows[0].on_hand_qty);
  let newQty = currentQty;

  // Determine new on_hand_qty based on move type
  if (moveType === 'IN') {
    newQty = currentQty + qty;
  } else if (moveType === 'OUT') {
    if (currentQty < qty) {
      const err = new Error(
        `Insufficient stock for product ${productId}: have ${currentQty}, need ${qty}`
      );
      err.code = 'INSUFFICIENT_STOCK';
      err.status = 422;
      throw err;
    }
    newQty = currentQty - qty;
  } else if (moveType === 'ADJUST') {
    // qty can be positive (add) or negative (subtract)
    newQty = currentQty + qty;
    if (newQty < 0) {
      const err = new Error(
        `Adjustment would result in negative stock for product ${productId}`
      );
      err.code = 'INSUFFICIENT_STOCK';
      err.status = 422;
      throw err;
    }
  }
  // RESERVE and UNRESERVE do NOT change on_hand_qty

  // Update on_hand_qty for IN, OUT, ADJUST
  if (['IN', 'OUT', 'ADJUST'].includes(moveType)) {
    await client.query(
      'UPDATE products SET on_hand_qty = $1, updated_at = NOW() WHERE id = $2',
      [newQty, productId]
    );
  }

  // Insert stock_ledger row (append-only)
  const balanceAfter = ['IN', 'OUT', 'ADJUST'].includes(moveType)
    ? newQty
    : currentQty; // For RESERVE/UNRESERVE, balance doesn't change

  const { rows: ledgerRows } = await client.query(
    `INSERT INTO stock_ledger
       (product_id, move_type, qty, reference_type, reference_id, reference_number,
        balance_after, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [productId, moveType, qty, referenceType, referenceId, referenceNumber,
     balanceAfter, notes, userId]
  );

  logger.info('Stock move recorded', {
    ledgerId: ledgerRows[0].id,
    productId,
    moveType,
    qty,
    balanceAfter,
    referenceNumber,
  });

  return { ledgerId: ledgerRows[0].id, balanceAfter };
}

/**
 * Get total reserved quantity for a product.
 */
async function getReservedQty(client, productId) {
  const { rows } = await client.query(
    `SELECT COALESCE(reserved_qty, 0) AS reserved_qty
     FROM product_stock_view WHERE id = $1`,
    [productId]
  );
  return rows.length > 0 ? parseFloat(rows[0].reserved_qty) : 0;
}

/**
 * Get free-to-use quantity for a product.
 */
async function getFreeToUse(client, productId) {
  const { rows } = await client.query(
    `SELECT COALESCE(free_to_use_qty, 0) AS free_to_use_qty
     FROM product_stock_view WHERE id = $1`,
    [productId]
  );
  return rows.length > 0 ? parseFloat(rows[0].free_to_use_qty) : 0;
}

module.exports = { writeStockMove, getReservedQty, getFreeToUse };
