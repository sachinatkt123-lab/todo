import React, { useEffect, useState } from 'react';

// Create / edit form in a modal. `initial` holds structured fields (possibly
// pre-filled from the parse endpoint). onSave(payload) is called on submit;
// payload uses snake_case keys matching the API.
export default function TaskFormModal({ open, initial, onClose, onSave, saving }) {
  const [form, setForm] = useState(blank());

  useEffect(() => {
    if (open) setForm({ ...blank(), ...toForm(initial) });
  }, [open, initial]);

  if (!open) return null;

  function blank() {
    return {
      id: null,
      title: '',
      description: '',
      due_date: '',
      due_time: '',
      priority: '',
      tags: [],
      status: 'todo',
      snooze_until: '',
    };
  }

  // Normalize whatever we receive (parse output or a task row from the DB)
  // into form-friendly values. pg returns due_date as a Date object and
  // due_time as "HH:MM:SS"; parse output may use camelCase keys.
  function toForm(src) {
    const s = src || {};
    const date = s.due_date ?? s.dueDate;
    const time = s.due_time ?? s.dueTime;
    const snooze = s.snooze_until ?? s.snoozeUntil;
    return {
      ...s,
      due_date: date ? String(date).slice(0, 10) : '',
      due_time: time ? String(time).slice(0, 5) : '',
      snooze_until: snooze ? new Date(snooze).toISOString().slice(0, 16) : '',
      description: s.description || '',
      tags: Array.isArray(s.tags) ? s.tags : [],
    };
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      description: form.description?.trim() || null,
      due_date: form.due_date || null,
      due_time: form.due_time || null,
      priority: form.priority || null,
      tags: Array.isArray(form.tags) ? form.tags : String(form.tags).split(/[,\s]+/).filter(Boolean),
      status: form.status || 'todo',
      snooze_until: form.snooze_until || null,
    };
    onSave(payload, form.id);
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold text-slate-800">
          {form.id ? 'Edit task' : 'New task'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Title *</label>
            <input className={inputCls} value={form.title} onChange={set('title')} autoFocus required />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Description</label>
            <textarea className={`${inputCls} resize-none`} rows={2} value={form.description || ''} onChange={set('description')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Due date</label>
              <input type="date" className={inputCls} value={form.due_date || ''} onChange={set('due_date')} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Due time</label>
              <input type="time" className={inputCls} value={form.due_time || ''} onChange={set('due_time')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Priority</label>
              <select className={inputCls} value={form.priority || ''} onChange={set('priority')}>
                <option value="">—</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Status</label>
              <select className={inputCls} value={form.status || 'todo'} onChange={set('status')}>
                <option value="todo">todo</option>
                <option value="in progress">in progress</option>
                <option value="done">done</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Tags (comma separated)</label>
            <input
              className={inputCls}
              value={(Array.isArray(form.tags) ? form.tags : []).join(', ')}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  tags: e.target.value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
                }))
              }
              placeholder="work, errands"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Snooze until</label>
            <input
              type="datetime-local"
              className={inputCls}
              value={form.snooze_until ? form.snooze_until.slice(0, 16) : ''}
              onChange={set('snooze_until')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-40"
            >
              {saving ? 'Saving…' : form.id ? 'Save changes' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
