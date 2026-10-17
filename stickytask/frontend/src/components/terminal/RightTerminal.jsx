import React, { useEffect, useRef } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

const SOURCE_TONE = {
  SYS: 'text-zinc-400',
  USR: 'text-cyan-400',
  HOTKEY: 'text-amber-400',
  AGENT: 'text-purple-400',
};

function RightTerminal() {
  const {
    terminalOpen,
    activePane,
    systemLogs,
    setActivePane,
    clearSystemLogs,
    addSystemLog,
  } = useWorkspace();

  const streamRef = useRef(null);

  // Auto-scroll to newest entry as logs arrive.
  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [systemLogs]);

  const handleClear = () => {
    clearSystemLogs();
    addSystemLog('USR', 'Audit log cleared by operator');
  };

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
          <span className="text-emerald-400">IDLE — Awaiting Task Dispatch</span>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-zinc-500">Context Window</span>
            <span className="text-zinc-300">4.2k / 128k tokens (3.2%)</span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400"
              style={{ width: '3.2%' }}
            />
          </div>
        </div>
      </div>

      {/* Live event stream */}
      <div ref={streamRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 font-mono text-[11px]">
        {systemLogs.length === 0 ? (
          <p className="text-zinc-600 italic">— audit stream empty —</p>
        ) : (
          systemLogs.map((log) => (
            <div key={log.id} className="flex gap-2 leading-relaxed">
              <span className="text-zinc-600 shrink-0">{log.timestamp}</span>
              <span className={`shrink-0 font-semibold ${SOURCE_TONE[log.source] || 'text-zinc-400'}`}>
                [{log.source}]
              </span>
              <span className="text-zinc-300 break-words min-w-0">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

export default React.memo(RightTerminal);
