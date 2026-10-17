import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import SlashCommandBar from './SlashCommandBar';

const PRIORITY_CYCLE = ['P0', 'P1', 'P2', 'P3'];
const STATUS_CYCLE = ['Backlog', 'In-Progress', 'In-Review', 'Done'];

const PRIORITY_STYLES = {
  P0: 'bg-red-500/15 text-red-400 border-red-500/30',
  P1: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  P2: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  P3: 'bg-zinc-800 text-zinc-400 border-zinc-700',
};

const STATUS_STYLES = {
  Backlog: 'bg-zinc-800/80 text-zinc-400 border-zinc-700',
  'In-Progress': 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  'In-Review': 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  Done: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};

const AGENT_BADGE = {
  idle: { label: '◇ Agent Idle', cls: 'text-zinc-500 bg-zinc-900 border-zinc-800' },
  running: { label: '⚡ Agent Running', cls: 'text-purple-300 bg-purple-500/10 border-purple-500/30 animate-pulse' },
  'diff-ready': { label: '✨ Diff Ready', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_10px_-3px_rgba(52,211,153,0.6)]' },
  completed: { label: '✓ AI Merged', cls: 'text-zinc-400 bg-zinc-900 border-zinc-800' },
};

const CRITERIA_STYLES = {
  Pending: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  Passed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Failed: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const INDENT_PAD = ['pl-2', 'pl-8', 'pl-14'];

function SectionLabel({ index, title }) {
  return (
    <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
      {String(index).padStart(2, '0')} // {title}
    </div>
  );
}

/** Auto-resizing textarea that grows with content (used for objective + checklist labels). */
function useAutoResize(initial) {
  const ref = useRef(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useEffect(() => {
    resize();
  }, [initial, resize]);
  return [ref, resize];
}

// ---- Checklist row ---------------------------------------------------------

function ChecklistRow({ task, item, focusRequest, onFocusConsumed }) {
  const { toggleChecklistItem, updateTaskMetadata, indentChecklistItem, insertChecklistItemAfter, deleteChecklistItem } = useWorkspace();
  const inputRef = useRef(null);
  const [draft, setDraft] = useState(item.label);
  const [ref, resize] = useAutoResize(draft);

  // Keep local draft in sync when the label mutates externally (e.g. AI decompose),
  // but never clobber text the user is actively typing in this row.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(item.label);
  }, [item.label]);

  useEffect(() => {
    if (focusRequest && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      onFocusConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== item.label) {
      updateTaskMetadata(task.id, {
        checklists: task.checklists.map((c) => (c.id === item.id ? { ...c, label: trimmed } : c)),
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
      insertChecklistItemAfter(task.id, item.id, '', item.indent);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      indentChecklistItem(task.id, item.id, e.shiftKey ? 'out' : 'in');
    } else if (e.key === 'Backspace' && draft === '' && item.label === '') {
      e.preventDefault();
      deleteChecklistItem(task.id, item.id);
    } else if (e.key === 'Escape') {
      e.stopPropagation(); // don't bounce out of doc view mid-edit
      setDraft(item.label);
      inputRef.current?.blur();
    }
  };

  return (
    <div
      className={`group flex items-center gap-2 py-1 ${INDENT_PAD[item.indent] || 'pl-2'} rounded hover:bg-zinc-900/40 transition-colors`}
    >
      <button
        type="button"
        aria-label="Toggle checklist item"
        onClick={() => toggleChecklistItem(task.id, item.id)}
        className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center text-[10px] transition-colors ${
          item.checked
            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
            : 'border-zinc-600 hover:border-cyan-500/60 text-transparent'
        }`}
      >
        ✓
      </button>
      <textarea
        ref={(el) => {
          inputRef.current = el;
          ref.current = el;
        }}
        data-chk-id={item.id}
        rows={1}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          resize();
        }}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder="New step…"
        className={`flex-1 bg-transparent border-none outline-none resize-none overflow-hidden text-sm leading-6 py-0.5 ${
          item.checked ? 'line-through text-zinc-500' : 'text-zinc-200 focus:text-zinc-50'
        } placeholder:text-zinc-600`}
      />
      {item.agentGenerated && (
        <span className="shrink-0 text-[10px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
          ✦ AI
        </span>
      )}
      <button
        type="button"
        title="Delete step"
        onClick={() => deleteChecklistItem(task.id, item.id)}
        className="shrink-0 opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 text-xs px-1 transition-opacity"
      >
        ✕
      </button>
    </div>
  );
}

// ---- Main Doc Canvas -------------------------------------------------------

function TaskDocCanvas() {
  const {
    tasks,
    activeTaskId,
    setCanvasViewMode,
    updateTaskTitle,
    updateTaskMetadata,
    updateTaskObjective,
    toggleChecklistItem,
    addChecklistItem,
    addAcceptanceRow,
    cycleAcceptanceStatus,
    decomposeTaskWithAI,
    triggerKeyFeedback,
    cycleAssignee,
  } = useWorkspace();

  const task = tasks.find((t) => t.id === activeTaskId) || tasks[0];

  const titleRef = useRef(null);
  const [titleDraft, setTitleDraft] = useState(task ? task.title : '');
  useEffect(() => {
    if (task) setTitleDraft(task.title);
  }, [task && task.id, task && task.title]);

  const [newStepLabel, setNewStepLabel] = useState('');
  const [newCriterion, setNewCriterion] = useState({ checkpoint: '', threshold: '' });
  const [focusItemId, setFocusItemId] = useState(null);

  const [objRef, objResize] = useAutoResize(task ? task.objective : '');

  const [copied, setCopied] = useState(false);

  const handleBack = useCallback(() => {
    setCanvasViewMode('stream');
    triggerKeyFeedback('Esc', 'Return to Stream');
  }, [setCanvasViewMode, triggerKeyFeedback]);

  const handleDecompose = useCallback(() => {
    if (!task) return;
    decomposeTaskWithAI(task.id);
  }, [task, decomposeTaskWithAI]);

  const commitTitle = () => {
    if (task && titleDraft.trim()) updateTaskTitle(task.id, titleDraft);
  };

  const cyclePriority = () => {
    const next = PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(task.priority) + 1) % PRIORITY_CYCLE.length];
    updateTaskMetadata(task.id, { priority: next });
  };

  const cycleStatus = () => {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(task.status) + 1) % STATUS_CYCLE.length];
    updateTaskMetadata(task.id, { status: next });
  };

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(task.codeSnippet.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable in some contexts — non-fatal */
    }
  };

  if (!task) {
    return (
      <div className="p-8 text-sm text-zinc-500 font-mono">No active task — press Esc to return to Stream.</div>
    );
  }

  const agentBadge = AGENT_BADGE[task.agentStatus] || AGENT_BADGE.idle;
  const { completed, total } = task.subtaskCount;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* A. Sticky spec navigation & action bar */}
      <div className="h-10 shrink-0 border-b border-zinc-800/80 px-6 flex items-center justify-between bg-zinc-950/90 sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="text-xs font-mono text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 transition-colors"
          >
            ← Back to Stream <kbd className="text-[10px] text-zinc-600">[Esc]</kbd>
          </button>
          <span className="text-zinc-700">/</span>
          <span className="font-mono text-xs text-cyan-400">#{task.id}</span>
          <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800/80 hidden md:inline-flex items-center gap-1">
            ⎇ {task.branch}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDecompose}
            className="text-[11px] font-mono px-2.5 py-1 rounded border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:shadow-[0_0_12px_-4px_rgba(168,85,247,0.7)] transition-all"
          >
            ✨ AI Decompose Sub-Tasks
          </button>
          <button
            type="button"
            onClick={() => setCanvasViewMode('diff')}
            className="text-[11px] font-mono px-2.5 py-1 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-all"
          >
            ⚡ Open AI Diff View <span className="text-cyan-500/70">[d]</span>
          </button>
        </div>
      </div>

      {/* B. Document body */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto py-8 px-6 space-y-8 pb-2">
          {/* 1. Editable H1 + metadata pill bar */}
          <header>
            <input
              ref={titleRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setTitleDraft(task.title);
                  e.currentTarget.blur();
                }
              }}
              className="text-2xl font-semibold tracking-tight text-zinc-100 bg-transparent border-b border-transparent focus:border-cyan-500/50 focus:outline-none w-full pb-1"
              placeholder="Task title…"
            />
            <div className="flex flex-wrap items-center gap-2 pt-2 font-mono text-xs">
              <button
                type="button"
                onClick={cyclePriority}
                title="Click to cycle priority"
                className={`rounded px-2 py-0.5 border transition-colors ${PRIORITY_STYLES[task.priority]}`}
              >
                {task.priority}
              </button>
              <button
                type="button"
                onClick={cycleStatus}
                title="Click to cycle status"
                className={`rounded px-2 py-0.5 border transition-colors ${STATUS_STYLES[task.status]}`}
              >
                ● {task.status}
              </button>
              <button
                type="button"
                onClick={() => cycleAssignee(task.id)}
                title="Click to reassign"
                className="rounded px-2 py-0.5 border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-cyan-500/40 transition-colors flex items-center gap-1.5"
              >
                <span className="w-4 h-4 rounded-full bg-gradient-to-br from-cyan-500/60 to-purple-500/60 text-[9px] flex items-center justify-center text-white font-semibold">
                  {task.assignee[0]}
                </span>
                @{task.assignee}
              </button>
              <span className={`rounded px-2 py-0.5 border ${agentBadge.cls}`}>{agentBadge.label}</span>
              <span className="text-zinc-600 ml-auto">{task.updatedAt}</span>
            </div>
          </header>

          {/* 2. Objective & Context */}
          <section className="space-y-2">
            <SectionLabel index={1} title="Objective & Context" />
            <textarea
              ref={objRef}
              value={task.objective}
              onChange={(e) => updateTaskObjective(task.id, e.target.value)}
              rows={4}
              spellCheck={false}
              className="w-full bg-zinc-900/40 border border-zinc-800/80 focus:border-cyan-500/50 rounded-md p-3.5 text-sm text-zinc-200 leading-relaxed focus:outline-none resize-none overflow-hidden"
              placeholder="Describe the problem statement, repro steps and goal…"
            />
          </section>

          {/* 3. Execution Checklist */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <SectionLabel index={2} title="Execution Checklist" />
              <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-500">
                <div className="w-24 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span>
                  {completed}/{total} Complete
                </span>
              </div>
            </div>
            <div className="border border-zinc-800/80 rounded-md p-1.5 bg-zinc-950/40">
              {task.checklists.length === 0 && (
                <p className="text-xs text-zinc-600 font-mono px-2 py-2">
                  Empty checklist — press <span className="text-cyan-400">/checklist</span> below or{" "}
                  <button type="button" onClick={handleDecompose} className="text-purple-400 hover:underline">
                    ✨ AI Decompose
                  </button>
                  .
                </p>
              )}
              {task.checklists.map((item) => (
                <ChecklistRow
                  key={item.id}
                  task={task}
                  item={item}
                  focusRequest={focusItemId === item.id}
                  onFocusConsumed={() => setFocusItemId(null)}
                />
              ))}
              <form
                className="flex items-center gap-2 pl-2 pr-1 py-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const id = addChecklistItem(task.id, newStepLabel);
                  setNewStepLabel('');
                  if (id) setFocusItemId(id);
                }}
              >
                <span className="text-zinc-700 text-xs select-none">+</span>
                <input
                  value={newStepLabel}
                  onChange={(e) => setNewStepLabel(e.target.value)}
                  placeholder="Add checklist step…"
                  className="flex-1 bg-transparent border border-transparent focus:border-cyan-500/30 rounded px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none"
                />
              </form>
            </div>
          </section>

          {/* 4. Acceptance Criteria table */}
          <section className="space-y-2">
            <SectionLabel index={3} title="Acceptance Criteria & Thresholds" />
            <div className="w-full border border-zinc-800 rounded-md overflow-hidden text-xs">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-zinc-900/60 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    <th className="px-3 py-2 font-medium">Checkpoint</th>
                    <th className="px-3 py-2 font-medium w-48">Target Threshold</th>
                    <th className="px-3 py-2 font-medium w-32 text-right">Verification Status</th>
                  </tr>
                </thead>
                <tbody>
                  {task.acceptanceCriteria.map((row) => (
                    <tr key={row.id} className="border-t border-zinc-800/60 hover:bg-zinc-900/30 transition-colors">
                      <td className="px-3 py-2 text-zinc-200">{row.checkpoint}</td>
                      <td className="px-3 py-2 font-mono text-zinc-400">{row.threshold}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          title="Click to cycle verification status"
                          onClick={() => cycleAcceptanceStatus(task.id, row.id)}
                          className={`px-2 py-0.5 rounded border font-mono text-[10px] transition-colors ${CRITERIA_STYLES[row.status]}`}
                        >
                          {row.status === 'Passed' ? '✓ Passed' : row.status === 'Failed' ? '✗ Failed' : '◌ Pending'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {task.acceptanceCriteria.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-zinc-600 font-mono">
                        No criteria yet — use <span className="text-cyan-400">/criteria</span> below.
                      </td>
                    </tr>
                  )}
                  <tr className="border-t border-zinc-800/60">
                    <td colSpan={3} className="px-2 py-1.5">
                      <form
                        className="flex items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          addAcceptanceRow(task.id, newCriterion.checkpoint, newCriterion.threshold);
                          setNewCriterion({ checkpoint: '', threshold: '' });
                        }}
                      >
                        <span className="text-zinc-700 text-xs select-none">+</span>
                        <input
                          value={newCriterion.checkpoint}
                          onChange={(e) => setNewCriterion((c) => ({ ...c, checkpoint: e.target.value }))}
                          placeholder="Add criterion…"
                          className="flex-1 bg-transparent border border-transparent focus:border-cyan-500/30 rounded px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none"
                        />
                        <input
                          value={newCriterion.threshold}
                          onChange={(e) => setNewCriterion((c) => ({ ...c, threshold: e.target.value }))}
                          placeholder="threshold (e.g. < 200ms)"
                          className="w-40 bg-transparent border border-transparent focus:border-cyan-500/30 rounded px-2 py-1 text-[11px] font-mono text-zinc-400 placeholder:text-zinc-700 focus:outline-none hidden md:block"
                        />
                      </form>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 5. Technical context / code snippet (if present) */}
          {task.codeSnippet && (
            <section className="space-y-2">
              <SectionLabel index={4} title="Technical Context" />
              <div className="bg-[#0d0e12] border border-zinc-800 rounded-md overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800/80 bg-zinc-900/50">
                  <span className="font-mono text-[10px] text-zinc-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-500/60" />
                    {task.codeSnippet.filename}
                    <span className="text-zinc-600">· {task.codeSnippet.language}</span>
                  </span>
                  <button
                    type="button"
                    onClick={copySnippet}
                    className="font-mono text-[10px] text-zinc-500 hover:text-cyan-300 transition-colors"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="p-3 font-mono text-xs text-cyan-300 leading-relaxed overflow-x-auto whitespace-pre-wrap">
                  {task.codeSnippet.code}
                </pre>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* 3. Slash command prompt bar */}
      <SlashCommandBar task={task} onChecklistFocus={setFocusItemId} />
    </div>
  );
}

export default React.memo(TaskDocCanvas);
