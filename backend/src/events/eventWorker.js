const { pool, logger } = require('../config/db');
const { runProcurement } = require('../services/procurementEngine');

// Define handlers for each event type
const handlers = {
  SalesOrderConfirmed: async (client, payload) => {
    const { soId, userId } = payload;
    // We mock the `req` object for runProcurement because it expects `req.user.id` and `req.app.locals.io`
    // In a real refactor, runProcurement should just take `userId` and an `io` reference directly.
    const reqMock = { user: { id: userId }, app: { locals: { io: global.io } } };
    await runProcurement(client, reqMock, { soId });
  },
  PurchaseOrderReceived: async (client, payload) => {
    const { poId } = payload;
    logger.info(`[EventWorker] Processing PO Received for PO: ${poId}`);
  }
};

async function processEvents() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Lock 1 pending event
    const res = await client.query(`
      SELECT * FROM event_log 
      WHERE status = 'pending' 
      ORDER BY id ASC 
      LIMIT 1 
      FOR UPDATE SKIP LOCKED
    `);

    if (res.rows.length === 0) {
      await client.query('COMMIT');
      return false; // No events processed
    }

    const event = res.rows[0];
    await client.query(`UPDATE event_log SET status = 'processing' WHERE id = $1`, [event.id]);
    await client.query('COMMIT'); // Commit the lock and state change so other workers don't grab it

    // Now process the event
    let success = false;
    let errorMsg = null;
    
    const handlerClient = await pool.connect();
    try {
      await handlerClient.query('BEGIN');
      const handler = handlers[event.event_type];
      if (handler) {
        await handler(handlerClient, event.payload);
      } else {
        logger.warn(`[EventWorker] No handler found for event type: ${event.event_type}`);
      }
      await handlerClient.query('COMMIT');
      success = true;
    } catch (err) {
      await handlerClient.query('ROLLBACK');
      errorMsg = err.message;
      logger.error(`[EventWorker] Event ${event.id} failed:`, err);
    } finally {
      handlerClient.release();
    }

    // Update final state
    const updateClient = await pool.connect();
    try {
      if (success) {
        await updateClient.query(`UPDATE event_log SET status = 'processed', processed_at = NOW() WHERE id = $1`, [event.id]);
      } else {
        await updateClient.query(`UPDATE event_log SET status = 'failed', error_msg = $1 WHERE id = $2`, [errorMsg, event.id]);
      }
    } finally {
      updateClient.release();
    }

    return true; // Event processed (successfully or failed)
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[EventWorker] Worker error:', err);
    return false;
  } finally {
    client.release();
  }
}

let workerInterval;

function startEventWorker() {
  logger.info('[EventWorker] Starting Outbox worker...');
  workerInterval = setInterval(async () => {
    let processed = true;
    // Drain queue as fast as possible if events exist
    while (processed) {
      processed = await processEvents();
    }
  }, 2000); // Polling interval
}

function stopEventWorker() {
  if (workerInterval) clearInterval(workerInterval);
}

module.exports = { startEventWorker, stopEventWorker, handlers };
