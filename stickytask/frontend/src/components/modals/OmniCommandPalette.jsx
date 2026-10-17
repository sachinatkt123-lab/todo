import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

/**
 * Lightweight subsequence fuzzy matcher ("p0urg" ~ "Set Priority -> P0 (Urgent)").
 * Returns a score (higher = better) or -1 when the query does not match.
 */
export function fuzzyScore(query, text) {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  // Direct substring match ranks highest.
  const idx = t.indexOf(q);
  if (idx !== -1) return 1000 - idx;
  // Subsequence walk.
  let ti = 0;
  let score = 0;
  let streak = 0;
  for (let qi = 0; qi < q.length; qi += 1) {
    const ch = q[qi];
    if (ch === ' ') continue;
    const found = t.indexOf(ch, ti);
    if (found === -1) return -1;
    score += found === ti ? 10 + streak * 5 : 1;
    streak = found === ti ? streak + 1 : 0;
    ti = found + 1;
  }
  return score;
}

// Small inline SVGs (lucide-react is not installed in this project).
const IconBolt = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
  </svg>
);
const IconSearch = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

function OmniCommandPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    activeTaskId,
    tasks,
    triggerAgentOnTask,
    decomposeTaskWithAI,
    toggleFocusedTaskDone,
    updateTaskPriority,
    cycleFocusedTaskStatus,
    cycleAssignee,
    setIsCreatingTask,
    setCanvasViewMode,
    setStreamFilter,
    toggleSidebar,
    toggleTerminal,
    addSystemLog,
    triggerKeyFeedback,
    runComposerPrompt,
  } = useWorkspace();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const close = useCallback(() => setCommandPaletteOpen(false), [setCommandPaletteOpen]);

  // Auto-focus + reset state each time the palette opens.
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      const raf = requestAnimationFrame(() => {
        if (inputRef.current) inputRef.current.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
    return undefined;
  }, [commandPaletteOpen]);

  // ---- Context-aware command registry --------------------------------------
  const registry = useMemo(() => {
    const activeTask = tasks.find((t) => t.id === activeTaskId) || null;
    const assigneePreview = ['Sachin', 'Adithya', 'Hareesha', 'Rakshith']
      .map((a) => `@${a}`)
      .join(' / ');
    return [
      {
        group: 'AI AGENT & COMPOSER ACTIONS',
        items: [
          {
            id: 'agent-run',
            label: `⚡ Run Autonomous Agent on #${activeTaskId}`,
            hint: 'Dispatch the runner and stage an AI diff',
            shortcut: 'R',
            run: () => triggerAgentOnTask(activeTaskId),
          },
          {
            id: 'agent-decompose',
            label: `✨ Decompose #${activeTaskId} into AI Sub-Tasks`,
            hint: 'Generate executable checklist steps',
            shortcut: null,
            run: () => {
              decomposeTaskWithAI(activeTaskId);
              setCanvasViewMode('doc');
            },
          },
          {
            id: 'agent-diff',
            label: `🔍 Inspect AI Diff & Merge View for #${activeTaskId}`,
            hint: 'Review staged agent patches',
            shortcut: 'D',
            run: () => setCanvasViewMode('diff'),
          },
        ],
      },
      {
        group: `ACTIVE TASK MUTATIONS (#${activeTaskId})`,
        items: [
          {
            id: 'toggle-done',
            label: `✓ Toggle Done / Complete on #${activeTaskId}`,
            hint: activeTask ? `Current status: ${activeTask.status}` : null,
            shortcut: 'X',
            run: () => toggleFocusedTaskDone(),
          },
          {
            id: 'priority-p0',
            label: '🔥 Set Priority -> P0 (Urgent)',
            hint: `on #${activeTaskId}`,
            shortcut: '1',
            run: () => updateTaskPriority(activeTaskId, 'P0'),
          },
          {
            id: 'priority-p1',
            label: '⚡ Set Priority -> P1 (High)',
            hint: `on #${activeTaskId}`,
            shortcut: '2',
            run: () => updateTaskPriority(activeTaskId, 'P1'),
          },
          {
            id: 'cycle-status',
            label: '🔄 Cycle Task Status',
            hint: `Backlog → In-Progress → In-Review → Done`,
            shortcut: 'S',
            run: () => cycleFocusedTaskStatus(),
          },
          {
            id: 'reassign',
            label: `👤 Reassign #${activeTaskId}`,
            hint: assigneePreview,
            shortcut: null,
            run: () => cycleAssignee(activeTaskId),
          },
        ],
      },
      {
        group: 'WORKSPACE & VIEW NAVIGATION',
        items: [
          {
            id: 'new-task',
            label: '➕ Create New Task',
            hint: 'Opens the inline stream composer',
            shortcut: 'C',
            run: () => {
              setCanvasViewMode('stream');
              setStreamFilter('all');
              setIsCreatingTask(true);
            },
          },
          {
            id: 'open-doc',
            label: `📄 Open Spec Document for #${activeTaskId}`,
            hint: 'Jump into the doc canvas',
            shortcut: 'Enter',
            run: () => setCanvasViewMode('doc'),
          },
          {
            id: 'view-stream',
            label: '▤ Switch to Linear Stream View',
            hint: null,
            shortcut: null,
            run: () => setCanvasViewMode('stream'),
          },
          {
            id: 'toggle-sidebar',
            label: '◧ Toggle Left Workspace Sidebar',
            hint: null,
            shortcut: 'Cmd+B',
            run: () => toggleSidebar(),
          },
          {
            id: 'toggle-terminal',
            label: '◨ Toggle Right Agent Terminal',
            hint: null,
            shortcut: 'Cmd+J',
            run: () => toggleTerminal(),
          },
        ],
      },
    ];
  }, [
    activeTaskId,
    tasks,
    triggerAgentOnTask,
    decomposeTaskWithAI,
    toggleFocusedTaskDone,
    updateTaskPriority,
    cycleFocusedTaskStatus,
    cycleAssignee,
    setIsCreatingTask,
    setCanvasViewMode,
    setStreamFilter,
    toggleSidebar,
    toggleTerminal,
  ]);

  // ---- Live fuzzy filtering -------------------------------------------------
  const filteredGroups = useMemo(() => {
    const q = query.trim();
    if (!q) return registry;
    return registry
      .map((group) => ({
        ...group,
        items: group.items
          .map((item) => ({ item, score: fuzzyScore(q, `${item.label} ${item.hint || ''}`) }))
          .filter((entry) => entry.score >= 0)
          .sort((a, b) => b.score - a.score)
          .map((entry) => entry.item),
      }))
      .filter((group) => group.items.length > 0);
  }, [registry, query]);

  const flatItems = useMemo(() => {
    const out = [];
    filteredGroups.forEach((group) => group.items.forEach((item) => out.push({ ...item, group: group.group })));
    return out;
  }, [filteredGroups]);

  // Natural-language fallback row shown when nothing static matches.
  const showComposerFallback = query.trim().length > 0 && flatItems.length === 0;
  const allOptions = showComposerFallback
    ? [...flatItems, { id: '__composer__', label: `✨ Ask AI Agent: "${query.trim()}" on #${activeTaskId}`, hint: 'Custom prompt → ✦ AI checklist step + agent dispatch', shortcut: null, group: 'AI COMPOSER', run: () => runComposerPrompt(activeTaskId, query.trim()) }]
    : flatItems;

  // Keep selection within bounds as the query changes.
  useEffect(() => {
    setSelectedIndex((idx) => Math.min(idx, Math.max(allOptions.length - 1, 0)));
  }, [allOptions.length]);

  // Scroll selected option into view.
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const rows = container.querySelectorAll('[data-cmd-row]');
    const row = rows[selectedIndex];
    if (row && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, allOptions.length]);

  const executeOption = useCallback(
    (option) => {
      if (!option) return;
      try {
        option.run();
      } finally {
        addSystemLog('HOTKEY', `Cmd+K Executed: ${option.label.replace(/^[^\w]*\s/, '')}`);
        triggerKeyFeedback('Cmd+K', option.label.split(' ').slice(0, 3).join(' '));
        close();
      }
    },
    [addSystemLog, triggerKeyFeedback, close]
  );

  const handleInputKeyDown = useCallback(
    (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((idx) => (allOptions.length === 0 ? 0 : (idx + 1) % allOptions.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((idx) => (allOptions.length === 0 ? 0 : (idx - 1 + allOptions.length) % allOptions.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        executeOption(allOptions[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    },
    [allOptions, selectedIndex, executeOption, close]
  );

  if (!commandPaletteOpen) return null;

  let cursor = -1;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-start justify-center pt-[14vh] select-none"
      onMouseDown={close}
      data-testid="omni-palette-backdrop"
    >
      <div
        className="w-full max-w-xl bg-[#121215] border border-zinc-800 rounded-lg shadow-2xl overflow-hidden ring-1 ring-cyan-500/20"
        onMouseDown={(e) => e.stopPropagation()}
        data-testid="omni-palette"
      >
        {/* Command / AI Composer input */}
        <div className="h-12 px-4 border-b border-zinc-800 flex items-center gap-3 bg-zinc-900/50">
          <span className="text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]">
            <IconBolt />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder={`Type a command or prompt AI Composer for #${activeTaskId}...`}
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none font-mono"
            spellCheck={false}
            autoComplete="off"
            data-testid="omni-input"
          />
          <span className="font-mono text-[10px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded px-1.5 py-0.5">
            #{activeTaskId}
          </span>
          <kbd className="font-mono text-[10px] text-zinc-500 bg-zinc-800/80 border border-zinc-700 rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>

        {/* Grouped, fuzzy-filtered command list */}
        <div ref={listRef} className="max-h-[46vh] overflow-y-auto custom-scrollbar py-2">
          {allOptions.length === 0 && (
            <div className="px-4 py-6 text-center text-xs font-mono text-zinc-500">
              No matching commands — type a prompt to ask the AI Agent.
            </div>
          )}
          {filteredGroups.map((group) => (
            <div key={group.group}>
              <div className="px-4 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                {group.group}
              </div>
              {group.items.map((item) => {
                cursor += 1;
                const localIdx = cursor;
                const selected = localIdx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-cmd-row
                    onMouseEnter={() => setSelectedIndex(localIdx)}
                    onClick={() => executeOption(item)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-left transition-colors ${
                      selected ? 'bg-cyan-500/10 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800/50'
                    }`}
                  >
                    <span className="flex flex-col min-w-0">
                      <span className={`text-xs truncate ${selected ? 'text-cyan-200' : ''}`}>{item.label}</span>
                      {item.hint && (
                        <span className="text-[10px] font-mono text-zinc-500 truncate">{item.hint}</span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {item.shortcut && (
                        <kbd className="font-mono text-[10px] text-zinc-400 bg-zinc-800/90 border border-zinc-700 rounded px-1.5 py-0.5">
                          {item.shortcut}
                        </kbd>
                      )}
                      {selected && <span className="text-cyan-400"><IconSearch className="w-3.5 h-3.5" /></span>}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}

          {/* Natural-language AI prompt fallback */}
          {showComposerFallback && (
            <div>
              <div className="px-4 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-purple-400/80">
                AI COMPOSER
              </div>
              <button
                type="button"
                data-cmd-row
                onMouseEnter={() => setSelectedIndex(0)}
                onClick={() => executeOption(allOptions[0])}
                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                  selectedIndex === 0 ? 'bg-purple-500/10 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800/50'
                }`}
              >
                <span className="flex flex-col min-w-0">
                  <span className="text-xs truncate text-purple-200">
                    ✨ Ask AI Agent: "{query.trim()}" on #{activeTaskId}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 truncate">
                    Appends a ✦ AI checklist step &amp; dispatches the runner
                  </span>
                </span>
                <kbd className="font-mono text-[10px] text-zinc-400 bg-zinc-800/90 border border-zinc-700 rounded px-1.5 py-0.5 shrink-0">
                  Enter
                </kbd>
              </button>
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="h-8 border-t border-zinc-800/80 bg-zinc-950/80 px-4 flex items-center justify-between text-[10px] font-mono text-zinc-500">
          <span>↑↓ Navigate • Enter Execute • Esc Dismiss</span>
          <span>{allOptions.length} command{allOptions.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  );
}

export default React.memo(OmniCommandPalette);
