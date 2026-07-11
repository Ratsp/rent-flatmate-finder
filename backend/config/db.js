const { Pool } = require('pg');

// Create connection pool using DATABASE_URL from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false  // Required for Supabase connections
  },
  max: 10,                     // Max connections in pool
  idleTimeoutMillis: 30000,    // Close idle connections after 30s
  connectionTimeoutMillis: 5000 // Timeout if connection takes > 5s
});

// Log pool errors (don't crash the server)
pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err.message);
});

/**
 * Execute a parameterized SQL query.
 * Always use parameterized queries ($1, $2, ...) to prevent SQL injection.
 * 
 * @param {string} text - SQL query with $1, $2, ... placeholders
 * @param {Array} params - Parameter values
 * @returns {Promise<import('pg').QueryResult>} Query result
 * 
 * @example
 * const { rows } = await query('SELECT * FROM users WHERE email = $1', ['user@example.com']);
 */
const query = async (text, params) => {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  // Log slow queries (> 500ms) for performance monitoring
  if (duration > 500) {
    console.warn(`⚠️  Slow query (${duration}ms):`, text.substring(0, 100));
  }

  return result;
};

/**
 * Get a client from the pool for transactions.
 * Remember to call client.release() when done!
 * 
 * @example
 * const client = await getClient();
 * try {
 *   await client.query('BEGIN');
 *   await client.query('INSERT ...', [...]);
 *   await client.query('COMMIT');
 * } catch (err) {
 *   await client.query('ROLLBACK');
 *   throw err;
 * } finally {
 *   client.release();
 * }
 */
const getClient = () => pool.connect();

/**
 * Test database connection on startup.
 */
const testConnection = async () => {
  try {
    const result = await query('SELECT NOW() AS server_time');
    console.log('✅ Database connected:', result.rows[0].server_time);
    return true;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    return false;
  }
};

module.exports = { query, getClient, testConnection, pool };
