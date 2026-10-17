// tasksRepo.js — the ONLY place task SQL lives. Both REST routes and the AI
// assistant execute through these functions, so AI proposals go through the
// same validation/whitelisting as normal API traffic (no arbitrary queries).
const db = require('../db');

const COLUMNS = 'id, title, description, due_date, due_time, priority, tags, status, snooze_until, created_at, updated_at';

async function list({ status, priority, tag, showSnoozed = false } = {}) {
  const where = [];
  const params = [];
  if (status) { params.push(status); where.push(`status = $${params.length}`); }
  if (priority) { params.push(priority); where.push(`priority = $${params.length}`); }
  if (tag) { params.push(String(tag).toLowerCase()); where.push(`$${params.length} = ANY(tags)`); }
  if (!showSnoozed) { params.push(new Date()); where.push(`(snooze_until IS NULL OR snooze_until <= $${params.length})`); }
  const sql = `SELECT ${COLUMNS} FROM tasks ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at ASC LIMIT 1000`;
  const { rows } = await db.query(sql, params);
  return rows;
}

async function getById(id) {
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM tasks WHERE id = $1`, [id]);
  return rows[0] || null;
}

// Whitelisted insert. Callers must pass already-validated fields.
async function create(fields) {
  const allowed = ['title', 'description', 'due_date', 'due_time', 'priority', 'tags', 'status', 'snooze_until'];
  const cols = Object.keys(fields).filter((k) => allowed.includes(k) && fields[k] !== undefined);
  const params = cols.map((c) => fields[c]);
  const placeholders = cols.map((_, i) => `$${i + 1}`);
  const { rows } = await db.query(
    `INSERT INTO tasks (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING ${COLUMNS}`,
    params
  );
  return rows[0];
}

async function update(id, fields) {
  const allowed = ['title', 'description', 'due_date', 'due_time', 'priority', 'tags', 'status', 'snooze_until'];
  const cols = Object.keys(fields).filter((k) => allowed.includes(k));
  if (!cols.length) return getById(id);
  const sets = cols.map((c, i) => `${c} = $${i + 2}`);
  const params = cols.map((c) => fields[c]);
  params.unshift(id);
  const { rows } = await db.query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = $1 RETURNING ${COLUMNS}`, params);
  return rows[0] || null;
}

async function remove(id) {
  const { rows } = await db.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
}

module.exports = { list, getById, create, update, remove };
