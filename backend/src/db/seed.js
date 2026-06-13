const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function seed() {
  const seedPath = path.join(__dirname, 'seeds', 'seed.sql');
  let sql = fs.readFileSync(seedPath, 'utf-8');

  // Generate bcrypt hash for the default password
  const hash = await bcrypt.hash('password123', 10);

  // Replace all placeholders with the actual hash
  sql = sql.replace(/__BCRYPT_HASH__/g, hash);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear existing data in reverse dependency order
    const tables = [
      'passport_components', 'product_passports',
      'work_order_time_logs', 'work_orders', 'mo_components', 'manufacturing_orders',
      'stock_ledger', 'audit_logs',
      'so_lines', 'sales_orders',
      'po_lines', 'purchase_orders',
      'bom_operations', 'bom_components',
    ];

    // Remove default_bom_id references before clearing bom
    await client.query('UPDATE products SET default_bom_id = NULL WHERE default_bom_id IS NOT NULL');

    for (const table of tables) {
      await client.query(`DELETE FROM ${table}`);
    }
    await client.query('DELETE FROM bom');
    await client.query('DELETE FROM products');
    await client.query('DELETE FROM work_centers');
    await client.query('DELETE FROM customers');
    await client.query('DELETE FROM vendors');
    await client.query('DELETE FROM user_module_access');
    await client.query('DELETE FROM users');
    await client.query('DELETE FROM roles');

    // Reset sequences
    const sequences = [
      'roles_id_seq', 'users_id_seq', 'user_module_access_id_seq',
      'vendors_id_seq', 'customers_id_seq', 'work_centers_id_seq',
      'products_id_seq', 'bom_id_seq', 'bom_components_id_seq',
      'bom_operations_id_seq', 'sales_orders_id_seq', 'so_lines_id_seq',
      'purchase_orders_id_seq', 'po_lines_id_seq',
      'manufacturing_orders_id_seq', 'mo_components_id_seq',
      'work_orders_id_seq', 'work_order_time_logs_id_seq',
      'stock_ledger_id_seq', 'audit_logs_id_seq',
      'product_passports_id_seq', 'passport_components_id_seq',
    ];

    for (const seq of sequences) {
      await client.query(`ALTER SEQUENCE ${seq} RESTART WITH 1`);
    }

    // Execute seed SQL
    await client.query(sql);
    await client.query('COMMIT');

    // Print summary
    const counts = [
      'roles', 'users', 'user_module_access', 'vendors', 'customers',
      'work_centers', 'products', 'bom', 'bom_components', 'bom_operations',
      'purchase_orders', 'po_lines', 'sales_orders', 'so_lines',
      'manufacturing_orders', 'stock_ledger',
    ];

    process.stdout.write('\nSeed data loaded:\n');
    for (const table of counts) {
      const res = await pool.query(`SELECT COUNT(*) AS cnt FROM ${table}`);
      process.stdout.write(`  ${table}: ${res.rows[0].cnt} rows\n`);
    }
    process.stdout.write('\nSeeding complete.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    process.stderr.write(`Seed error: ${err.message}\n`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  process.stderr.write(`Seed error: ${err.message}\n`);
  process.exit(1);
});
