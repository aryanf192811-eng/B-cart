const { query } = require('../config/db');

/**
 * Recalculate product cost using Weighted Moving Average
 * @param {import('pg').PoolClient} client 
 * @param {Object} params 
 * @param {number} params.productId
 * @param {number} params.newQty
 * @param {number} params.newCost
 * @param {string} params.sourceType
 * @param {number} params.sourceId
 * @param {number} params.userId
 */
async function applyWeightedMovingAverage(client, {
  productId,
  newQty,
  newCost,
  sourceType,
  sourceId,
  userId
}) {
  if (newQty <= 0) return; // Only average in when adding stock

  // Lock the product for valuation update
  const { rows } = await client.query(
    'SELECT cost_price FROM products WHERE id = $1 FOR UPDATE',
    [productId]
  );

  if (rows.length === 0) throw new Error('Product not found');

  const oldCost = parseFloat(rows[0].cost_price || 0);

  // Get current on-hand quantity from the single source of truth view
  const qtyRes = await client.query(
    'SELECT on_hand_qty FROM product_stock_view WHERE id = $1',
    [productId]
  );
  
  const oldQty = parseFloat(qtyRes.rows[0]?.on_hand_qty || 0);

  // WMA formula
  let calculatedCost = oldCost;
  if (oldQty + newQty > 0) {
    calculatedCost = ((oldQty * oldCost) + (newQty * newCost)) / (oldQty + newQty);
  } else {
    calculatedCost = newCost; // Fallback if somehow total qty is 0
  }

  // Round to 2 decimal places
  calculatedCost = Math.round(calculatedCost * 100) / 100;

  if (calculatedCost !== oldCost) {
    await client.query(
      'UPDATE products SET cost_price = $1, updated_at = NOW() WHERE id = $2',
      [calculatedCost, productId]
    );

    await client.query(
      `INSERT INTO product_valuation_history 
        (product_id, old_cost, new_cost, qty_before, qty_added, source_type, source_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [productId, oldCost, calculatedCost, oldQty, newQty, sourceType, sourceId, userId]
    );
  }

  return calculatedCost;
}

module.exports = { applyWeightedMovingAverage };
