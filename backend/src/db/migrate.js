const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function migrate() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const client = await pool.connect();

  try {
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('COMMIT');
        process.stdout.write(`\u2713 ${file} applied\n`);
      } catch (err) {
        await client.query('ROLLBACK');
        process.stderr.write(`\u2717 ${file} FAILED: ${err.message}\n`);
        process.exit(1);
      }
    }

    process.stdout.write('\nAll migrations applied successfully.\n');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  process.stderr.write(`Migration error: ${err.message}\n`);
  process.exit(1);
});
