require('dotenv').config();
const fs = require('fs');
const { getClient } = require('../config/db');

async function runSchema() {
  const client = await getClient();
  
  try {
    const sql = fs.readFileSync(__dirname + '/schema.sql', 'utf8');
    
    // Run the entire SQL file as a single transaction
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('\n✅ Schema executed successfully!\n');

    // Verify tables
    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
    );
    console.log('📋 Tables created:');
    tables.rows.forEach(r => console.log('  ✓', r.table_name));
    console.log(`\n  Total: ${tables.rows.length} tables\n`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Schema error:', err.message);
    if (err.position) {
      console.error('  At position:', err.position);
    }
  } finally {
    client.release();
  }
  
  process.exit(0);
}

runSchema();
