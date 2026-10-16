// Heuristic (offline) provider — no API key required.
// Parses natural-language task strings with regex rules and builds a
// deterministic digest from the task list.

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function parse(rawText) {
  let text = String(rawText || '').trim();
  const tags = [];
  let priority = null;
  let dueDate = null;
  let dueTime = null;
  let snoozeUntil = null;
  const now = new Date();

  // #tags
  text = text.replace(/#([a-zA-Z0-9-]+)/g, (_, t) => {
    tags.push(t.toLowerCase());
    return '';
  });

  // priority words
  if (/\b(!urgent|asap|urgent|high priority|important)\b/i.test(text)) priority = 'high';
  else if (/\b(low priority|whenever|someday|no rush)\b/i.test(text)) priority = 'low';
  else if (/\b(medium priority|normal)\b/i.test(text)) priority = 'medium';
  text = text.replace(/\b(!urgent|asap|urgent|high priority|low priority|medium priority|important|no rush|someday)\b/gi, '');

  // "tomorrow", "today", weekday names
  const lower = text.toLowerCase();
  if (/\btomorrow\b/.test(lower)) {
    dueDate = addDays(now, 1);
    text = text.replace(/\btomorrow\b/i, '');
  } else if (/\btoday\b|\btonight\b/.test(lower)) {
    dueDate = now;
    text = text.replace(/\btoday\b|\btonight\b/i, '');
  } else {
    for (let i = 0; i < 7; i++) {
      const re = new RegExp(`\\b(on |by |next )?${DAY_NAMES[i]}\\b`, 'i');
      if (re.test(text)) {
        let delta = (i - now.getDay() + 7) % 7 || 7;
        dueDate = addDays(now, delta);
        text = text.replace(re, '');
        break;
      }
    }
  }

  // "in N days/weeks/hours"
  let m = text.match(/\bin (\d+) (day|days|week|weeks|hour|hours)\b/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (/week/i.test(m[2])) dueDate = addDays(now, n * 7);
    else if (/day/i.test(m[2])) dueDate = addDays(now, n);
    else snoozeUntil = new Date(now.getTime() + n * 3600 * 1000);
    text = text.replace(m[0], '');
  }

  // explicit date YYYY-MM-DD
  m = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (m) {
    dueDate = new Date(m[1]);
    text = text.replace(m[1], '');
  }

  // times: "at 3pm", "at 15:30", "by 9am"
  m = text.match(/\b(?:at|by|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const mer = (m[3] || '').toLowerCase();
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    dueTime = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    text = text.replace(m[0], '');
  }

  // "snooze until ..." / "hide until ..." → future timestamp
  m = text.match(/\b(?:snooze|hide) until\s+(.+)$/i);
  if (m) {
    const d = new Date(m[1]);
    if (!Number.isNaN(d.getTime())) {
      snoozeUntil = d;
      text = text.replace(m[0], '');
    }
  }
  if (!dueDate && !snoozeUntil && /\bsnooze\b|\bnot until\b/.test(lower)) {
    m = text.match(/\b(?:for|until)\s+(\d+)\s*(hours?|h|days?|d)\b/i);
    if (m) {
      const n = parseInt(m[1], 10);
      const ms = /d/i.test(m[2]) ? n * 86400e3 : n * 3600e3;
      snoozeUntil = new Date(now.getTime() + ms);
      text = text.replace(m[0], '');
    }
  }

  // Split remaining into title / description (" – desc" or " - desc")
  let description = null;
  m = text.match(/\s+[–-]\s+(.{10,})$/);
  if (m) {
    description = m[1].trim();
    text = text.slice(0, m.index);
  }

  const title = text.replace(/\s{2,}/g, ' ').trim();

  return {
    title,
    description,
    due_date: dueDate ? fmtDate(dueDate) : null,
    due_time: dueTime,
    priority,
    tags: [...new Set(tags)],
    snooze_until: snoozeUntil ? snoozeUntil.toISOString() : null,
  };
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function digest(tasks) {
  const now = new Date();
  const today = fmtDate(now);
  const open = tasks.filter((t) => t.status !== 'done');

  const overdue = open.filter(
    (t) => t.due_date && (t.due_date < today || (t.due_date === today && t.due_time && t.due_time < timeStr(now)))
  );
  const dueToday = open.filter(
    (t) => t.due_date === today && !overdue.includes(t)
  );

  // Suggested top three: overdue first, then high > medium > low, then soonest due.
  const rank = { high: 0, medium: 1, low: 2, null: 3 };
  const suggested = [...open]
    .sort((a, b) => {
      const aOver = overdue.includes(a) ? 0 : 1;
      const bOver = overdue.includes(b) ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      const pr = (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3);
      if (pr !== 0) return pr;
      return (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1;
    })
    .slice(0, 3);

  const line = (t) => `  • ${t.title}${t.due_date ? ` (due ${t.due_date}${t.due_time ? ' ' + t.due_time : ''})` : ''}${t.priority ? ` [${t.priority}]` : ''}`;

  const parts = [`Daily digest — ${today}`, ''];
  parts.push(`Overdue (${overdue.length}):`);
  parts.push(overdue.length ? overdue.map(line).join('\n') : '  Nothing overdue. Nice.');
  parts.push('', `Due today (${dueToday.length}):`);
  parts.push(dueToday.length ? dueToday.map(line).join('\n') : '  Nothing due today.');
  parts.push('', 'Suggested top 3 to tackle:', '');
  parts.push(suggested.length ? suggested.map(line).join('\n') : '  No open tasks — enjoy your day!');
  return parts.join('\n');
}

function timeStr(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

module.exports = { parse, digest };
