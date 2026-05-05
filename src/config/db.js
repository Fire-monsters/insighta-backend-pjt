require('dotenv').config();
console.log('DB URL:', process.env.DATABASE_URL); // add this
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('Unexpected DB error', err);
  process.exit(-1);
});

module.exports = pool;

