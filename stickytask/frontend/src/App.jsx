import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api/client';
import Sidebar from './components/Sidebar';
import TaskItem from './components/TaskItem';
import TaskDetail from './components/TaskDetail';
import TaskFormModal from './components/TaskFormModal';
import AiPanel from './components/AiPanel';
import { isSnoozed, isoToday } from './utils';

// Simple to-do app: sidebar views + task list + quick add + AI assistant.
const VIEW_META = {
  inbox: { title: 'Inbox', empty: 'Your inbox is empty. Add your first task above.' },
  today: { title: 'Today', empty: 'Nothing due today — enjoy the breathing room!' },
  upcoming: { title: 'Upcoming', empty: 'No future tasks scheduled yet.' },
  completed: { title: 'Completed', empty: 'Completed tasks will appear here.' },
};

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [view, setView] = useState('inbox'); // inbox | today | upcoming | completed
  const [label, setLabel] = useState(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sort, setSort] = useState('created'); // created | due | priority

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const [detailTask, setDetailTask] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState(null);
  const [toast, setToast] = useState(null);

  // ---- data ---------------------------------------------------------------
  const refresh = useCallback(async () => {
    try {
      const rows = await api.listTasks();
      setTasks(rows);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  function notify(text) {
    setToast(text);
    setTimeout(() => setToast(null), 2600);
  }

  // ---- derived lists ------------------------------------------------------
  const visible = useMemo(() => tasks.filter((t) => !isSnoozed(t)), [tasks]);
  const open = useMemo(() => visible.filter((t) => t.status !== 'done'), [visible]);
  const today = isoToday();

  const counts = useMemo(() => ({
    inbox: open.length,
    today: open.filter((t) => t.due_date === today).length,
    upcoming: open.filter((t) => t.due_date && t.due_date > today).length,
    completed: visible.filter((t) => t.status === 'done').length,
  }), [open, visible, today]);

  const labels = useMemo(
    () => [...new Set(visible.flatMap((t) => t.tags || []))].sort(),
    [visible]
  );

  const shown = useMemo(() => {
    let list;
    if (label) list = visible.filter((t) => (t.tags || []).includes(label) && t.status !== 'done');
    else if (view === 'completed') list = visible.filter((t) => t.status === 'done');
    else if (view === 'today') list = open.filter((t) => (t.due_date && t.due_date <= today) || !t.due_date);
    else if (view === 'upcoming') list = open.filter((t) => t.due_date && t.due_date > today);
    else list = open; // inbox = everything not done

    const q = search.trim().toLowerCase();
    if (q) list = list.filter((t) => `${t.title} ${t.description || ''} ${(t.tags || []).join(' ')}`.toLowerCase().includes(q));
    if (priorityFilter !== 'all') list = list.filter((t) => (t.priority || '') === priorityFilter);

    const prioRank = { high: 0, medium: 1, low: 2 };
    return [...list].sort((a, b) => {
      if (sort === 'due') {
        const da = a.due_date || '9999', db = b.due_date || '9999';
        return da < db ? -1 : da > db ? 1 : 0;
      }
      if (sort === 'priority') return (prioRank[a.priority] ?? 3) - (prioRank[b.priority] ?? 3);
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }, [visible, open, view, label, search, priorityFilter, sort, today]);

  // ---- actions ------------------------------------------------------------
  const toggleTask = useCallback(async (task) => {
    const next = task.status === 'done' ? 'todo' : 'done';
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: next } : t))); // optimistic
    try {
      await api.setStatus(task.id, next);
    } catch (err) {
      notify(`Update failed: ${err.message}`);
      refresh();
    }
  }, [refresh]);

  async function saveTask(payload, id) {
    try {
      if (id) await api.updateTask(id, payload);
      else await api.createTask(payload);
      setFormOpen(false);
      await refresh();
      notify(id ? 'Task updated' : 'Task added');
    } catch (err) {
      notify(`Save failed: ${err.message}`);
    }
  }

  async function updateFromDetail(id, patch) {
    try {
      await api.updateTask(id, patch);
      await refresh();
      setDetailTask(null);
      notify('Task updated');
    } catch (err) {
      notify(`Save failed: ${err.message}`);
    }
  }

  async function deleteTask(id) {
    try {
      await api.deleteTask(id);
      setTasks((ts) => ts.filter((t) => t.id !== id));
      setDetailTask(null);
      notify('Task deleted');
    } catch (err) {
      notify(`Delete failed: ${err.message}`);
    }
  }

  // Quick add: parse natural language → structured fields → create directly.
  async function quickAdd(e) {
    e.preventDefault();
    const raw = e.target.elements.quick.value.trim();
    if (!raw) return;
    e.target.elements.quick.value = '';
    try {
      const parsed = await api.parse(raw);
      await api.createTask({
        title: parsed.title || raw,
        description: parsed.description || null,
        due_date: parsed.dueDate || null,
        due_time: parsed.dueTime || null,
        priority: parsed.priority || null,
        tags: parsed.tags || [],
      });
      await refresh();
      notify('Task added');
    } catch (err) {
      notify(`Could not add task: ${err.message}`);
    }
  }

  const meta = label ? { title: `#${label}`, empty: `No open tasks labeled “${label}”.` } : VIEW_META[view];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />}

      <Sidebar
        view={view} setView={setView} label={label} setLabel={setLabel}
        counts={counts} labels={labels}
        open={sidebarOpen} onClose={() => setSidebarOpen(false)}
        collapsed={collapsed} setCollapsed={setCollapsed}
      />

      {/* Main column */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-8">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Open menu">☰</button>
          <h1 className="min-w-0 truncate text-lg font-bold text-slate-800">{meta.title}</h1>
          {!loading && !loadError && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">{shown.length}</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setAiOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
            >
              ✨ <span className="hidden sm:inline">AI Assistant</span>
            </button>
            <button
              onClick={() => { setFormInitial(null); setFormOpen(true); }}
              className="rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              + Add Task
            </button>
          </div>
        </header>

        <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6 md:px-8">
          {/* Quick add */}
          <form onSubmit={quickAdd} className="mb-4">
            <input
              name="quick"
              placeholder='Add a task… try “Pay rent friday at 5pm #finance urgent”'
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </form>

          {/* Search + filters */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden>🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks"
                aria-label="Search tasks"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label="Filter by priority" className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400">
              <option value="all">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Normal</option>
              <option value="low">Low</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort tasks" className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400">
              <option value="created">Sort: Added</option>
              <option value="due">Sort: Due date</option>
              <option value="priority">Sort: Priority</option>
            </select>
          </div>

          {/* States */}
          {loading && (
            <div className="space-y-3" role="status" aria-label="Loading tasks">
              {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          )}

          {!loading && loadError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center">
              <p className="text-sm font-medium text-red-700">Couldn’t load your tasks: {loadError}</p>
              <button onClick={() => { setLoading(true); refresh(); }} className="mt-3 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700">Try again</button>
            </div>
          )}

          {!loading && !loadError && shown.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
              <p className="text-3xl" aria-hidden>{view === 'completed' ? '🎉' : '🗒️'}</p>
              <p className="mt-3 text-sm text-slate-500">{search ? `No tasks match “${search}”.` : meta.empty}</p>
              <button onClick={() => { setFormInitial(null); setFormOpen(true); }} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">+ Add Task</button>
            </div>
          )}

          {!loading && !loadError && shown.length > 0 && (
            <ul className="space-y-2">
              {shown.map((task) => (
                <TaskItem key={task.id} task={task} onToggle={toggleTask} onOpen={setDetailTask} />
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* Panels & modals */}
      <TaskDetail task={detailTask} onClose={() => setDetailTask(null)} onSave={updateFromDetail} onDelete={deleteTask} />

      <TaskFormModal
        open={formOpen}
        initial={formInitial}
        onClose={() => setFormOpen(false)}
        onSave={saveTask}
      />

      <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} onDataChanged={refresh} />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-lg" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
