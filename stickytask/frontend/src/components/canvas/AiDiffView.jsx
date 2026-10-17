import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

/**
 * Step 6 — The "Do-State" AI Diff & Merge Engine.
 *
 * Renders whenever canvasViewMode === 'diff'. Shows the active task's
 * aiDeliverable as a line-by-line Before vs. After diff with per-hunk
 * accept/reject staging, a risk-tier merge gate, confidence meter and the
 * agent tool-call transcript.
 */

const RISK_TONE = {
  'Green (Autonomous)': {
    pill: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    label: '🟢 Green — Autonomous Merge Allowed',
  },
  'Amber (Soft Review)': {
    pill: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    label: '🟡 Amber — Soft Human Review',
  },
  'Red (Strict Gate)': {
    pill: 'text-red-400 bg-red-500/10 border-red-500/30',
    label: '🔴 Red — Strict Approval Gate',
  },
};

const ARTIFACT_ICON = {
  'code-patch': '🧩',
  'outbound-email': '✉️',
  'sql-migration': '🗄️',
  'security-policy': '🛡️',
  'market-matrix': '📊',
};

// --- Lightweight unified-diff line aligner --------------------------------
// Produces rows of { before, after, kind } where kind is
// 'same' | 'changed' | 'removed' | 'added'. Uses an LCS on exact lines to
// pair unchanged context and mark the true +/- hunks.
export function alignDiff(beforeLines, afterLines) {
  const b = beforeLines || [];
  const a = afterLines || [];
  const m = b.length;
  const n = a.length;
  // Classic LCS table (artifacts are tiny — ≤ dozens of lines).
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = b[i] === a[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (b[i] === a[j]) {
      rows.push({ before: b[i], after: a[j], kind: 'same' });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ before: b[i], after: null, kind: 'removed' });
      i += 1;
    } else {
      rows.push({ before: null, after: a[j], kind: 'added' });
      j += 1;
    }
  }
  while (i < m) {
    rows.push({ before: b[i], after: null, kind: 'removed' });
    i += 1;
  }
  while (j < n) {
    rows.push({ before: null, after: a[j], kind: 'added' });
    j += 1;
  }
  return rows;
}

// Group consecutive non-'same' rows into hunks so each hunk can be
// accepted/rejected as a unit. Returns [{ id, startIdx, endIdx, kinds }].
export function buildHunks(rows) {
  const hunks = [];
  let current = null;
  rows.forEach((row, idx) => {
    if (row.kind !== 'same') {
      if (!current) current = { id: `hunk-${idx}`, startIdx: idx, endIdx: idx };
      else current.endIdx = idx;
    } else if (current) {
      hunks.push(current);
      current = null;
    }
  });
  if (current) hunks.push(current);
  return hunks;
}

function ConfidenceMeter({ score }) {
  const tone = score >= 95 ? 'from-emerald-500 to-emerald-400' : score >= 88 ? 'from-cyan-500 to-cyan-400' : 'from-amber-500 to-amber-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${tone}`} style={{ width: `${score}%` }} />
      </div>
      <span className="font-mono text-[10px] text-zinc-300">{score}% conf</span>
    </div>
  );
}

function AiDiffView() {
  const {
    tasks,
    activeTaskId,
    setCanvasViewMode,
    setActivePane,
    mergeAiDeliverable,
    rejectAiDeliverable,
    requestChangesOnDeliverable,
    regenerateDeliverable,
    triggerAgentOnTask,
    addSystemLog,
    systemLogs,
    terminalOpen,
    toggleTerminal,
  } = useWorkspace();

  const task = tasks.find((t) => t.id === activeTaskId) || tasks[0];

  // Per-hunk staging decisions: { [hunkId]: 'accepted' | 'rejected' }
  const [staged, setStaged] = useState({});
  const lastTaskIdRef = useRef(task?.id);
  useEffect(() => {
    // Reset staging when switching to a different task's deliverable.
    if (lastTaskIdRef.current !== task?.id) {
      lastTaskIdRef.current = task?.id;
      setStaged({});
    }
  }, [task?.id]);

  const rows = useMemo(
    () => (task?.aiDeliverable ? alignDiff(task.aiDeliverable.beforeContent, task.aiDeliverable.afterContent) : []),
    [task]
  );
  const hunks = useMemo(() => buildHunks(rows), [rows]);

  // Live audit tail — last 5 AGENT logs feed the mini console strip.
  const agentTail = useMemo(
    () => systemLogs.filter((l) => l.source === 'AGENT').slice(-5),
    [systemLogs]
  );

  if (!task || !task.aiDeliverable) {
    return (
      <div className="p-6 text-xs font-mono text-zinc-500">
        No AI deliverable on record{task ? ` for #${task.id}` : ''}. Press [r] in Stream to dispatch the agent.
      </div>
    );
  }

  const d = task.aiDeliverable;
  const risk = RISK_TONE[d.riskTier] || RISK_TONE['Amber (Soft Review)'];
  const merged = Boolean(d.mergedAt);
  const running = task.agentStatus === 'running';
  const acceptedCount = hunks.filter((h) => staged[h.id] === 'accepted').length;
  const rejectedCount = hunks.filter((h) => staged[h.id] === 'rejected').length;
  const allDecided = hunks.length > 0 && acceptedCount + rejectedCount === hunks.length;
  const strictGate = d.riskTier === 'Red (Strict Gate)';

  const stageHunk = (hunkId, decision) => {
    setStaged((s) => ({ ...s, [hunkId]: s[hunkId] === decision ? undefined : decision }));
  };

  const acceptAll = () => {
    const next = {};
    hunks.forEach((h) => { next[h.id] = 'accepted'; });
    setStaged(next);
    addSystemLog('USR', `Accepted all ${hunks.length} hunks on #${task.id}`);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* A. Sticky Deliverable Header */}
      <div className="shrink-0 border-b border-zinc-800/80 bg-zinc-950/90 px-5 py-3 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => { setCanvasViewMode('stream'); addSystemLog('USR', `Diff view: returned to Stream`); }}
              className="text-xs font-mono text-zinc-400 hover:text-zinc-100 flex items-center gap-1.5 shrink-0"
            >
              ← Back to Stream <kbd className="text-[10px] bg-zinc-800/80 border border-zinc-700/60 rounded px-1 py-0.5">Esc</kbd>
            </button>
            <span className="text-zinc-600">/</span>
            <span className="font-mono text-xs text-zinc-200">#{task.id}</span>
            <span className="text-base leading-none">{ARTIFACT_ICON[d.artifactType] || '📦'}</span>
            <span className="text-xs font-semibold text-zinc-100 truncate max-w-[36ch]" title={d.summary}>
              {d.summary}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ConfidenceMeter score={d.confidenceScore} />
            <span className={`font-mono text-[10px] px-2 py-1 rounded border ${risk.pill}`}>{risk.label}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500">
            <span className="text-cyan-300">⎇ {task.branch}</span>
            <span>→</span>
            <span className="text-zinc-300 truncate max-w-[42ch]" title={d.targetFileOrChannel}>{d.targetFileOrChannel}</span>
            <span className="text-zinc-600">·</span>
            <span>{d.artifactType}</span>
            <span className="text-zinc-600">·</span>
            <span>@{task.assignee}</span>
            {merged && (
              <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5">
                ✓ MERGED · {d.mergedAt}
              </span>
            )}
            {running && (
              <span className="text-purple-300 bg-purple-500/10 border border-purple-500/30 rounded px-1.5 py-0.5 animate-pulse">
                ⚡ RUNNER ACTIVE…
              </span>
            )}
          </div>
          {!merged && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => { regenerateDeliverable(task.id); setStaged({}); }}
                className="text-[11px] font-mono px-2 py-1 rounded border border-zinc-700/80 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100 transition-all"
                title="Re-run the agent pass and produce a rev-2 artifact"
              >
                ↻ Regenerate
              </button>
              <button
                type="button"
                onClick={() => requestChangesOnDeliverable(task.id, 'operator requested revisions from diff view')}
                className="text-[11px] font-mono px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all"
              >
                ✎ Request Changes
              </button>
            </div>
          )}
        </div>
      </div>

      {/* B/C. Unified Diff Body */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar font-mono text-[11px] leading-relaxed">
        {rows.map((row, idx) => {
          // Find which hunk this changed row belongs to (if any).
          const hunk = row.kind !== 'same' ? hunks.find((h) => idx >= h.startIdx && idx <= h.endIdx) : null;
          const decision = hunk ? staged[hunk.id] : undefined;
          const isFirstOfHunk = hunk && idx === hunk.startIdx;
          return (
            <React.Fragment key={idx}>
              {isFirstOfHunk && (
                <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900/70 border-y border-zinc-800/60 sticky top-0 z-[1]">
                  <span className="text-[10px] tracking-wider text-zinc-500 uppercase">
                    Hunk {hunks.indexOf(hunk) + 1}/{hunks.length}
                  </span>
                  <button
                    type="button"
                    disabled={merged}
                    onClick={() => stageHunk(hunk.id, 'accepted')}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-all ${
                      decision === 'accepted'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'border-zinc-700 text-zinc-500 hover:text-emerald-300 hover:border-emerald-500/40'
                    }`}
                  >
                    ✓ Accept
                  </button>
                  <button
                    type="button"
                    disabled={merged}
                    onClick={() => stageHunk(hunk.id, 'rejected')}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-all ${
                      decision === 'rejected'
                        ? 'bg-red-500/20 border-red-500/50 text-red-300'
                        : 'border-zinc-700 text-zinc-500 hover:text-red-300 hover:border-red-500/40'
                    }`}
                  >
                    ✗ Reject
                  </button>
                  {decision && (
                    <span className={`text-[10px] ${decision === 'accepted' ? 'text-emerald-400' : 'text-red-400'}`}>
                      staged: {decision}
                    </span>
                  )}
                </div>
              )}
              <div
                className={
                  row.kind === 'same'
                    ? 'px-3 text-zinc-500 bg-transparent'
                    : row.kind === 'added'
                      ? `px-3 text-emerald-300 bg-emerald-500/[0.07] ${decision === 'rejected' ? 'opacity-40 line-through decoration-red-500/60' : ''}`
                      : `px-3 text-red-400 bg-red-500/[0.07] ${decision === 'accepted' ? 'opacity-40 line-through decoration-emerald-500/60' : ''}`
                }
              >
                <span className="select-none inline-block w-4 text-zinc-600">
                  {row.kind === 'added' ? '+' : row.kind === 'removed' ? '-' : ' '}
                </span>
                <span className="whitespace-pre-wrap break-all">
                  {(row.kind === 'removed' ? row.before : row.after ?? row.before) || '\u00A0'}
                </span>
              </div>
            </React.Fragment>
          );
        })}

        {/* C. Tool Call Trace */}
        <div className="mx-3 my-3 rounded-md border border-zinc-800 bg-[#0d0e12] overflow-hidden">
          <div className="px-3 py-1.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50">
            <span className="text-[10px] tracking-wider text-zinc-500 uppercase">Agent Tool-Call Trace</span>
            <span className="font-mono text-[10px] text-purple-300">{d.toolCalls.length} calls · {task.agentSummary}</span>
          </div>
          <ol className="p-3 space-y-1">
            {d.toolCalls.map((call, idx) => (
              <li key={call} className="flex items-center gap-2 text-[11px]">
                <span className="text-zinc-600 w-5 text-right shrink-0">{idx + 1}.</span>
                <span className="text-emerald-400 shrink-0">✓</span>
                <span className="text-cyan-300/90 break-all">{call}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* D. Mini live agent console tail */}
        <div className="mx-3 mb-3 rounded-md border border-zinc-800/80 bg-zinc-900/40 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] tracking-wider text-zinc-500 uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Agent Tail
            </span>
            <button
              type="button"
              onClick={() => { setActivePane('terminal'); if (!terminalOpen) toggleTerminal(); }}
              className="text-[10px] font-mono text-zinc-500 hover:text-cyan-300 transition-colors"
            >
              open full terminal →
            </button>
          </div>
          {agentTail.length === 0 ? (
            <p className="text-[11px] text-zinc-600 italic">no agent events yet — press [r] to dispatch</p>
          ) : (
            agentTail.map((log) => (
              <div key={log.id} className="flex gap-2 text-[11px] leading-relaxed">
                <span className="text-zinc-600 shrink-0">{log.timestamp}</span>
                <span className="text-purple-400 shrink-0 font-semibold">[AGENT]</span>
                <span className="text-zinc-300 break-words">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* E. Merge Decision Bar */}
      <div className="shrink-0 h-12 border-t border-zinc-800/80 bg-zinc-950/95 px-4 flex items-center justify-between gap-3">
        <div className="font-mono text-[11px] text-zinc-500 flex items-center gap-2 min-w-0">
          {merged ? (
            <span className="text-emerald-400">✓ Deliverable merged & archived — Esc returns to Stream</span>
          ) : running ? (
            <span className="text-purple-300 animate-pulse">⚡ Runner active — fresh diff will land here automatically…</span>
          ) : (
            <>
              <span className="text-emerald-400">{acceptedCount} accepted</span>
              <span className="text-zinc-700">•</span>
              <span className="text-red-400">{rejectedCount} rejected</span>
              <span className="text-zinc-700">•</span>
              <span className="truncate">{hunks.length} hunks staged {allDecided ? '· ready to merge' : '· decide every hunk first'}</span>
              {hunks.length > 0 && !allDecided && (
                <button type="button" onClick={acceptAll} className="text-cyan-400 hover:text-cyan-300 shrink-0">
                  [Accept All]
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!merged && (
            <>
              <button
                type="button"
                onClick={() => { rejectAiDeliverable(task.id); setStaged({}); }}
                className="text-xs font-mono px-3 py-1.5 rounded border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-all"
              >
                ✗ Reject Patch
              </button>
              <button
                type="button"
                disabled={!allDecided}
                onClick={() => mergeAiDeliverable(task.id)}
                className={`text-xs font-mono px-3 py-1.5 rounded border transition-all ${
                  strictGate
                    ? 'border-red-500/50 bg-red-500/15 text-red-300 hover:bg-red-500/25'
                    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                } ${!allDecided ? 'opacity-40 cursor-not-allowed' : ''}`}
                title={strictGate ? 'Red-tier artifact: merge requires admin approval token' : 'Merge the staged AI deliverable'}
              >
                {strictGate ? '🔒 Merge (Admin Gate)' : '⌥⇧ Merge Deliverable'}
              </button>
            </>
          )}
          {task.agentStatus === 'idle' && !merged && (
            <button
              type="button"
              onClick={() => triggerAgentOnTask(task.id)}
              className="text-xs font-mono px-3 py-1.5 rounded border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-all"
            >
              ⚡ Re-dispatch Agent [r]
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(AiDiffView);
