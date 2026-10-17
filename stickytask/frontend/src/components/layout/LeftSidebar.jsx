import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

function SectionLabel({ children }) {
  return (
    <div className="px-3 pt-4 pb-1.5 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
      {children}
    </div>
  );
}

function Badge({ children, tone = 'amber' }) {
  const tones = {
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.25)]',
    cyan: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  };
  return (
    <span className={`ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded border ${tones[tone]}`}>
      {children}
    </span>
  );
}

function QueueItem({ icon, label, badge, badgeTone }) {
  const { setActivePane } = useWorkspace();
  return (
    <button
      type="button"
      onClick={() => setActivePane('sidebar')}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/60 rounded-sm transition-colors"
    >
      <span className="text-zinc-400 w-4 text-center shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
      {badge != null && <Badge tone={badgeTone}>{badge}</Badge>}
    </button>
  );
}

function TreeNode({ label, defaultOpen = false, active = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const { setActivePane } = useWorkspace();

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setActivePane('sidebar');
        }}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/60 rounded-sm transition-colors"
      >
        <span className="text-zinc-500 font-mono text-[10px] w-3 shrink-0">{open ? '▾' : '▸'}</span>
        <span className="truncate">{label}</span>
      </button>
      {open && <div className="ml-3 border-l border-zinc-800/80">{children}</div>}
    </div>
  );
}

function TreeLeaf({ label, active = false }) {
  const { setActivePane } = useWorkspace();
  return (
    <button
      type="button"
      onClick={() => setActivePane('sidebar')}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-sm transition-colors ${
        active
          ? 'bg-cyan-500/10 text-cyan-300 border-l-2 border-cyan-500'
          : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
      }`}
    >
      <span className="text-zinc-600 shrink-0">•</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function ViewItem({ icon, label }) {
  const { setActivePane } = useWorkspace();
  return (
    <button
      type="button"
      onClick={() => setActivePane('sidebar')}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 rounded-sm transition-colors"
    >
      <span className="text-zinc-500 w-4 text-center shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function LeftSidebar() {
  const { sidebarOpen, activePane, setActivePane } = useWorkspace();

  return (
    <aside
      onMouseDown={() => sidebarOpen && setActivePane('sidebar')}
      className={`h-full bg-[#121215] flex flex-col select-none transition-all duration-150 shrink-0 ${
        sidebarOpen
          ? `w-60 border-r border-zinc-800/80 ${
              activePane === 'sidebar'
                ? 'border-t border-t-cyan-500/80'
                : 'border-t border-t-transparent opacity-90 hover:opacity-100'
            }`
          : 'w-0 overflow-hidden border-r-0'
      }`}
      aria-hidden={!sidebarOpen}
    >
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Focus indicator header */}
        <div className="h-8 px-3 flex items-center justify-between border-b border-zinc-800/40">
          <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Explorer</span>
          {activePane === 'sidebar' && (
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
              FOCUSED
            </span>
          )}
        </div>

        <SectionLabel>Execution Queue</SectionLabel>
        <QueueItem icon="⚡" label="Agent Review Queue" badge={2} badgeTone="amber" />
        <QueueItem icon="★" label="My Priority" badge={4} badgeTone="amber" />

        <SectionLabel>Squads &amp; Workspaces</SectionLabel>
        <TreeNode label="Core Engineering" defaultOpen>
          <TreeLeaf label="Sprint 14 (Active)" active />
          <TreeLeaf label="Backlog & Triage" />
          <TreeLeaf label="Architecture Specs" />
        </TreeNode>
        <TreeNode label="Growth & GTM" />
        <TreeNode label="Infrastructure" />

        <SectionLabel>Views</SectionLabel>
        <ViewItem icon="▤" label="Linear Stream" />
        <ViewItem icon="◫" label="Autonomous Sprints" />
      </div>

      {/* Footer */}
      <div className="shrink-0 h-9 border-t border-zinc-800/80 px-3 flex items-center justify-between text-[11px] font-mono">
        <span className="text-zinc-500">
          <kbd className="text-zinc-400 bg-zinc-800/80 border border-zinc-700/60 rounded px-1 py-0.5">Cmd+B</kbd>
          <span className="ml-1.5">toggle</span>
        </span>
        <span className="flex items-center gap-1.5 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Connected
        </span>
      </div>
    </aside>
  );
}

export default React.memo(LeftSidebar);
