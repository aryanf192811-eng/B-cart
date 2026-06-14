const eventBus = require('./eventBus');
const { runProcurement } = require('../services/procurementEngine');
const { withTransaction } = require('../config/db');

function initSubscribers() {
  eventBus.on('SalesOrderConfirmed', async (payload) => {
    const { soId, req } = payload;
    try {
      console.log(`[EventBus] Processing SalesOrderConfirmed for SO ID: ${soId}`);
      await withTransaction(async (client) => {
        await runProcurement(client, req, { soId });
      });
      console.log(`[EventBus] Successfully processed SalesOrderConfirmed for SO ID: ${soId}`);
    } catch (err) {
      console.error(`[EventBus] Error processing SalesOrderConfirmed for SO ID ${soId}:`, err);
    }
  });

  // Example of another event
  eventBus.on('PurchaseOrderReceived', async (payload) => {
    const { poId } = payload;
    console.log(`[EventBus] PurchaseOrderReceived for PO ID: ${poId}. Auto-billing could go here.`);
  });
}

module.exports = { initSubscribers };
