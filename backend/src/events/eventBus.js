// eventBus.js - Transactional Outbox Implementation
const { query } = require('../config/db');

/**
 * Publish an event transactionally using the Outbox pattern.
 * The event is guaranteed to be saved if the surrounding transaction commits.
 * 
 * @param {import('pg').PoolClient} client - The transactional DB client
 * @param {string} eventType - The name of the event
 * @param {Object} payload - The event data payload
 */
async function publishEvent(client, eventType, payload) {
  await client.query(
    `INSERT INTO event_log (event_type, payload, status) VALUES ($1, $2, 'pending')`,
    [eventType, JSON.stringify(payload)]
  );
}

module.exports = { publishEvent };
