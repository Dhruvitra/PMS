
const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:123456@localhost:5432/clickup_pms?schema=public'
});

async function check() {
  try {
    await client.connect();
    console.log('Database connected successfully!');
    const res = await client.query('SELECT NOW()');
    console.log('Current time from DB:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
}

check();
