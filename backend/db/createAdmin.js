require('dotenv').config();
const bcrypt = require('bcrypt');
const { query } = require('../config/db');

async function createAdmin() {
  try {
    const hash = await bcrypt.hash('admin123', 10);
    await query(
      `INSERT INTO users (name, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (email) DO NOTHING`,
      ['Admin', 'admin@test.com', hash, 'admin']
    );
    console.log('✅ Admin user created: admin@test.com / admin123');
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}

createAdmin();
