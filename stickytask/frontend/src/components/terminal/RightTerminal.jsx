import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace, useAgentTelemetrySimulator } from '../../context/WorkspaceContext';

const SOURCE_TONE = {
  SYS: 'text-zinc-400',
  USR: 'text-cyan-400',
  HOTKEY: 'text-amber-400',
  AGENT: 'text-purple-400',
};

// Step 6 — tone map for the simulated live telemetry stream (distinct badge
// colors per subsystem so the console reads like a real agent runtime).
const TELEMETRY_TONE = {
  cyan: 'text-cyan-400',
  purple: 'text-purple-400',
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  zinc: 'text-zinc-500',
};

const RUNNER_TONE = {
  idle: 'text-emerald-400',
  running: 'text-purple-300',
  'diff-ready': 'text-cyan-300',
  completed: 'text-zinc-400',
};

const RUNNER_LABEL = {
  idle: 'IDLE — Awaiting Task Dispatch',
  running: 'RUNNING — Autonomous pass in flight…',
  'diff-ready': 'DIFF READY — Awaiting human merge decision',
  completed: 'COMPLETED — Deliverable merged & archived',
};

function formatClock(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function RightTerminal() {
  const {
    terminalOpen,
    activePane,
    systemLogs,
    tasks,
    activeTaskId,
    canvasViewMode,
    setActivePane,
    clearSystemLogs,
    addSystemLog,
  } = useWorkspace();

  // ---- Live telemetry simulator state -------------------------------------
  const [telemetryEvents, setTelemetryEvents] = useState([]);
  const [tokensUsed, setTokensUsed] = useState(4.2); // thousands
  const [live, setLive] = useState(true);
  const eventsCounterRef = useRef(0);

  useAgentTelemetrySimulator((evt) => {
    if (!live) return;
    eventsCounterRef.current += 1;
    const entry = {
      id: `tel-${Date.now()}-${eventsCounterRef.current}`,
      clock: formatClock(),
      tone: evt.tone,
      text: evt.text,
    };
    setTelemetryEvents((prev) => [...prev.slice(-49), entry]);
    // Token burn drifts up slowly while streaming.
    setTokensUsed((t) => Math.min(128, +(t + 0.07).toFixed(2)));
  });

  // ---- Active-run derivation (Runner State reflects real context) ---------
  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeTaskId) || tasks[0],
    [tasks, activeTaskId]
  );
  const runningTasks = useMemo(() => tasks.filter((t) => t.agentStatus === 'running'), [tasks]);
  const diffReadyTasks = useMemo(() => tasks.filter((t) => t.agentStatus === 'diff-ready'), [tasks]);
  const runnerState = runningTasks.length > 0 ? 'running' : activeTask?.agentStatus || 'idle';

  const streamRef = useRef(null);
  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [systemLogs, telemetryEvents]);

  const handleClear = () => {
    clearSystemLogs();
    setTelemetryEvents([]);
    addSystemLog('USR', 'Audit log cleared by operator');
  };

  const pct = Math.min(100, (tokensUsed / 128) * 100);
  const meterTone =
    pct < 40 ? 'from-cyan-500 to-cyan-400' : pct < 75 ? 'from-amber-500 to-amber-400' : 'from-red-500 to-red-400';

  return (
    <aside
      onMouseDown={() => terminalOpen && setActivePane('terminal')}
      className={`h-full bg-[#121215] flex flex-col select-none transition-all duration-150 shrink-0 ${
        terminalOpen
          ? `w-80 border-l border-zinc-800/80 ${
              activePane === 'terminal'
                ? 'border-t border-t-cyan-500/80'
                : 'border-t border-t-transparent opacity-90 hover:opacity-100'
            }`
          : 'w-0 overflow-hidden border-l-0'
      }`}
      aria-hidden={!terminalOpen}
    >
      {/* Header */}
      <div className="h-9 border-b border-zinc-800/80 px-3 flex items-center justify-between font-mono text-[11px] shrink-0">
        <span className="flex items-center gap-2 text-zinc-300 tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
          AGENT TERMINAL &amp; AUDIT
          {activePane === 'terminal' && (
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
              FOCUSED
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            Clear
          </button>
          <kbd className="text-[10px] text-zinc-500 bg-zinc-800/80 border border-zinc-700/60 rounded px-1 py-0.5">
            Cmd+J
          </kbd>
        </span>
      </div>

      {/* Telemetry strip */}
      <div className="p-3 border-b border-zinc-800/60 bg-zinc-900/40 font-mono text-xs shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Runner State</span>
          <span className={`${RUNNER_TONE[runnerState] || 'text-emerald-400'} ${runnerState === 'running' ? 'animate-pulse' : ''}`}>
            {RUNNER_LABEL[runnerState] || RUNNER_LABEL.idle}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span>
            Active run:{' '}
            <span className="text-zinc-300">
              {runningTasks[0] ? `#${runningTasks[0].id}` : activeTask ? `#${activeTask.id}` : '—'}
            </span>
            {canvasViewMode === 'diff' && <span className="text-cyan-400"> · diff-review</span>}
          </span>
          <span>
            queue:{' '}
            <span className="text-purple-300">{runningTasks.length}⚡</span>
            {' · '}
            <span className="text-emerald-400">{diffReadyTasks.length}✨</span>
          </span>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-zinc-500">Context Window</span>
            <span className="text-zinc-300">
              {tokensUsed.toFixed(1)}k / 128k tokens ({pct.toFixed(1)}%)
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${meterTone} transition-all duration-700`}
              style={{ width: `${Math.max(pct, 1.5)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Live event stream */}
      <div ref={streamRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 font-mono text-[11px]">
        {systemLogs.length === 0 && telemetryEvents.length === 0 ? (
          <p className="text-zinc-600 italic">— audit stream empty —</p>
        ) : (
          <>
            {systemLogs.map((log) => (
              <div key={log.id} className="flex gap-2 leading-relaxed">
                <span className="text-zinc-600 shrink-0">{log.timestamp}</span>
                <span className={`shrink-0 font-semibold ${SOURCE_TONE[log.source] || 'text-zinc-400'}`}>
                  [{log.source}]
                </span>
                <span className="text-zinc-300 break-words min-w-0">{log.message}</span>
              </div>
            ))}
            {/* Simulated live telemetry tail */}
            {telemetryEvents.map((evt) => (
              <div key={evt.id} className="flex gap-2 leading-relaxed">
                <span className="text-zinc-700 shrink-0">{evt.clock}</span>
                <span className="shrink-0 text-zinc-600">▸</span>
                <span className={`${TELEMETRY_TONE[evt.tone] || 'text-zinc-400'} break-words min-w-0 opacity-90`}>
                  {evt.text}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Console input row */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.agentCmd;
          const value = (input.value || '').trim();
          if (!value) return;
          addSystemLog('USR', `agent ❯ ${value}`);
          setTimeout(() => addSystemLog('AGENT', `ack: queued operator directive "${value.slice(0, 48)}"`), 350);
          input.value = '';
        }}
        className="shrink-0 border-t border-zinc-800/80 px-3 py-2 flex items-center gap-2 bg-zinc-950/60"
      >
        <span className="font-mono text-[11px] text-cyan-400 shrink-0">❯</span>
        <input
          name="agentCmd"
          type="text"
          spellCheck={false}
          placeholder="Message agent… (Enter to dispatch)"
          className="flex-1 min-w-0 bg-transparent font-mono text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setLive((v) => !v)}
          title={live ? 'Pause live telemetry feed' : 'Resume live telemetry feed'}
          className={`shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
            live
              ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20'
              : 'text-zinc-500 border-zinc-700 bg-zinc-900 hover:text-zinc-300'
          }`}
        >
          {live ? '◉ LIVE' : '⏸ PAUSED'}
        </button>
      </form>
    </aside>
  );
}

export default React.memo(RightTerminal);
