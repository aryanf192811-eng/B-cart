/**
 * Generate next sequential number like 'SO-000001'.
 * Uses Postgres advisory locks to serialize access per prefix.
 *
 * @param {import('pg').PoolClient} client - DB client inside a transaction
 * @param {string} prefix - e.g. 'SO', 'PO', 'MO'
 * @param {string} table  - table name to scan
 * @param {string} column - column containing the sequence string
 * @returns {Promise<string>} e.g. 'SO-000001'
 */
async function nextNumber(client, prefix, table, column) {
  // Advisory lock scoped to this transaction, keyed by prefix
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [prefix]);

  const { rows } = await client.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(${column} FROM '[0-9]+$') AS INTEGER)), 0) + 1 AS next
     FROM ${table}`
  );

  return `${prefix}-${String(rows[0].next).padStart(6, '0')}`;
}

module.exports = { nextNumber };
