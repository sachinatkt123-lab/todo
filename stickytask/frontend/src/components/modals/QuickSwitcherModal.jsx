import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { fuzzyScore } from './OmniCommandPalette';

const PRIORITY_STYLES = {
  P0: 'bg-red-500/15 text-red-400 border-red-500/30',
  P1: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  P2: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  P3: 'bg-zinc-800 text-zinc-400 border-zinc-700',
};

const STATUS_BADGES = {
  Backlog: 'text-zinc-400 bg-zinc-800/80 border-zinc-700',
  'In-Progress': 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  'In-Review': 'text-purple-300 bg-purple-500/10 border-purple-500/30',
  Done: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
};

// Inline search icon (lucide-react is not installed in this project).
const IconSearch = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

const VIEW_JUMPS = [
  { id: 'jump-all', label: 'Filter: All Tasks', filter: 'all', glyph: '▤' },
  { id: 'jump-p0', label: 'Filter: P0 Urgent Only', filter: 'p0', glyph: '🔥' },
  { id: 'jump-diff', label: 'Filter: AI Diff Ready', filter: 'agent-ready', glyph: '✨' },
];

function QuickSwitcherModal() {
  const {
    quickSwitcherOpen,
    setQuickSwitcherOpen,
    tasks,
    setActiveTaskId,
    setCanvasViewMode,
    setStreamFilter,
    addSystemLog,
    triggerKeyFeedback,
  } = useWorkspace();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const close = useCallback(() => setQuickSwitcherOpen(false), [setQuickSwitcherOpen]);

  useEffect(() => {
    if (quickSwitcherOpen) {
      setQuery('');
      setSelectedIndex(0);
      const raf = requestAnimationFrame(() => {
        if (inputRef.current) inputRef.current.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
    return undefined;
  }, [quickSwitcherOpen]);

  // ---- Multi-field fuzzy matching over id / title / branch / assignee / priority
  const matchedTasks = useMemo(() => {
    const q = query.trim();
    if (!q) return tasks;
    return tasks
      .map((task) => {
        const haystack = `${task.id} ${task.title} ${task.branch} ${task.assignee} ${task.priority}`;
        return { task, score: fuzzyScore(q, haystack) };
      })
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.task);
  }, [tasks, query]);

  const options = useMemo(
    () => [
      ...matchedTasks.map((task) => ({ kind: 'task', task })),
      ...VIEW_JUMPS.map((jump) => ({ kind: 'view', jump })),
    ],
    [matchedTasks]
  );

  useEffect(() => {
    setSelectedIndex((idx) => Math.min(idx, Math.max(options.length - 1, 0)));
  }, [options.length]);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const rows = container.querySelectorAll('[data-jump-row]');
    const row = rows[selectedIndex];
    if (row && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, options.length]);

  const selectTask = useCallback(
    (task) => {
      setActiveTaskId(task.id); // also syncs focusedTaskIndex via context
      setCanvasViewMode('doc');
      addSystemLog('USR', `Quick-jumped to #${task.id}`);
      triggerKeyFeedback('Cmd+P', `Jump → #${task.id}`);
      close();
    },
    [setActiveTaskId, setCanvasViewMode, addSystemLog, triggerKeyFeedback, close]
  );

  const selectViewJump = useCallback(
    (jump) => {
      setCanvasViewMode('stream');
      setStreamFilter(jump.filter);
      addSystemLog('USR', `Quick-jumped to view filter: ${jump.label}`);
      triggerKeyFeedback('Cmd+P', jump.label);
      close();
    },
    [setCanvasViewMode, setStreamFilter, addSystemLog, triggerKeyFeedback, close]
  );

  const executeOption = useCallback(
    (option) => {
      if (!option) return;
      if (option.kind === 'task') selectTask(option.task);
      else selectViewJump(option.jump);
    },
    [selectTask, selectViewJump]
  );

  const handleInputKeyDown = useCallback(
    (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((idx) => (options.length === 0 ? 0 : (idx + 1) % options.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((idx) => (options.length === 0 ? 0 : (idx - 1 + options.length) % options.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        executeOption(options[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    },
    [options, selectedIndex, executeOption, close]
  );

  if (!quickSwitcherOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-start justify-center pt-[14vh] select-none"
      onMouseDown={close}
      data-testid="quick-switcher-backdrop"
    >
      <div
        className="w-full max-w-xl bg-[#121215] border border-zinc-800 rounded-lg shadow-2xl overflow-hidden ring-1 ring-cyan-500/20"
        onMouseDown={(e) => e.stopPropagation()}
        data-testid="quick-switcher"
      >
        {/* Search input */}
        <div className="h-12 px-4 border-b border-zinc-800 flex items-center gap-3 bg-zinc-900/50">
          <span className="text-zinc-500">
            <IconSearch />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Jump to any task ID, title, git branch, or assignee..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none font-mono"
            spellCheck={false}
            autoComplete="off"
            data-testid="switcher-input"
          />
          <kbd className="font-mono text-[10px] text-zinc-500 bg-zinc-800/80 border border-zinc-700 rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>

        {/* Dense match list */}
        <div ref={listRef} className="max-h-[46vh] overflow-y-auto custom-scrollbar py-2">
          {options.length === 0 && (
            <div className="px-4 py-6 text-center text-xs font-mono text-zinc-500">
              No tasks match "{query.trim()}".
            </div>
          )}
          {matchedTasks.length > 0 && (
            <div className="px-4 pt-1 pb-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              Tasks ({matchedTasks.length})
            </div>
          )}
          {matchedTasks.map((task) => {
            const idx = options.findIndex((o) => o.kind === 'task' && o.task.id === task.id);
            const selected = idx === selectedIndex;
            return (
              <button
                key={task.id}
                type="button"
                data-jump-row
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => selectTask(task)}
                className={`w-full h-10 px-4 flex items-center gap-3 text-left transition-colors ${
                  selected ? 'bg-cyan-500/10 ring-1 ring-inset ring-cyan-500/20' : 'hover:bg-zinc-800/50'
                }`}
              >
                <span
                  className={`w-8 shrink-0 text-center font-mono text-[10px] rounded px-1 py-0.5 border ${PRIORITY_STYLES[task.priority]}`}
                >
                  {task.priority}
                </span>
                <span className="font-mono text-[11px] text-zinc-400 w-16 shrink-0">#{task.id}</span>
                <span
                  className={`text-xs truncate flex-1 ${
                    task.status === 'Done' ? 'line-through text-zinc-500' : 'text-zinc-100'
                  }`}
                >
                  {task.title}
                </span>
                <span
                  className={`shrink-0 font-mono text-[10px] rounded border px-1.5 py-0.5 ${STATUS_BADGES[task.status] || STATUS_BADGES.Backlog}`}
                >
                  {task.status}
                </span>
                <span className="hidden md:inline-flex shrink-0 font-mono text-[10px] text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800/80 items-center gap-1">
                  ⎇ {task.branch}
                </span>
                <span className="shrink-0 text-[11px] text-zinc-400 w-20 text-right">@{task.assignee}</span>
              </button>
            );
          })}

          {/* Workspace view quick-jumps */}
          <div className="px-4 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 border-t border-zinc-800/60 mt-1">
            Workspace Views
          </div>
          {VIEW_JUMPS.map((jump) => {
            const idx = options.findIndex((o) => o.kind === 'view' && o.jump.id === jump.id);
            const selected = idx === selectedIndex;
            return (
              <button
                key={jump.id}
                type="button"
                data-jump-row
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => selectViewJump(jump)}
                className={`w-full h-9 px-4 flex items-center gap-3 text-left text-xs transition-colors ${
                  selected ? 'bg-cyan-500/10 text-zinc-100 ring-1 ring-inset ring-cyan-500/20' : 'text-zinc-300 hover:bg-zinc-800/50'
                }`}
              >
                <span className="w-8 text-center text-zinc-500">{jump.glyph}</span>
                <span>{jump.label}</span>
                {selected && <span className="ml-auto font-mono text-[10px] text-cyan-400">Enter ↵</span>}
              </button>
            );
          })}
        </div>

        <div className="h-8 border-t border-zinc-800/80 bg-zinc-950/80 px-4 flex items-center justify-between text-[10px] font-mono text-zinc-500">
          <span>↑↓ Navigate • Enter Jump • Esc Dismiss</span>
          <span>{options.length} results</span>
        </div>
      </div>
    </div>
  );
}

export default React.memo(QuickSwitcherModal);
