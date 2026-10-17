import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

// ---------------------------------------------------------------------------
// Shared visual tokens for the 2030 high-density stream.
// ---------------------------------------------------------------------------

const PRIORITY_TONE = {
  P0: 'bg-red-500/15 text-red-400 border border-red-500/30',
  P1: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  P2: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
  P3: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
};

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'p0', label: '🔥 P0 Urgent' },
  { key: 'agent-ready', label: '⚡ Diff Ready' },
  { key: 'active', label: 'In Progress' },
  { key: 'done', label: 'Completed' },
];

// Distinct status rings: Backlog dashed zinc / In-Progress half-filled amber /
// In-Review purple dot / Done emerald checkmark.
function StatusIcon({ status }) {
  if (status === 'Done') {
    return (
      <span className="shrink-0 w-3.5 h-3.5 rounded-full border border-emerald-500/60 bg-emerald-500/20 flex items-center justify-center" title="Done">
        <svg viewBox="0 0 10 10" className="w-2 h-2 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1.5 5.5 L4 8 L8.5 2" />
        </svg>
      </span>
    );
  }
  if (status === 'In-Review') {
    return (
      <span className="shrink-0 w-3.5 h-3.5 rounded-full border border-purple-500/60 flex items-center justify-center" title="In Review">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
      </span>
    );
  }
  if (status === 'In-Progress') {
    return (
      <span
        className="shrink-0 w-3.5 h-3.5 rounded-full border border-amber-500/60 bg-gradient-to-r from-amber-400/70 to-amber-400/10"
        title="In Progress"
      />
    );
  }
  return (
    <span className="shrink-0 w-3.5 h-3.5 rounded-full border border-dashed border-zinc-600" title="Backlog" />
  );
}

// ---------------------------------------------------------------------------
// Inline rename input (opened with `e` on the focused row).
// ---------------------------------------------------------------------------

function InlineRenameInput({ task, onSave, onCancel }) {
  const [value, setValue] = useState(task.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation(); // global engine stays out while renaming
        if (e.key === 'Enter') onSave(task.id, value);
        if (e.key === 'Escape') onCancel();
      }}
      className="flex-1 min-w-0 bg-zinc-950 border border-cyan-500/50 rounded px-1.5 py-0.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
    />
  );
}

// ---------------------------------------------------------------------------
// Ultra-dense task row (Linear + Cursor 2030 style).
// ---------------------------------------------------------------------------

const TaskRow = React.memo(function TaskRow({ task, index, focused, editing, onSelect, onOpenDoc, onSaveTitle, onCancelEdit }) {
  const { toggleFocusedTaskDone, setCanvasViewMode, triggerAgentOnTask } = useWorkspace();
  const done = task.status === 'Done';

  const handleStatusToggle = (e) => {
    e.stopPropagation();
    // Sync focus cursor to this row first, then flip Done — keeps j/k bounds honest.
    onSelect(index, task.id, false);
    toggleFocusedTaskDone();
  };

  return (
    <li
      data-task-row={task.id}
      onClick={() => onSelect(index, task.id, false)}
      onDoubleClick={onOpenDoc}
      className={`h-10 px-3 border-b border-zinc-800/50 flex items-center justify-between gap-3 text-xs transition-all cursor-pointer select-none ${
        focused
          ? 'bg-zinc-900/95 border-l-2 border-l-cyan-400 ring-1 ring-inset ring-cyan-500/20'
          : 'border-l-2 border-l-transparent hover:bg-zinc-800/40'
      }`}
    >
      {/* Left cluster — identity & status */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <button
          type="button"
          onClick={handleStatusToggle}
          aria-label={done ? `Reopen #${task.id}` : `Mark #${task.id} done`}
          className="shrink-0 -m-1 p-1 rounded hover:bg-zinc-800/80 transition-colors"
        >
          <StatusIcon status={task.status} />
        </button>
        <span className={`shrink-0 w-8 text-center font-mono text-[10px] rounded px-1 py-0.5 ${PRIORITY_TONE[task.priority]}`}>
          {task.priority}
        </span>
        <span className="shrink-0 font-mono text-zinc-400 w-16 truncate">{task.id}</span>

        {editing ? (
          <InlineRenameInput task={task} onSave={onSaveTitle} onCancel={onCancelEdit} />
        ) : (
          <span className={`min-w-0 flex-1 truncate ${done ? 'line-through text-zinc-500' : 'font-medium text-zinc-100'}`}>
            {task.title}
          </span>
        )}
        {!editing && (
          <span className="shrink-0 font-mono text-[10px] text-zinc-500 hidden lg:inline" title={`${task.subtaskCount.completed}/${task.subtaskCount.total} sub-tasks complete`}>
            ☑ {task.subtaskCount.completed}/{task.subtaskCount.total}
          </span>
        )}
      </div>

      {/* Right cluster — 2030 agent telemetry, branch & assignee */}
      <div className="flex items-center gap-2 shrink-0">
        {task.agentStatus === 'running' && (
          <span className="animate-pulse font-mono text-[10px] px-1.5 py-0.5 rounded border border-purple-500/40 bg-purple-500/10 text-purple-300 whitespace-nowrap" title={task.agentSummary}>
            ⚡ Agent Running...
          </span>
        )}
        {task.agentStatus === 'diff-ready' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(index, task.id, false);
              setCanvasViewMode('diff');
            }}
            className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 whitespace-nowrap hover:bg-emerald-500/20 hover:shadow-[0_0_10px_rgba(16,185,129,0.25)] transition-all"
            title={task.agentSummary}
          >
            ✨ Diff Ready [d]
          </button>
        )}
        {task.agentStatus === 'completed' && (
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-zinc-700/80 bg-zinc-800/60 text-zinc-500 whitespace-nowrap" title={task.agentSummary}>
            ✓ AI Merged
          </span>
        )}
        {task.agentStatus === 'idle' && (
          <button
            type="button"
            title={`${task.agentSummary} — click to dispatch agent`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(index, task.id);
              triggerAgentOnTask(task.id);
            }}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-700/80 bg-zinc-900 text-zinc-500 hover:text-cyan-300 hover:border-cyan-500/40 transition-all shrink-0 whitespace-nowrap"
          >
            ○ Idle · Dispatch [r]
          </button>
        )}
        <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800/80 hidden md:inline-flex whitespace-nowrap">
          ⎇ {task.branch}
        </span>
        <span className="text-zinc-400 w-24 justify-end flex items-center gap-1.5 shrink-0">
          <span className="w-4 h-4 rounded-full bg-zinc-800 border border-zinc-700 text-[9px] font-semibold text-zinc-300 flex items-center justify-center">
            {task.assignee.charAt(0)}
          </span>
          <span className="hidden xl:inline">@{task.assignee}</span>
        </span>
        <span className="font-mono text-[10px] text-zinc-600 w-12 text-right shrink-0">{task.updatedAt}</span>
      </div>
    </li>
  );
});

// ---------------------------------------------------------------------------
// Inline quick-create composer row (opened with `c`).
// ---------------------------------------------------------------------------

function InlineCreateRow() {
  const { createTask, setIsCreatingTask } = useWorkspace();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('P1');
  const inputRef = useRef(null);

  useEffect(() => {
    // Auto-focus the composer the moment it mounts.
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const submit = useCallback(() => {
    const trimmed = title.trim();
    if (trimmed) createTask({ title: trimmed, priority });
    setIsCreatingTask(false);
  }, [title, priority, createTask, setIsCreatingTask]);

  return (
    <div className="bg-zinc-900/90 border border-cyan-500/50 rounded-md p-2.5 mb-2 flex items-center gap-3 shadow-lg shadow-cyan-500/5">
      {/* Priority selector pill */}
      <div className="flex items-center gap-1 shrink-0">
        {['P0', 'P1', 'P2', 'P3'].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPriority(p)}
            className={`font-mono text-[10px] rounded px-1.5 py-0.5 border transition-colors ${
              priority === p
                ? `${PRIORITY_TONE[p]} ring-1 ring-inset ring-current`
                : 'text-zinc-600 border-zinc-800 hover:text-zinc-400'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation(); // keep the global engine out of the composer
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') setIsCreatingTask(false);
        }}
        placeholder="Task title... (Press Enter to create, Esc to cancel)"
        className="flex-1 min-w-0 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
      />
      <span className="shrink-0 font-mono text-[10px] text-zinc-600 hidden md:inline">↵ create · esc cancel</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task Stream View — rendered by CenterCanvas when canvasViewMode === 'stream'.
// ---------------------------------------------------------------------------

function TaskStreamView() {
  const {
    tasks,
    filteredTasks,
    streamFilter,
    setStreamFilter,
    focusedTaskIndex,
    setFocusedTaskIndex,
    setActiveTaskId,
    activeTaskId,
    isCreatingTask,
    setIsCreatingTask,
    editingTaskId,
    setEditingTaskId,
    updateTaskTitle,
    triggerAgentOnTask,
    setCanvasViewMode,
  } = useWorkspace();

  const listRef = useRef(null);

  const counts = useMemo(
    () => ({
      diffReady: tasks.filter((t) => t.agentStatus === 'diff-ready').length,
      running: tasks.filter((t) => t.agentStatus === 'running').length,
    }),
    [tasks]
  );

  const focusedTask = filteredTasks[Math.min(focusedTaskIndex, filteredTasks.length - 1)] || null;

  const handleSelect = useCallback(
    (index, id) => {
      setFocusedTaskIndex(index);
      setActiveTaskId(id);
    },
    [setFocusedTaskIndex, setActiveTaskId]
  );

  const handleOpenDoc = useCallback(() => {
    setCanvasViewMode('doc');
  }, [setCanvasViewMode]);

  const handleCancelEdit = useCallback(() => setEditingTaskId(null), [setEditingTaskId]);

  // Keep the focused row in view when navigating with j/k.
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const rows = container.querySelectorAll('[data-task-row]');
    const row = rows[focusedTaskIndex];
    if (row && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedTaskIndex]);

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* A. Stream control & filter header bar */}
      <div className="h-10 shrink-0 px-3 flex items-center justify-between gap-3 border-b border-zinc-800/60 bg-zinc-950/40">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
          {FILTER_TABS.map((tab) => {
            const active = streamFilter === tab.key;
            const label = tab.key === 'all' ? `All (${tasks.length})` : tab.label;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStreamFilter(tab.key)}
                className={`whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                  active
                    ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                    : 'bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsCreatingTask(true)}
            className="px-2 py-0.5 rounded text-[11px] font-medium border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-colors"
          >
            + New Task <span className="font-mono text-[10px] opacity-70">[c]</span>
          </button>
          <button
            type="button"
            onClick={() => activeTaskId && triggerAgentOnTask(activeTaskId)}
            className="px-2 py-0.5 rounded text-[11px] font-medium border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition-colors"
            title={activeTaskId ? `Dispatch autonomous runner on #${activeTaskId}` : 'No active task'}
          >
            ⚡ Run Agent <span className="font-mono text-[10px] opacity-70">[r]</span>
          </button>
        </div>
      </div>

      {/* C. Ultra-dense rows (+ B. inline create row) */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="pt-2 px-1.5" ref={listRef}>
          {isCreatingTask && <InlineCreateRow />}
          <ul className="m-0">
            {filteredTasks.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                index={index}
                focused={index === focusedTaskIndex}
                editing={editingTaskId === task.id}
                onSelect={handleSelect}
                onOpenDoc={handleOpenDoc}
                onSaveTitle={updateTaskTitle}
                onCancelEdit={handleCancelEdit}
              />
            ))}
            {filteredTasks.length === 0 && (
              <li className="px-3 py-8 text-center text-xs text-zinc-600 font-mono">
                ∅ No tasks match this filter — press <span className="text-cyan-400">c</span> to create one
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* E. Bottom contextual action bar */}
      <div className="h-8 shrink-0 border-t border-zinc-800/80 bg-zinc-950/90 px-4 flex items-center justify-between text-[11px] font-mono text-zinc-500">
        <div className="flex items-center gap-2 min-w-0 truncate">
          <span className="text-cyan-400/90 shrink-0">{focusedTask ? `#${focusedTask.id}` : '#—'}</span>
          <span className="truncate hidden sm:inline">
            [Enter] Open Spec • [c] New • [e] Rename • [x] Done • [1-4] Priority • [r] Run Agent • [d] View Diff
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-emerald-400/80">✨ {counts.diffReady} Diff Ready</span>
          <span className={`text-purple-400/80 ${counts.running > 0 ? 'animate-pulse' : ''}`}>⚡ {counts.running} Running</span>
        </div>
      </div>
    </div>
  );
}

export default React.memo(TaskStreamView);
