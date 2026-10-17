import React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

const PANEL_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

const SEARCH_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

// Redesign — a calm, human header: logo + workspace on the left, one friendly
// search / "tell AI what to do" bar in the center, and just two actions on the
// right ("+ New Task" and "✨ Ask AI"). No breadcrumbs, no mode switches, no
// [Cmd+P] bracket clutter.
function TopCommandBar() {
  const {
    sidebarOpen,
    tasks,
    toggleSidebar,
    setCommandPaletteOpen,
    setQuickSwitcherOpen,
    setIsCreatingTask,
    addSystemLog,
  } = useWorkspace();

  const readyCount = tasks.filter((t) => t.agentStatus === 'diff-ready').length;

  const handleSearch = () => {
    // Never stack modals — the search/AI bar opens the Omni palette.
    setQuickSwitcherOpen(false);
    setCommandPaletteOpen(true);
  };

  const handleAskAi = () => {
    setQuickSwitcherOpen(false);
    setCommandPaletteOpen(true);
    addSystemLog('AGENT', 'AI assistant opened — tell it what you need done');
  };

  const handleNewTask = () => {
    setIsCreatingTask(true);
    addSystemLog('USR', 'Started creating a new task');
  };

  return (
    <header className="h-14 border-b border-zinc-800/80 bg-[#09090b] px-4 flex items-center justify-between gap-4 select-none z-20">
      {/* Left — logo & workspace name */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <button
          type="button"
          onClick={toggleSidebar}
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
          className={`p-1.5 rounded-lg transition-colors ${
            sidebarOpen
              ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
          }`}
        >
          {PANEL_ICON}
        </button>

        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center text-sm font-bold text-zinc-950 shadow-[0_0_14px_rgba(6,182,212,0.35)]">
          S
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-zinc-100">StickyTask</p>
          <p className="text-[11px] text-zinc-500">Acme Team</p>
        </div>
      </div>

      {/* Center — one friendly search & AI bar */}
      <div className="flex items-center justify-center flex-1 min-w-0 px-2">
        <button
          type="button"
          onClick={handleSearch}
          className="w-full max-w-md h-9 px-3 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-600 flex items-center gap-2 text-sm text-zinc-500 transition-all"
        >
          {SEARCH_ICON}
          <span className="truncate">Search tasks or tell AI what to do...</span>
        </button>
      </div>

      {/* Right — exactly two clear actions */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="hidden xl:inline text-[11px] text-zinc-600 mr-1">
          {readyCount > 0 ? `${readyCount} AI draft${readyCount > 1 ? 's' : ''} waiting ✨` : 'All caught up!'}
        </span>
        <button
          type="button"
          onClick={handleAskAi}
          className="px-3.5 py-2 rounded-xl text-sm font-medium text-purple-300 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-colors"
        >
          ✨ Ask AI
        </button>
        <button
          type="button"
          onClick={handleNewTask}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-950 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.4)] transition-all"
        >
          + New Task
        </button>
      </div>
    </header>
  );
}

export default React.memo(TopCommandBar);
