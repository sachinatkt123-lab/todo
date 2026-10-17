// assistantService.js — the conversational AI productivity assistant.
//
// Architecture (mirrors aiService.js so providers stay swappable):
//   1. The LLM provider returns a STRUCTURED intent proposal (JSON only).
//      It never touches the database — it can only *propose*.
//   2. This service validates every proposal against strict schemas and
//      resolves references ("my java assignment") to real task UUIDs by
//      fuzzy-matching titles from the caller's own task list.
//   3. Execution goes through the SAME validated code paths as the REST API
//      (tasksRepo + aiService.normalizeParsed), so AI output can never bypass
//      backend validation.
//   4. Bulk changes (multi-task creation, deletions) require an explicit
//      `confirm: true` from the user; otherwise they are returned as previews.
//
// When no API key is configured, a deterministic offline heuristic keeps the
// assistant fully functional (parse-based creation, goal decomposition,
// prioritization, day planning, summaries, and date moves).

const { parseTask, normalizeParsed, PRIORITIES } = require('./aiService');
const tasksRepo = require('../repositories/tasksRepo');

const INTENTS = [
  'create_task',
  'break_down_goal',
  'prioritize',
  'plan_day',
  'summarize',
  'update_task',
  'complete_task',
  'chat',
];

// ---------------------------------------------------------------------------
// Provider registry — same swap point style as aiService.js
// ---------------------------------------------------------------------------
const PROVIDERS = {
  openai: require('./providers/openaiAssistant'),
  anthropic: require('./providers/anthropicAssistant'),
};

function activeProvider() {
  const name = (process.env.AI_PROVIDER || 'openai').toLowerCase();
  const key = name === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  if (PROVIDERS[name] && key) return PROVIDERS[name];
  return null; // no key configured → use the built-in heuristic below
}

function providerName() {
  const p = activeProvider();
  return p ? (process.env.AI_PROVIDER || 'openai').toLowerCase() : 'heuristic';
}

// True when a real LLM provider is configured (used by the route to tell the
// frontend whether AI mode is live or running on offline heuristics).
function isConfigured() {
  return activeProvider() !== null;
}

// ---------------------------------------------------------------------------
// Validation helpers — AI output is treated as untrusted input
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDateStr(v) {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function sanitizeTitle(t) {
  const s = String(t == null ? '' : t).trim().replace(/\s+/g, ' ');
  return s.slice(0, 200);
}

function sanitizeTags(tags) {
  return Array.isArray(tags)
    ? [...new Set(tags.map((t) => String(t).toLowerCase().replace(/[^a-z0-9-]/g, '')).filter(Boolean))].slice(0, 10)
    : [];
}

function validateProposedTask(p) {
  const title = sanitizeTitle(p && p.title);
  if (!title) return null;
  const priority = p.priority && PRIORITIES.includes(String(p.priority).toLowerCase())
    ? String(p.priority).toLowerCase()
    : null;
  const dueDate = validDateStr(p.due_date) ? p.due_date : null;
  return {
    title,
    description: p.description ? String(p.description).trim().slice(0, 2000) : null,
    due_date: dueDate,
    priority,
    tags: sanitizeTags(p.tags),
  };
}

function validateProposal(proposal, tasks) {
  if (!proposal || typeof proposal !== 'object') return { intent: 'chat', reply: 'Sorry, I could not understand that. Try asking me to add or plan tasks.' };
  const intent = INTENTS.includes(proposal.intent) ? proposal.intent : 'chat';
  const out = { ...proposal, intent };
  out.reply = typeof proposal.reply === 'string' ? proposal.reply.trim().slice(0, 4000) : '';

  if (Array.isArray(out.tasks)) out.tasks = out.tasks.map(validateProposedTask).filter(Boolean).slice(0, 15);
  else out.tasks = [];

  if (Array.isArray(out.updates)) {
    out.updates = out.updates
      .map((u) => {
        const task = findTask(tasks, u && (u.task_id || u.taskId || u.ref));
        if (!task) return null;
        const upd = { taskId: task.id, currentTitle: task.title };
        if (validDateStr(u.due_date)) upd.due_date = u.due_date;
        if (u.priority && PRIORITIES.includes(String(u.priority).toLowerCase())) upd.priority = String(u.priority).toLowerCase();
        if (u.status && ['todo', 'in progress', 'done'].includes(u.status)) upd.status = u.status;
        if (u.clear_due_date) upd.clear_due_date = true;
        if (upd.due_date === undefined && !upd.priority && !upd.status && !upd.clear_due_date) return null;
        return upd;
      })
      .filter(Boolean);
  } else out.updates = [];

  if (Array.isArray(out.completeIds)) {
    out.completeIds = out.completeIds.map((r) => findTask(tasks, r)).filter(Boolean).map((t) => t.id);
  } else out.completeIds = [];

  if (Array.isArray(out.deleteIds)) {
    out.deleteIds = out.deleteIds.map((r) => findTask(tasks, r)).filter(Boolean).map((t) => t.id);
  } else out.deleteIds = [];

  return out;
}

// Resolve a task reference (UUID or fuzzy text) strictly within the user's own
// visible task list. Returns null when ambiguous/not found — callers then ask
// a follow-up question instead of guessing.
function findTask(tasks, ref) {
  if (ref == null) return null;
  const s = String(ref).trim().toLowerCase();
  if (!s) return null;
  const uuid = tasks.find((t) => t.id.toLowerCase() === s);
  if (uuid) return uuid;
  const exact = tasks.filter((t) => t.title.toLowerCase() === s);
  if (exact.length === 1) return exact[0];
  const words = s.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  if (!words.length) return null;
  const scored = tasks
    .map((t) => {
      const title = t.title.toLowerCase();
      const score = words.reduce((acc, w) => acc + (title.includes(w) ? 1 : 0), 0);
      return { t, score };
    })
    .filter((x) => x.score >= Math.min(2, words.length) || (words.length === 1 && x.score === 1));
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  if (scored.length > 1 && scored[0].score === scored[1].score) return null; // ambiguous
  return scored[0].t;
}

function contextTasks() {
  return tasksRepo.list({ showSnoozed: false });
}

// ---------------------------------------------------------------------------
// Offline heuristic fallback (used when no API key is configured)
// ---------------------------------------------------------------------------

async function heuristicAssistant(message, tasks) {
  const m = String(message || '').trim();
  const low = m.toLowerCase();

  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(low)) {
    return { intent: 'chat', reply: `Hi! I can add tasks, break goals into steps, prioritize your list, plan your day, summarize what's pending, or move tasks to another date. What would you like to do?` };
  }

  // Break a goal into tasks
  if (/\b(break|split|divide)\b.*\b(into|down)\b|\bmanageable tasks\b|\bsub-?tasks?\b/.test(low)) {
    const goal = m.replace(/^\s*(please\s+)?(break|split|divide)\s+(this|my\s+goal:?|launching)?\s*/i, '');
    const cleaned = goal.replace(/\b(into|down)\s+(manageable\s+)?(smaller\s+)?(tasks|steps|subtasks)\b.*$/i, '').replace(/^.*\bfor\b\s+/i, '').trim() || goal.trim() || 'your goal';
    const subject = /website/i.test(cleaned)
      ? 'website'
      : cleaned.toLowerCase().replace(/^(launch(ing)?|create|build|plan|organize)\s+/i, '').trim() || 'the project';
    const steps = /move/i.test(cleaned)
      ? ['Sort and pack boxes by room', 'Book the moving truck and elevator access', 'Change address with bank, utilities, and subscriptions', 'Create a labeling system and essentials box', 'Update household calendar for move-in day']
      : [`Define the goal and success metrics for ${subject}`, `Research options and gather requirements for ${subject}`, `Draft a plan with milestones and owners for ${subject}`, `Review and get feedback on the ${subject} plan`, `Execute step one of the ${subject} plan`];
    return {
      intent: 'break_down_goal',
      reply: `Here is a starter plan for “${cleaned}”. Confirm and I'll add these ${steps.length} tasks to your list.`,
      tasks: steps.map((title, i) => ({ title, priority: i === 0 ? 'high' : 'medium', due_date: null, tags: [], description: null })),
    };
  }

  // Prioritization / "what next"
  if (/\b(prioriti[sz]|which.*(first|task)|what should i do|do first|rank)\b/.test(low)) {
    const open = tasks.filter((t) => t.status !== 'done');
    if (!open.length) return { intent: 'prioritize', reply: 'You have no pending tasks — enjoy the clear runway! 🎉' };
    const ranked = rankTasks(open);
    const lines = ranked.slice(0, 5).map((t, i) => `${i + 1}. ${t.title}${t.due_date ? ` (due ${t.due_date})` : ''}${t.priority ? ` [${t.priority}]` : ''}`);
    return { intent: 'prioritize', reply: `I'd tackle them in this order:\n${lines.join('\n')}\n\n#1 matters most because ${whyFirst(ranked[0])}.` };
  }

  // Daily plan
  if (/\b(plan|organize)\b.*\b(day|today|schedule)\b|\bdaily plan\b|\bwhat('s| is) (on my|my) plate\b/.test(low)) {
    const today = isoToday();
    const open = tasks.filter((t) => t.status !== 'done');
    const overdue = open.filter((t) => t.due_date && t.due_date < today);
    const dueToday = open.filter((t) => t.due_date === today);
    const soon = rankTasks(open.filter((t) => t.due_date && t.due_date > today)).slice(0, 3);
    if (!overdue.length && !dueToday.length && !soon.length && !open.length) {
      return { intent: 'plan_day', reply: 'Nothing pending right now. Want me to add something?' };
    }
    const parts = [`Your plan for ${today}:`];
    if (overdue.length) parts.push(`• First, clear overdue items: ${overdue.map((t) => t.title).join('; ')}.`);
    if (dueToday.length) parts.push(`• Due today: ${dueToday.map((t) => t.title).join('; ')}.`);
    if (soon.length) parts.push(`• Then prep upcoming: ${soon.map((t) => t.title).join('; ')}.`);
    if (!overdue.length && !dueToday.length && soon.length) parts.push('• Nothing is overdue or due today — good time to get ahead.');
    return { intent: 'plan_day', reply: parts.join('\n') };
  }

  // Summary
  if (/\b(summari[sz]|how many|status of|recap|catch me up)\b/.test(low)) {
    const open = tasks.filter((t) => t.status !== 'done');
    const done = tasks.filter((t) => t.status === 'done');
    const overdue = open.filter((t) => t.due_date && t.due_date < isoToday());
    const high = open.filter((t) => t.priority === 'high');
    const parts = [`You have ${open.length} pending task${open.length === 1 ? '' : 's'} and ${done.length} completed.`];
    if (overdue.length) parts.push(`Overdue (${overdue.length}): ${overdue.map((t) => `“${t.title}”`).join(', ')}.`);
    if (high.length) parts.push(`High priority: ${high.map((t) => `“${t.title}”`).join(', ')}.`);
    if (!overdue.length && !high.length && open.length) parts.push('Nothing overdue — nice work staying on top of things.');
    return { intent: 'summarize', reply: parts.join('\n') };
  }

  // Complete a task by name
  if (/\b(done|finished|complete[d]?|mark .* done|check off|tick off)\b/.test(low) && !/\b(add|create|remind|new task)\b/.test(low)) {
    const guess = m.replace(/\bi('m| am)?\b/g, ' ').replace(/\b(done|finished|completed?|marked|checked off|ticked off|all done with)\b/gi, ' ').replace(/\b(i|just|have|already|got)\b/gi, ' ').trim();
    const task = findTask(tasks, guess);
    if (task && task.status !== 'done') {
      return { intent: 'complete_task', reply: `Found “${task.title}” — confirm and I'll mark it complete.`, updates: [{ taskId: task.id, currentTitle: task.title, status: 'done' }] };
    }
    if (guess) return { intent: 'chat', reply: `I couldn't find a pending task matching “${guess}”. Which task did you mean?` };
  }

  // Move/reschedule an existing task
  if (/\b(move|reschedule|push|postpone|change)\b/.test(low) && /\b(to|until|till|on|by)\b/.test(low)) {
    const parsed = normalizeParsed(await parseRaw(m), m);
    const target = findTask(tasks, m.replace(/\b(move|reschedule|push|postpone|change)\b/gi, ' '));
    if (!target) return { intent: 'chat', reply: 'Which task would you like to move? Try naming it, e.g. “Move my Java assignment to Friday.”' };
    if (!parsed.dueDate) return { intent: 'chat', reply: `I found “${target.title}”, but I couldn't tell which date you meant. Which day should it move to?` };
    return {
      intent: 'update_task',
      reply: `Moving “${target.title}” to ${parsed.dueDate}${parsed.dueTime ? ` at ${parsed.dueTime}` : ''}. Confirm to apply.`,
      updates: [{ taskId: target.id, currentTitle: target.title, due_date: parsed.dueDate }],
    };
  }

  // Create a task (also handles "remind me to …")
  if (/\b(add|create|remind me|schedule|put in|set a task|new task|need to|i have to)\b/.test(low) || m.length > 3) {
    const parsed = normalizeParsed(await parseRaw(m), m);
    const title = (parsed.title || m).replace(/^\s*(please\s+)?(add|create|remind me to|schedule|put in|set a task(:| to)?|new task( to)?)\s+/i, '').trim();
    const finalTitle = title || parsed.title || m;
    if (!finalTitle) return { intent: 'chat', reply: 'What should the task be called?' };
    return {
      intent: 'create_task',
      reply: `Got it — I'll add “${finalTitle}”${parsed.dueDate ? ` due ${parsed.dueDate}` : ''}${parsed.dueTime ? ` at ${parsed.dueTime}` : ''}${parsed.priority ? ` (${parsed.priority} priority)` : ''}. Confirm to save.`,
      tasks: [{ title: finalTitle, description: parsed.description, due_date: parsed.dueDate, priority: parsed.priority, tags: parsed.tags }],
    };
  }

  return { intent: 'chat', reply: 'I can add tasks, break goals into steps, prioritize, plan your day, summarize, or reschedule tasks. Try “Remind me to finish my report tomorrow” or “Plan my day.”' };
}

async function parseRaw(text) {
  // Reuse the existing NL parser (provider-aware with offline fallback).
  return parseTask(text);
}

function rankTasks(tasks) {
  const today = isoToday();
  const prio = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    const oa = a.due_date && a.due_date < today ? 0 : 1;
    const ob = b.due_date && b.due_date < today ? 0 : 1;
    if (oa !== ob) return oa - ob;
    const da = a.due_date || '9999-12-31';
    const db = b.due_date || '9999-12-31';
    if (da !== db) return da < db ? -1 : 1;
    return (prio[a.priority] ?? 3) - (prio[b.priority] ?? 3);
  });
}

function whyFirst(t) {
  const today = isoToday();
  if (t.due_date && t.due_date < today) return 'it is overdue';
  if (t.due_date === today) return 'it is due today';
  if (t.priority === 'high') return 'it is marked high priority';
  if (t.due_date) return `it is due soonest (${t.due_date})`;
  return 'it is the oldest pending item';
}

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function chat({ message, confirm = false }) {
  const text = String(message || '').trim();
  if (!text) throw Object.assign(new Error('message is required'), { status: 400 });

  const tasks = await contextTasks();
  const provider = activeProvider();
  let proposal;
  if (provider) {
    try {
      proposal = await provider.assist(text, tasks, { confirm });
    } catch (err) {
      // Provider failure (rate limit, outage, bad key) → degrade gracefully
      // to the offline heuristic rather than returning a hard error.
      console.error('[assistant] provider failed, falling back to heuristic:', err.message);
      proposal = await heuristicAssistant(text, tasks);
    }
  } else {
    proposal = await heuristicAssistant(text, tasks);
  }

  const result = await execute(validateProposal(proposal, tasks), tasks, !!confirm);
  return { ...result, provider: providerName() };
}

// Executes validated actions through the repository (never raw AI SQL).
// Multi-create / delete require confirm=true; otherwise a preview is returned.
async function execute(p, tasks, confirm) {
  const base = { intent: p.intent, reply: p.reply };

  switch (p.intent) {
    case 'create_task':
    case 'break_down_goal': {
      if (!p.tasks.length) return { ...base, reply: p.reply || 'No tasks were proposed. Could you rephrase?' };
      if (p.tasks.length > 1 && !confirm) {
        return { ...base, requiresConfirmation: true, proposals: { tasks: p.tasks }, reply: `${p.reply || 'Ready to add these tasks:'}\n${p.tasks.map((t) => `• ${t.title}`).join('\n')}` };
      }
      const created = [];
      for (const t of p.tasks) {
        const row = await tasksRepo.create({ title: t.title, description: t.description || null, due_date: t.due_date || null, priority: t.priority || null, tags: t.tags || [] });
        created.push(row);
      }
      return { ...base, applied: { created: created.map(publicTask) }, reply: `Done — added ${created.length} task${created.length === 1 ? '' : 's'}: ${created.map((c) => `“${c.title}”`).join(', ')}.` };
    }

    case 'update_task':
    case 'complete_task': {
      if (!p.updates.length) return { ...base, reply: p.reply || 'I could not identify which task to change. Can you name it?' };
      if (!confirm) {
        return { ...base, requiresConfirmation: true, proposals: { updates: p.updates }, reply: `${p.reply || 'Confirm these changes:'}\n${p.updates.map(describeUpdate).join('\n')}` };
      }
      const changed = [];
      for (const u of p.updates) {
        const patch = {};
        if (u.due_date) patch.due_date = u.due_date;
        if (u.clear_due_date) patch.due_date = null;
        if (u.priority) patch.priority = u.priority;
        if (u.status) patch.status = u.status;
        const row = await tasksRepo.update(u.taskId, patch); // repo returns null if missing
        if (row) changed.push(publicTask(row));
      }
      if (!changed.length) return { ...base, reply: 'Those tasks no longer exist — nothing was changed.' };
      return { ...base, applied: { updated: changed }, reply: `Applied: ${changed.map((c) => `“${c.title}”`).join(', ')}.` };
    }

    case 'delete_task': {
      if (!p.deleteIds.length) return { ...base, reply: 'Which task should I delete? Please name it.' };
      if (!confirm) {
        const doomed = p.deleteIds.map((id) => tasks.find((t) => t.id === id)).filter(Boolean);
        return { ...base, requiresConfirmation: true, proposals: { deletes: doomed.map(publicTask) }, reply: `⚠️ About to delete ${doomed.length} task(s):\n${doomed.map((t) => `• ${t.title}`).join('\n')}\nConfirm to proceed.` };
      }
      const deleted = [];
      for (const id of p.deleteIds) {
        const ok = await tasksRepo.remove(id);
        if (ok) deleted.push(id);
      }
      return { ...base, applied: { deletedIds: deleted }, reply: `Deleted ${deleted.length} task(s).` };
    }

    default:
      return { ...base, reply: p.reply || 'How can I help with your tasks?' };
  }
}

function describeUpdate(u) {
  const bits = [];
  if (u.due_date) bits.push(`due ${u.due_date}`);
  if (u.clear_due_date) bits.push('no due date');
  if (u.priority) bits.push(`${u.priority} priority`);
  if (u.status) bits.push(`status → ${u.status}`);
  return `• “${u.currentTitle}”: ${bits.join(', ')}`;
}

function publicTask(t) {
  return { id: t.id, title: t.title, description: t.description, due_date: t.due_date, due_time: t.due_time, priority: t.priority, tags: t.tags, status: t.status };
}

module.exports = { chat, validateProposal, findTask, providerName, isConfigured, INTENTS };
