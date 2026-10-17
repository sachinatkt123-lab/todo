import React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

const MODE_CYCLE = ['stream', 'doc', 'diff'];

const PRIORITY_TONE = {
  P0: 'text-red-400 bg-red-500/10 border-red-500/30',
  P1: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  P2: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  P3: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
};

const STATUS_TONE = {
  'In-Progress': 'text-cyan-400',
  Backlog: 'text-zinc-500',
  'In-Review': 'text-purple-400',
  Done: 'text-emerald-500',
};

function FocusedBadge() {
  return (
    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
      FOCUSED
    </span>
  );
}

function StateChip({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 px-2.5 py-1.5 rounded bg-zinc-900/70 border border-zinc-800">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="font-mono text-xs text-cyan-300">{String(value)}</span>
    </div>
  );
}

function TestButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1.5 text-xs font-medium rounded bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700 hover:border-zinc-600 active:scale-[0.98] transition-all"
    >
      {children}
    </button>
  );
}

function CenterCanvas() {
  const {
    activePane,
    canvasViewMode,
    sidebarOpen,
    terminalOpen,
    activeTaskId,
    tasks,
    focusedTaskIndex,
    setActivePane,
    setActiveTaskId,
    setFocusedTaskIndex,
    toggleSidebar,
    toggleTerminal,
    setCanvasViewMode,
    addSystemLog,
  } = useWorkspace();

  const nextMode = MODE_CYCLE[(MODE_CYCLE.indexOf(canvasViewMode) + 1) % MODE_CYCLE.length];

  const handleSimulateAgentLog = () => {
    addSystemLog('AGENT', 'Simulated run #417 — planner emitted 3 subtasks, awaiting approval gate');
  };

  const handleSwitchMode = () => {
    setCanvasViewMode(nextMode);
    addSystemLog('USR', `Diagnostic: canvas mode cycled "${canvasViewMode}" → "${nextMode}"`);
  };

  const handleRowClick = (task, index) => {
    // Clicking a row syncs both the keyboard focus cursor and the active task.
    if (typeof setFocusedTaskIndex === 'function') setFocusedTaskIndex(index);
    setActiveTaskId(task.id);
  };

  return (
    <main
      onMouseDown={() => setActivePane('canvas')}
      className={`flex-1 h-full bg-[#09090b] flex flex-col overflow-hidden relative min-w-0 ${
        activePane === 'canvas'
          ? 'border-t border-t-cyan-500/80'
          : 'border-t border-t-transparent opacity-90 hover:opacity-100'
      }`}
    >
      {/* Sub-header bar */}
      <div className="h-9 border-b border-zinc-800/60 px-4 flex items-center justify-between bg-zinc-950/50 shrink-0">
        <div className="flex items-center gap-2">
          {['All Tasks', 'P0 Urgent', 'Agent Ready'].map((pill, i) => (
            <button
              key={pill}
              type="button"
              className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                i === 0
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                  : 'bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
              }`}
            >
              {pill}
            </button>
          ))}
          {activePane === 'canvas' && <FocusedBadge />}
        </div>
        <span className="font-mono text-[10px] tracking-wider text-zinc-500">
          MODE: <span className="text-cyan-400">{canvasViewMode.toUpperCase()}</span>
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <section className="max-w-3xl mx-auto space-y-6">
          {/* Architecture Diagnostic Card */}
          <div className="rounded-lg border border-zinc-800 bg-[#121215] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/40">
              <h2 className="text-xs font-semibold tracking-wide text-zinc-200">
                🧪 STEP 2 — KEYBOARD ENGINE DIAGNOSTIC
              </h2>
              <span className="font-mono text-[10px] text-zinc-500">WorkspaceContext · live state</span>
            </div>

            <div className="p-4 space-y-4">
              {/* Focus Trap sandbox input */}
              <input
                type="text"
                placeholder="Focus Trap Test: Type 'j', 'k', or 'x' here (shortcuts won't fire until you press Esc)..."
                onFocus={() => addSystemLog('USR', 'Focus trap engaged — single-key shortcuts suppressed')}
                className="w-full px-3 py-2 text-xs font-mono rounded bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <StateChip label="activePane" value={activePane} />
                <StateChip label="viewMode" value={canvasViewMode} />
                <StateChip label="sidebar" value={sidebarOpen ? 'OPEN' : 'CLOSED'} />
                <StateChip label="terminal" value={terminalOpen ? 'OPEN' : 'CLOSED'} />
                <StateChip label="activeTask" value={`#${activeTaskId}`} />
              </div>

              <div className="flex flex-wrap gap-2">
                <TestButton onClick={handleSimulateAgentLog}>Simulate Agent Log</TestButton>
                <TestButton onClick={toggleSidebar}>Toggle Sidebar (Cmd+B)</TestButton>
                <TestButton onClick={toggleTerminal}>Toggle Terminal (Cmd+J)</TestButton>
                <TestButton onClick={handleSwitchMode}>Switch Canvas Mode</TestButton>
              </div>

              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Keyboard engine mounted in AppShell: <code className="font-mono text-cyan-400/80">j/k</code>{' '}
                navigate, <code className="font-mono text-cyan-400/80">x</code> toggles Done,{' '}
                <code className="font-mono text-cyan-400/80">Enter</code> opens Spec Doc,{' '}
                <code className="font-mono text-cyan-400/80">d</code> inspects AI Diff,{' '}
                <code className="font-mono text-cyan-400/80">?</code> shows the keyboard map. Watch the HUD
                pill in the status bar for live keystroke telemetry.
              </p>
            </div>
          </div>

          {/* Interactive Task Focus List (Step 2 — replaces static skeleton) */}
          <div className="rounded-lg border border-zinc-800 bg-[#121215] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between">
              <h3 className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
                Execution Stream — j / k to navigate · x to toggle
              </h3>
              <span className="font-mono text-[10px] text-zinc-600">
                focus[{focusedTaskIndex}] / {tasks.length}
              </span>
            </div>
            <ul className="divide-y divide-zinc-800/60">
              {tasks.map((task, index) => {
                const focused = index === focusedTaskIndex;
                const done = task.status === 'Done';
                return (
                  <li
                    key={task.id}
                    onClick={() => handleRowClick(task, index)}
                    className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-all ${
                      focused
                        ? 'bg-zinc-900/90 border-l-2 border-l-cyan-400 ring-1 ring-zinc-700/80 text-zinc-100'
                        : 'border-l-2 border-l-transparent hover:bg-zinc-800/40'
                    } ${done ? 'line-through text-zinc-500 opacity-60' : ''}`}
                  >
                    <span
                      className={`shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_TONE[task.priority]}`}
                    >
                      {task.priority}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500 shrink-0">#{task.id}</span>
                    <span className={`text-xs truncate flex-1 ${done ? 'line-through' : 'text-zinc-200'}`}>
                      {task.title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-zinc-600 hidden md:inline">
                      {task.branch}
                    </span>
                    <span className="shrink-0 text-[11px] font-mono text-zinc-500 hidden md:inline">
                      @{task.assignee}
                    </span>
                    <span className={`shrink-0 text-[11px] ${STATUS_TONE[task.status] || 'text-zinc-400'}`}>
                      {task.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}

export default React.memo(CenterCanvas);
