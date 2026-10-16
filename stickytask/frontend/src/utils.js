// Shared helpers for the sticky-note look & snooze behavior.

export const STATUSES = ['todo', 'in progress', 'done'];

export const COLUMN_TITLES = {
  todo: 'To do',
  'in progress': 'In progress',
  done: 'Done',
};

const NOTE_COLORS = [
  'bg-yellow-200',
  'bg-pink-200',
  'bg-sky-200',
  'bg-green-200',
  'bg-orange-200',
  'bg-purple-200',
];

// Deterministic per-task rotation (-2..+2 degrees) and color, so cards don't
// jitter on re-render.
export function noteStyle(taskId) {
  let hash = 0;
  const s = String(taskId);
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  const rotation = ((hash % 41) - 20) / 10; // -2.0 .. 2.0
  const color = NOTE_COLORS[hash % NOTE_COLORS.length];
  return { rotation, color };
}

export function isSnoozed(task, now = Date.now()) {
  return !!task.snooze_until && new Date(task.snooze_until).getTime() > now;
}

// A task "just reappeared" if its snooze ended within the last few seconds —
// used to trigger the bounce animation once when it becomes visible again.
export function justReappeared(task, now = Date.now()) {
  if (!task.snooze_until) return false;
  const until = new Date(task.snooze_until).getTime();
  return until <= now && now - until < 5000;
}

export const PRIORITY_BADGE = {
  high: 'bg-red-100 text-red-700 border border-red-300',
  medium: 'bg-amber-100 text-amber-700 border border-amber-300',
  low: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
};

export function formatDue(task) {
  if (!task.due_date) return null;
  const d = new Date(`${task.due_date}T${task.due_time || '00:00'}`);
  const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (!task.due_time) return dateStr;
  return `${dateStr} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

export function isOverdue(task, now = new Date()) {
  if (!task.due_date || task.status === 'done') return false;
  const due = new Date(`${task.due_date}T${task.due_time || '23:59'}`);
  return due < now;
}
