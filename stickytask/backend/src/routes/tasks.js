const express = require('express');
const db = require('../db');
const { parseTask, generateDigest, PRIORITIES, STATUSES } = require('../services/aiService');

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fields that can be created/updated (snake_case column names).
const UPDATABLE = [
  'title',
  'description',
  'due_date',
  'due_time',
  'priority',
  'tags',
  'status',
  'snooze_until',
];

function toRow(body) {
  // Accept camelCase from JSON clients too.
  const map = {
    dueDate: 'due_date',
    dueTime: 'due_time',
    snoozeUntil: 'snooze_until',
  };
  const out = {};
  for (const key of Object.keys(body || {})) {
    const col = map[key] || key;
    if (UPDATABLE.includes(col) && body[key] !== undefined) out[col] = body[key];
  }
  return out;
}

function validate(fields, { partial = false } = {}) {
  const errors = [];
  if (!partial || fields.title !== undefined) {
    if (typeof fields.title !== 'string' || !fields.title.trim()) errors.push('title is required');
  }
  if (fields.priority !== undefined && fields.priority !== null && !PRIORITIES.includes(fields.priority)) {
    errors.push(`priority must be one of ${PRIORITIES.join(', ')}`);
  }
  if (fields.status !== undefined && fields.status !== null && !STATUSES.includes(fields.status)) {
    errors.push(`status must be one of ${STATUSES.join(', ')}`);
  }
  if (fields.tags !== undefined && fields.tags !== null && !Array.isArray(fields.tags)) {
    errors.push('tags must be an array of strings');
  }
  return errors;
}

async function fetchTasks({ status, priority, tag, showSnoozed }) {
  const where = [];
  const params = [];

  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (priority) {
    params.push(priority);
    where.push(`priority = $${params.length}`);
  }
  if (tag) {
    params.push(tag.toLowerCase());
    where.push(`$${params.length} = ANY(tags)`);
  }
  if (!showSnoozed) {
    // Exclude tasks whose snooze_until is in the future.
    where.push(`(snooze_until IS NULL OR snooze_until <= NOW())`);
  }

  const sql = `SELECT * FROM tasks ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at ASC`;
  const { rows } = await db.query(sql, params);
  return rows;
}

// ---------------------------------------------------------------------------
// POST /tasks — create a task
// ---------------------------------------------------------------------------
router.post('/', async (req, res, next) => {
  try {
    const fields = toRow(req.body);
    const errors = validate(fields);
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });

    const cols = Object.keys(fields);
    const params = cols.map((c) => fields[c]);
    const placeholders = cols.map((_, i) => `$${i + 1}`);

    const { rows } = await db.query(
      `INSERT INTO tasks (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      params
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /tasks?status=&priority=&tag=&showSnoozed=false
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const showSnoozed = ['1', 'true', 'yes'].includes(String(req.query.showSnoozed || '').toLowerCase());
    const tasks = await fetchTasks({
      status: req.query.status,
      priority: req.query.priority,
      tag: req.query.tag,
      showSnoozed,
    });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /tasks/:id
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'invalid id' });
    const { rows } = await db.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'task not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /tasks/:id — update any fields
// ---------------------------------------------------------------------------
router.put('/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'invalid id' });
    const fields = toRow(req.body);
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'no updatable fields provided' });
    const errors = validate(fields, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });

    const sets = Object.keys(fields).map((c, i) => `${c} = $${i + 2}`);
    const params = Object.values(fields);
    params.unshift(req.params.id);

    const { rows } = await db.query(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'task not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /tasks/:id
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'invalid id' });
    const { rows } = await db.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'task not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /tasks/:id/status — move between columns
// body: { "status": "todo" | "in progress" | "done" }
// ---------------------------------------------------------------------------
router.patch('/:id/status', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'invalid id' });
    const { status } = req.body || {};
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
    }
    const { rows } = await db.query(
      'UPDATE tasks SET status = $2 WHERE id = $1 RETURNING *',
      [req.params.id, status]
    );
    if (!rows.length) return res.status(404).json({ error: 'task not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /tasks/parse — natural language → structured fields
// body: { "text": "Call mom tomorrow at 5pm #family high priority" }
// ---------------------------------------------------------------------------
router.post('/parse', async (req, res, next) => {
  try {
    const text = (req.body && (req.body.text ?? req.body.raw)) || '';
    if (!String(text).trim()) return res.status(400).json({ error: 'text is required' });
    const parsed = await parseTask(String(text));
    res.json(parsed);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /tasks/digest — AI-generated plain-text daily summary
// ---------------------------------------------------------------------------
router.post('/digest', async (req, res, next) => {
  try {
    // Feed the model only visible (non-snoozed), non-done context to keep it focused.
    const tasks = await fetchTasks({ showSnoozed: false });
    const summary = await generateDigest(
      tasks.map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        // pg returns DATE as a full JS Date; normalize to YYYY-MM-DD / HH:MM:SS
        // strings so both AI providers and the heuristic digest compare cleanly.
        due_date: t.due_date ? `${String(t.due_date.getFullYear())}-${String(t.due_date.getMonth() + 1).padStart(2, '0')}-${String(t.due_date.getDate()).padStart(2, '0')}` : null,
        due_time: typeof t.due_time === 'string' ? t.due_time.slice(0, 5) : (t.due_time ? String(t.due_time) : null),
        tags: t.tags,
      }))
    );
    res.type('text/plain').send(summary);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
