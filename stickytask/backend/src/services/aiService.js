// aiService.js — THE single swap point for the AI provider.
// To change models/providers, edit PROVIDERS below or set AI_PROVIDER env var.
// If no API key is configured, a deterministic heuristic fallback is used so
// the app still works offline.

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['todo', 'in progress', 'done'];

// ---------------------------------------------------------------------------
// Provider registry — swapping models later is one line here.
// ---------------------------------------------------------------------------
const PROVIDERS = {
  openai: require('./providers/openai'),
  anthropic: require('./providers/anthropic'),
  heuristic: require('./providers/heuristic'),
};

function activeProvider() {
  const name = (process.env.AI_PROVIDER || 'openai').toLowerCase();
  const key =
    name === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  if (PROVIDERS[name] && key) return PROVIDERS[name];
  // No key configured → graceful local fallback.
  return PROVIDERS.heuristic;
}

// ---------------------------------------------------------------------------
// Public API used by routes
// ---------------------------------------------------------------------------

// POST /tasks/parse — extract structured fields from raw natural language.
async function parseTask(rawText) {
  const provider = activeProvider();
  const result = await provider.parse(rawText);
  return normalizeParsed(result, rawText);
}

// POST /tasks/digest — plain-text daily summary.
async function generateDigest(tasks) {
  const provider = activeProvider();
  return provider.digest(tasks);
}

// ---------------------------------------------------------------------------
// Shared helpers (used by providers + routes)
// ---------------------------------------------------------------------------

function normalizeParsed(p, rawText) {
  const out = {
    title: (p.title || rawText || '').trim().slice(0, 200) || 'Untitled task',
    description: p.description ? String(p.description).trim() : null,
    dueDate: validDate(p.due_date || p.dueDate) ? isoDate(p.due_date || p.dueDate) : null,
    dueTime: validTime(p.due_time || p.dueTime) ? normTime(p.due_time || p.dueTime) : null,
    priority: PRIORITIES.includes(lower(p.priority)) ? lower(p.priority) : null,
    tags: Array.isArray(p.tags)
      ? p.tags.map((t) => String(t).toLowerCase().replace(/[^a-z0-9-]/g, '')).filter(Boolean).slice(0, 10)
      : [],
    snoozeUntil: validTimestamp(p.snooze_until || p.snoozeUntil)
      ? new Date(p.snooze_until || p.snoozeUntil).toISOString()
      : null,
  };
  return out;
}

function lower(v) {
  return typeof v === 'string' ? v.toLowerCase().trim() : v;
}

function validDate(v) {
  if (!v) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

function isoDate(v) {
  const d = new Date(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function validTime(v) {
  if (!v) return false;
  return /^([01]?\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/.test(String(v)) || !Number.isNaN(new Date(`2000-01-01T${v}`).getTime());
}

function normTime(v) {
  const s = String(v);
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${String(m[1]).padStart(2, '0')}:${m[2]}`;
}

function validTimestamp(v) {
  if (!v) return false;
  return !Number.isNaN(new Date(v).getTime());
}

module.exports = {
  parseTask,
  generateDigest,
  normalizeParsed,
  PRIORITIES,
  STATUSES,
};
