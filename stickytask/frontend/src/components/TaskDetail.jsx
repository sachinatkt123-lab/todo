import React, { useEffect, useState } from 'react';

// Right-side detail panel (bottom sheet on mobile) for viewing/editing one
// task. Delete requires an explicit in-panel confirmation step.
const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';
const labelCls = 'mb-1 block text-xs font-semibold text-slate-500';

export default function TaskDetail({ task, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title || '',
        description: task.description || '',
        due_date: task.due_date ? String(task.due_date).slice(0, 10) : '',
        due_time: task.due_time ? String(task.due_time).slice(0, 5) : '',
        priority: task.priority || '',
        tags: (task.tags || []).join(', '),
        status: task.status || 'todo',
      });
      setConfirmDelete(false);
    }
  }, [task]);

  if (!task || !form) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onSave(task.id, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_date: form.due_date || null,
        due_time: form.due_time || null,
        priority: form.priority || null,
        status: form.status,
        tags: form.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={onClose} role="dialog" aria-modal="true" aria-label="Task details">
      <div
        className="flex h-full w-full flex-col overflow-y-auto bg-white p-5 shadow-2xl sm:w-[400px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Task details</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close details">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>Title</label>
            <input className={inputCls} value={form.title} onChange={set('title')} autoFocus />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={`${inputCls} resize-none`} rows={3} value={form.description} onChange={set('description')} placeholder="Add more details…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Due date</label>
              <input type="date" className={inputCls} value={form.due_date} onChange={set('due_date')} />
            </div>
            <div>
              <label className={labelCls}>Due time</label>
              <input type="time" className={inputCls} value={form.due_time} onChange={set('due_time')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Priority</label>
              <select className={inputCls} value={form.priority} onChange={set('priority')}>
                <option value="">None</option>
                <option value="low">Low</option>
                <option value="medium">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={set('status')}>
                <option value="todo">To do</option>
                <option value="in progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Labels (comma separated)</label>
            <input className={inputCls} value={form.tags} onChange={set('tags')} placeholder="work, errands" />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600">Delete this task?</span>
              <button onClick={() => onDelete(task.id)} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">Yes, delete</button>
              <button onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100">Keep it</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50">Delete task</button>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancel</button>
            <button onClick={save} disabled={saving || !form.title.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
