import React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

const SHORTCUT_GROUPS = [
  {
    title: 'Workspace & Panes',
    items: [
      { keys: ['Cmd', 'B'], label: 'Toggle Left Sidebar' },
      { keys: ['Cmd', 'J'], label: 'Toggle Right Terminal' },
      { keys: ['Alt', '1 / 2 / 3'], label: 'Focus Sidebar / Canvas / Terminal' },
      { keys: ['[', ']'], label: 'Cycle Pane Focus (prev / next)' },
    ],
  },
  {
    title: 'Task Navigation',
    items: [
      { keys: ['j', '↓'], label: 'Next Task' },
      { keys: ['k', '↑'], label: 'Previous Task' },
      { keys: ['x'], label: 'Toggle Focused Task Done' },
      { keys: ['Enter'], label: 'Open Spec Doc for Focused Task' },
      { keys: ['c'], label: 'New Inline Task (quick-create)' },
      { keys: ['e'], label: 'Inline Rename Focused Task' },
      { keys: ['s'], label: 'Cycle Status (Backlog → … → Done)' },
      { keys: ['r'], label: 'Run AI Agent on Active Task' },
      { keys: ['1', '2', '3', '4'], label: 'Set Priority P0 / P1 / P2 / P3' },
      { keys: ['d'], label: 'Inspect AI Diff' },
      { keys: ['Esc'], label: 'Cancel Inline Edit → Close Modal → Blur Input → Return to Stream' },
    ],
  },
  {
    title: 'AI & Command Engine',
    items: [
      { keys: ['Cmd', 'K'], label: 'Omni Command Palette (Composer)' },
      { keys: ['Cmd', 'P'], label: 'Quick Jump Switcher' },
      { keys: ['?'], label: 'Toggle This Keyboard Map' },
    ],
  },
];

function KeyBadge({ children }) {
  return (
    <kbd className="font-mono text-[10px] text-zinc-300 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 shadow-[inset_0_-1px_0_rgba(0,0,0,0.4)]">
      {children}
    </kbd>
  );
}

function ShortcutHelpModal() {
  const { shortcutHelpOpen, setShortcutHelpOpen } = useWorkspace();

  if (!shortcutHelpOpen) return null;

  const dismiss = () => setShortcutHelpOpen(false);

  return (
    // Backdrop — clicking outside the panel dismisses cleanly.
    <div
      className="fixed inset-0 backdrop-blur-sm bg-black/60 z-50 flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts cheatsheet"
    >
      <div className="w-[min(680px,92vw)] max-h-[80vh] overflow-y-auto custom-scrollbar rounded-lg border border-zinc-800 bg-[#121215] shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="sticky top-0 h-10 px-4 flex items-center justify-between border-b border-zinc-800/80 bg-[#121215]/95 backdrop-blur z-10">
          <h2 className="text-xs font-semibold tracking-widest text-zinc-200 uppercase">
            ⌨ Keyboard Map — StickyTask 2030
          </h2>
          <button
            type="button"
            onClick={dismiss}
            className="text-[10px] font-mono text-zinc-500 hover:text-zinc-200 transition-colors"
            aria-label="Close shortcuts help"
          >
            Esc ✕
          </button>
        </div>

        {/* 2-column grid of grouped shortcuts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 p-5">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="text-[10px] font-semibold tracking-widest text-cyan-400/80 uppercase mb-2.5">
                {group.title}
              </h3>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between gap-3 px-2 py-1.5 rounded bg-zinc-900/50 border border-zinc-800/60"
                  >
                    <span className="text-xs text-zinc-300">{item.label}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {item.keys.map((key, i) => (
                        <React.Fragment key={`${item.label}-${key}`}>
                          {i > 0 && <span className="text-zinc-600 text-[10px]">+</span>}
                          <KeyBadge>{key}</KeyBadge>
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <p className="md:col-span-2 text-[11px] text-zinc-500 leading-relaxed border-t border-zinc-800/60 pt-3">
            💡 Guardrail: single-key shortcuts (<KeyBadge>j</KeyBadge>
            <KeyBadge>k</KeyBadge>
            <KeyBadge>x</KeyBadge>
            <KeyBadge>?</KeyBadge>) are suppressed while a text input is focused — press{' '}
            <KeyBadge>Esc</KeyBadge> to release the focus trap. Modifier combos (
            <KeyBadge>Cmd</KeyBadge>) always work.
          </p>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ShortcutHelpModal);
