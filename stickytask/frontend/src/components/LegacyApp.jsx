import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api/client';
import QuickAdd from './components/QuickAdd';
import ListView from './components/ListView';
import BoardView from './components/BoardView';
import TaskFormModal from './components/TaskFormModal';
import DigestModal from './components/DigestModal';
import { isSnoozed } from './utils';

// Poll cadence: while any task is snoozed we poll fast (5s) so it reappears
// promptly; otherwise the board is static and a slow 60s poll is plenty —
// cutting idle API traffic by ~12×.
const FAST_MS = 5000;
const SLOW_MS = 60000;

export default function LegacyApp() {
  const [view, setView] = useState('list'); // 'list' | 'board'
  const [tasks, setTasks] = useState([]);
  const [loadError, setLoadError] = useState(null);

  // create/edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState(null);
  const [saving, setSaving] = useState(false);

  // digest modal
  const [digestOpen, setDigestOpen] = useState(false);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestText, setDigestText] = useState('');
  const [digestError, setDigestError] = useState(null);

  // Latest tasks without making the polling effect depend on them.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Poll so snoozed tasks reappear automatically when their time passes.
  const refresh = useCallback(async () => {
    try {
      const rows = await api.listTasks();
      setTasks(rows);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    let timer;
    let cancelled = false;
    const schedule = () => {
      if (cancelled) return;
      const delay = tasksRef.current.some((t) => isSnoozed(t)) ? FAST_MS : SLOW_MS;
      timer = setTimeout(async () => {
        await refresh();
        schedule();
      }, delay);
    };
    refresh().then(schedule);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refresh]);

  // Client-side guard: hide anything still snoozed (server already filters,
  // but this keeps the UI correct between polls).
  const visible = useMemo(() => tasks.filter((t) => !isSnoozed(t)), [tasks]);

  // ----- quick add → parse → pre-filled form -------------------------------
  function handleParsed(parsed) {
    setFormInitial({ ...parsed, id: null });
    setFormOpen(true);
  }

  function openNewBlank() {
    setFormInitial(null);
    setFormOpen(true);
  }

  const openEdit = useCallback((task) => {
    setFormInitial({ ...task });
    setFormOpen(true);
  }, []);

  async function handleSave(payload, id) {
    setSaving(true);
    try {
      if (id) await api.updateTask(id, payload);
      else await api.createTask(payload);
      setFormOpen(false);
      await refresh();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const handleDelete = useCallback(async (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try {
      await api.deleteTask(task.id);
      setTasks((ts) => ts.filter((t) => t.id !== task.id));
    } catch (err) {
      alert(err.message);
    }
  }, []);

  const handleSnooze = useCallback(async (task) => {
    const until = new Date(Date.now() + 60 * 60 * 1000); // +1 hour
    const iso = until.toISOString();
    try {
      await api.updateTask(task.id, { snooze_until: iso });
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, snooze_until: iso } : t)));
    } catch (err) {
      alert(err.message);
    }
  }, []);

  // ----- board drag → PATCH status -----------------------------------------
  const handleDragEnd = useCallback(async (taskId, toStatus) => {
    // optimistic update for snappy feel
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status: toStatus } : t)));
    try {
      await api.setStatus(taskId, toStatus);
    } catch (err) {
      alert(`Move failed: ${err.message}`);
      refresh();
    }
  }, [refresh]);

  // ----- digest -------------------------------------------------------------
  async function openDigest() {
    setDigestOpen(true);
    setDigestLoading(true);
    setDigestError(null);
    setDigestText('');
    try {
      const text = await api.digest();
      setDigestText(text);
    } catch (err) {
      setDigestError(err.message);
    } finally {
      setDigestLoading(false);
    }
  }

  const tabCls = (active) =>
    `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
      active ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'
    }`;

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-6">
      {/* Header */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black tracking-tight text-slate-800">
            🗒️ Sticky<span className="text-indigo-600">Task</span>
          </h1>
          <div className="flex rounded-xl bg-slate-200/70 p-1">
            <button onClick={() => setView('list')} className={tabCls(view === 'list')}>
              List
            </button>
            <button onClick={() => setView('board')} className={tabCls(view === 'board')}>
              Board
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openDigest}
            className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-amber-950 shadow hover:bg-amber-300"
          >
            ☀️ Daily digest
          </button>
          <button
            onClick={openNewBlank}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-indigo-700"
          >
            + New
          </button>
        </div>
      </header>

      {/* Quick add bar */}
      <div className="mb-6">
        <QuickAdd onParsed={handleParsed} />
      </div>

      {loadError && (
        <p className="mb-4 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">
          Can’t reach the API: {loadError}
        </p>
      )}

      {/* Views */}
      {view === 'list' ? (
        <ListView tasks={visible} onEdit={openEdit} onDelete={handleDelete} onSnooze={handleSnooze} />
      ) : (
        <BoardView
          tasks={visible}
          onDragEnd={handleDragEnd}
          onEdit={openEdit}
          onDelete={handleDelete}
          onSnooze={handleSnooze}
        />
      )}

      <TaskFormModal
        open={formOpen}
        initial={formInitial}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />

      <DigestModal
        open={digestOpen}
        loading={digestLoading}
        text={digestText}
        error={digestError}
        onClose={() => setDigestOpen(false)}
      />
    </div>
  );
}
