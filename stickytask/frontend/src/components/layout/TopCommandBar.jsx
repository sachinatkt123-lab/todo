import React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

const PANEL_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

const TERMINAL_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="17" x2="20" y2="17" />
  </svg>
);

const SEARCH_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const CHEVRON_DOWN = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const VIEW_MODES = [
  { id: 'stream', label: 'Stream' },
  { id: 'doc', label: 'Spec Doc' },
  { id: 'diff', label: 'AI Diff' },
];

function Kbd({ children }) {
  return (
    <kbd className="font-mono text-[10px] leading-none text-zinc-500 bg-zinc-800/80 border border-zinc-700/60 rounded px-1 py-0.5">
      {children}
    </kbd>
  );
}

function TopCommandBar() {
  const {
    sidebarOpen,
    terminalOpen,
    activeTaskId,
    canvasViewMode,
    toggleSidebar,
    toggleTerminal,
    setQuickSwitcherOpen,
    setCanvasViewMode,
    addSystemLog,
  } = useWorkspace();

  const handleQuickJump = () => {
    setQuickSwitcherOpen(true);
    addSystemLog('USR', 'Quick Jump palette requested from command bar');
  };

  const handleComposer = () => {
    addSystemLog('AGENT', 'Omni-Agent Composer invoked — awaiting prompt routing');
  };

  const handleModeChange = (mode) => {
    setCanvasViewMode(mode);
    addSystemLog('USR', `Canvas view mode switched to "${mode}"`);
  };

  return (
    <header className="h-11 border-b border-zinc-800/80 bg-[#09090b] px-3 flex items-center justify-between select-none z-20">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={toggleSidebar}
          title="Toggle Sidebar (Cmd+B)"
          aria-label="Toggle sidebar"
          className={`p-1.5 rounded transition-colors ${
            sidebarOpen
              ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
          }`}
        >
          {PANEL_ICON}
        </button>

        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
          <span className="text-[11px] font-semibold tracking-wide text-zinc-300">ACME CORP</span>
          <span className="text-zinc-500">{CHEVRON_DOWN}</span>
        </div>

        <nav className="hidden md:flex items-center text-xs font-mono truncate" aria-label="Breadcrumb">
          <span className="text-zinc-400">Core Engineering</span>
          <span className="text-zinc-600 mx-1">/</span>
          <span className="text-zinc-400">Sprint 14</span>
          <span className="text-zinc-600 mx-1">/</span>
          <span className="text-zinc-200">#{activeTaskId}</span>
          <span className="text-zinc-600">/</span>
        </nav>
      </div>

      {/* Center */}
      <div className="flex items-center justify-center flex-1 min-w-0 px-4">
        <button
          type="button"
          onClick={handleQuickJump}
          className="w-80 md:w-96 h-7 px-2.5 rounded bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between text-xs text-zinc-400 cursor-pointer transition-all"
        >
          <span className="flex items-center gap-2 min-w-0">
            {SEARCH_ICON}
            <span className="truncate">Jump to task, spec, or branch...</span>
          </span>
          <Kbd>Cmd+P</Kbd>
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded bg-zinc-900 border border-zinc-800 p-0.5">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => handleModeChange(mode.id)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                canvasViewMode === mode.id
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleComposer}
          className="flex items-center gap-1.5 border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs px-2.5 py-1 rounded font-mono hover:bg-cyan-500/20 transition-colors shadow-[0_0_10px_rgba(6,182,212,0.15)]"
        >
          <span>⚡ Composer</span>
          <Kbd>Cmd+K</Kbd>
        </button>

        <button
          type="button"
          onClick={toggleTerminal}
          title="Toggle Terminal (Cmd+J)"
          aria-label="Toggle terminal"
          className={`p-1.5 rounded transition-colors ${
            terminalOpen
              ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/30'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
          }`}
        >
          {TERMINAL_ICON}
        </button>
      </div>
    </header>
  );
}

export default React.memo(TopCommandBar);
