require('dotenv').config();
const { Pool, types } = require('pg');

// ---------------------------------------------------------------------------
// Result-parsing performance
// ---------------------------------------------------------------------------
// By default `pg` parses DATE columns into JS Date objects — per row × date
// column it allocates a Date and runs timezone math. The app only ever
// consumes these fields as strings (the frontend does String(x).slice(0, 10)
// and builds `${due_date}T${due_time}`; the digest route re-formats them), so
// returning the raw PostgreSQL text is faster and avoids allocations. TIME /
// TIMESTAMP / TIMESTAMPTZ are kept as strings for the same reason.
const passthrough = (v) => v; // raw string straight from Postgres
types.setTypeParser(1082, passthrough); // date        → 'YYYY-MM-DD'
types.setTypeParser(1083, passthrough); // time        → 'HH:MM:SS'
types.setTypeParser(1114, passthrough); // timestamp   → 'YYYY-MM-DD HH:MM:SS'
types.setTypeParser(1184, passthrough); // timestamptz → ISO-ish string

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Tune the connection pool for throughput under concurrent load (the UI
  // polls /tasks every few seconds, so many short queries hit the API).
  max: Number(process.env.PG_POOL_MAX || 20),
  idleTimeoutMillis: Number(process.env.PG_POOL_IDLE_MS || 30000),
  connectionTimeoutMillis: Number(process.env.PG_POOL_CONN_TIMEOUT_MS || 5000),
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
