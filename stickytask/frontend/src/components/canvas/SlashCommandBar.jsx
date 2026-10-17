import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

/**
 * Inline `/` Slash Command menu (Step 4) — Cursor-style block command bar
 * docked at the bottom of TaskDocCanvas. Typing "/" opens a floating palette
 * above the input with ↑/↓ selection and Enter execution.
 */
const BLOCK_COMMANDS = [
  { cmd: '/checklist', icon: '☑', hint: 'Append an execution checklist step & focus it' },
  { cmd: '/criteria', icon: '◎', hint: 'Append an Acceptance Criteria verification row' },
  { cmd: '/decompose', icon: '✨', hint: 'AI-decompose this task into executable sub-steps' },
  { cmd: '/code', icon: '⌘', hint: 'Insert / toggle a technical code block' },
  { cmd: '/diff', icon: '⇄', hint: 'Jump straight to the AI Diff review view' },
];

function SlashCommandBar({ task, onChecklistFocus }) {
  const {
    addChecklistItem,
    insertChecklistItemAfter,
    addAcceptanceRow,
    decomposeTaskWithAI,
    upsertCodeSnippet,
    setCanvasViewMode,
    triggerKeyFeedback,
    addSystemLog,
  } = useWorkspace();

  const [value, setValue] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);

  const query = value.startsWith('/') ? value.slice(1).toLowerCase() : null;
  const matches = useMemo(
    () => (query === null ? [] : BLOCK_COMMANDS.filter((c) => c.cmd.slice(1).startsWith(query))),
    [query]
  );

  useEffect(() => {
    setMenuOpen(query !== null && matches.length > 0);
    setSelected((s) => Math.min(s, Math.max(matches.length - 1, 0)));
  }, [query, matches.length]);

  // Dismiss menu when clicking anywhere outside the bar.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [menuOpen]);

  const runCommand = useCallback(
    (cmd) => {
      setValue('');
      setMenuOpen(false);
      switch (cmd) {
        case '/checklist': {
          // Append at end (or below focused last item) and request focus.
          const last = task.checklists[task.checklists.length - 1];
          let id;
          if (last) id = insertChecklistItemAfter(task.id, last.id, '', last.indent);
          else id = addChecklistItem(task.id, 'New step', 0);
          if (id) onChecklistFocus?.(id);
          addSystemLog('USR', `Slash /checklist on #${task.id}`);
          break;
        }
        case '/criteria':
          addAcceptanceRow(task.id, 'New verification checkpoint', 'TBD');
          addSystemLog('USR', `Slash /criteria on #${task.id}`);
          break;
        case '/decompose':
          decomposeTaskWithAI(task.id);
          break;
        case '/code':
          if (task.codeSnippet) {
            upsertCodeSnippet(task.id, null); // toggle off
          } else {
            upsertCodeSnippet(task.id, {
              language: 'typescript',
              filename: `${task.branch.split('/').pop() || task.id.toLowerCase()}.ts`,
              code: `// Agent execution config for #${task.id}\nexport const runner = {\n  model: 'qwen-agent-v1',\n  maxTokens: 32_000,\n  guardrails: ['red-tier-approval'],\n};`,
            });
          }
          break;
        case '/diff':
          setCanvasViewMode('diff');
          triggerKeyFeedback('/diff', 'Inspect AI Diff');
          break;
        default:
          break;
      }
      inputRef.current?.focus();
    },
    [task, addChecklistItem, insertChecklistItemAfter, addAcceptanceRow, decomposeTaskWithAI, upsertCodeSnippet, setCanvasViewMode, triggerKeyFeedback, addSystemLog, onChecklistFocus]
  );

  const handleKeyDown = (e) => {
    if (menuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelected((s) => (s + 1) % matches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelected((s) => (s - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const target = matches[selected];
        if (target) runCommand(target.cmd);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(false);
        setValue('');
        return;
      }
    }
    if (e.key === 'Enter' && value.trim() && !value.startsWith('/')) {
      // Freeform prompt → simulated agent dispatch on the doc itself.
      e.preventDefault();
      addSystemLog('AGENT', `Prompt queued for #${task.id}: "${value.trim().slice(0, 60)}"`);
      decomposeTaskWithAI(task.id);
      setValue('');
    }
  };

  return (
    <div ref={wrapRef} className="relative shrink-0 border-t border-zinc-800/80 bg-zinc-950/90 px-6 py-3">
      {/* Floating command menu rendered directly above the input */}
      {menuOpen && (
        <div className="absolute bottom-full left-6 right-6 mb-2 w-96 max-w-full rounded-md border border-zinc-700/80 bg-[#121215] shadow-2xl shadow-black/60 overflow-hidden z-30">
          <div className="px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-zinc-600">
            Block Commands
          </div>
          {matches.map((c, i) => (
            <button
              key={c.cmd}
              type="button"
              onMouseEnter={() => setSelected(i)}
              onClick={() => runCommand(c.cmd)}
              className={`w-full flex items-center gap-3 px-3 py-1.5 text-left text-xs transition-colors ${
                i === selected ? 'bg-cyan-500/10 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-900'
              }`}
            >
              <span className="font-mono text-cyan-400 w-24">{c.cmd}</span>
              <span className="text-zinc-500 truncate">{c.hint}</span>
              {i === selected && <span className="ml-auto text-[10px] font-mono text-zinc-600">↵</span>}
            </button>
          ))}
          <div className="px-3 py-1.5 border-t border-zinc-800/80 text-[10px] font-mono text-zinc-600 flex items-center gap-3">
            <span>↑↓ select</span>
            <span>↵ run</span>
            <span>esc dismiss</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/70 px-3 focus-within:border-cyan-500/50 transition-colors">
        <span className="font-mono text-cyan-400 text-sm select-none">/</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (value.startsWith('/')) setMenuOpen(matches.length > 0);
          }}
          placeholder="Type '/' for block commands (e.g. /checklist, /criteria, /decompose, /code, /diff)…"
          className="flex-1 bg-transparent py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none font-mono"
        />
        <span className="font-mono text-[10px] text-zinc-600 hidden md:inline">↵ send · esc dismiss</span>
      </div>
    </div>
  );
}

export default React.memo(SlashCommandBar);
