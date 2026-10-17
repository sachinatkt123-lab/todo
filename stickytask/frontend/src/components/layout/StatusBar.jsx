import React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

const PANES = [
  { id: 'sidebar', label: '1: Sidebar' },
  { id: 'canvas', label: '2: Canvas' },
  { id: 'terminal', label: '3: Terminal' },
];

function StatusBar() {
  const { activePane, setActivePane, lastTriggeredKey, setShortcutHelpOpen, shortcutHelpOpen } =
    useWorkspace();

  return (
    <footer className="h-6 border-t border-zinc-800/80 bg-[#09090b] px-3 flex items-center justify-between font-mono text-[11px] text-zinc-500 select-none z-20 shrink-0">
      <div className="flex items-center gap-1 min-w-0">
        {PANES.map((pane) => (
          <button
            key={pane.id}
            type="button"
            onClick={() => setActivePane(pane.id)}
            className={`px-1.5 py-0.5 rounded-sm transition-colors ${
              activePane === pane.id
                ? 'text-cyan-400 font-semibold bg-cyan-500/10'
                : 'hover:text-zinc-300'
            }`}
          >
            [{pane.label}]
          </button>
        ))}

        {/* Live keystroke HUD pill — glows on every hotkey the engine fires */}
        {lastTriggeredKey && (
          <span
            key={lastTriggeredKey.timestamp}
            className="ml-2 px-2 py-0.5 rounded-full text-[10px] truncate max-w-[260px]
                       text-amber-300 bg-amber-500/10 border border-amber-500/30
                       shadow-[0_0_10px_rgba(245,158,11,0.35)] animate-pulse"
            title={`${lastTriggeredKey.combo} → ${lastTriggeredKey.label}`}
          >
            ⚡ [{lastTriggeredKey.combo}] {lastTriggeredKey.label}
          </span>
        )}

        <button
          type="button"
          onClick={() => setShortcutHelpOpen(!shortcutHelpOpen)}
          className={`ml-2 px-1.5 py-0.5 rounded-sm transition-colors ${
            shortcutHelpOpen ? 'text-cyan-400 font-semibold bg-cyan-500/10' : 'hover:text-zinc-300'
          }`}
        >
          [? Shortcuts]
        </button>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span>[Engine: Qwen-Agent-v1]</span>
        <span>[Latency: 12ms]</span>
        <span>[UTF-8]</span>
        <span>[StickyTask 2030.1]</span>
      </div>
    </footer>
  );
}

export default React.memo(StatusBar);
