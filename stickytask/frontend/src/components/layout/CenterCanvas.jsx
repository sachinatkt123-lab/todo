import React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import TaskStreamView from '../canvas/TaskStreamView';
import TaskDocCanvas from '../canvas/TaskDocCanvas';
import AiDiffView from '../canvas/AiDiffView';

const MODE_CYCLE = ['stream', 'doc', 'diff'];

function FocusedBadge() {
  return (
    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
      FOCUSED
    </span>
  );
}

// Step 3 — the sub-header filter pills are now wired to WorkspaceContext's
// streamFilter so they drive the real TaskStreamView bounds.
const HEADER_PILLS = [
  { label: 'All Tasks', filter: 'all' },
  { label: 'P0 Urgent', filter: 'p0' },
  { label: 'Agent Ready', filter: 'agent-ready' },
];

function CenterCanvas() {
  const {
    activePane,
    canvasViewMode,
    streamFilter,
    setActivePane,
    setCanvasViewMode,
    setStreamFilter,
    addSystemLog,
  } = useWorkspace();

  const nextMode = MODE_CYCLE[(MODE_CYCLE.indexOf(canvasViewMode) + 1) % MODE_CYCLE.length];

  const handleSwitchMode = () => {
    setCanvasViewMode(nextMode);
    addSystemLog('USR', `Diagnostic: canvas mode cycled "${canvasViewMode}" → "${nextMode}"`);
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
      <div className="h-9 shrink-0 border-b border-zinc-800/60 px-4 flex items-center justify-between bg-zinc-950/50">
        <div className="flex items-center gap-2">
          {HEADER_PILLS.map((pill) => {
            const active = streamFilter === pill.filter;
            return (
              <button
                key={pill.filter}
                type="button"
                onClick={() => setStreamFilter(pill.filter)}
                className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                  active
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                    : 'bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={handleSwitchMode}
            className="ml-1 px-2 py-0.5 rounded-full text-[11px] border border-zinc-800 text-zinc-600 hover:text-zinc-300 hover:border-zinc-700 transition-colors"
            title="Cycle diagnostic view mode"
          >
            ⟳ Mode
          </button>
          {activePane === 'canvas' && <FocusedBadge />}
        </div>
        <span className="font-mono text-[10px] tracking-wider text-zinc-500">
          MODE: <span className="text-cyan-400">{canvasViewMode.toUpperCase()}</span>
        </span>
      </div>

      {/* Body — full-bleed slot routing per canvasViewMode */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {canvasViewMode === 'stream' ? (
          <TaskStreamView />
        ) : canvasViewMode === 'doc' ? (
          // Step 4 — Document Spec Canvas renders full-bleed (it owns its own
          // sticky nav bar, scrollable doc body and slash command dock).
          <TaskDocCanvas />
        ) : (
          // Step 6 — AI Diff & Merge Engine owns the 'diff' slot full-bleed
          // (sticky deliverable header, unified diff body, merge decision bar).
          <AiDiffView />
        )}
      </div>
    </main>
  );
}

export default React.memo(CenterCanvas);
