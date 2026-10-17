import React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

const PRIORITY_TONE = {
  P0: 'text-red-400 bg-red-500/10 border-red-500/30',
  P1: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  P2: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  P3: 'text-zinc-400 bg-zinc-800 border-zinc-700',
};

// Step 3 placeholder slot — Step 4 (TaskDocCanvas) and Phase 2 (AI Diff Viewer)
// render here. Until then, show a clean metadata preview of the selected task.
function TaskPreviewCard({ mode }) {
  const { tasks, activeTaskId, setCanvasViewMode, addSystemLog } = useWorkspace();
  const task = tasks.find((t) => t.id === activeTaskId) || tasks[0];

  if (!task) {
    return <p className="text-xs font-mono text-zinc-600">No task selected.</p>;
  }

  const isDiff = mode === 'diff';

  return (
    <div className="max-w-xl mx-auto mt-8 rounded-lg border border-zinc-800 bg-[#121215] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-zinc-200">
          {isDiff ? `🤖 AI Diff Preview — #${task.id}` : `📄 Spec Doc Preview — #${task.id}`}
        </h3>
        <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_TONE[task.priority]}`}>
          {task.priority}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm font-medium text-zinc-100">{task.title}</p>
        <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
          <div className="px-2.5 py-1.5 rounded bg-zinc-900/70 border border-zinc-800 flex justify-between">
            <span className="text-zinc-500">status</span><span className="text-zinc-200">{task.status}</span>
          </div>
          <div className="px-2.5 py-1.5 rounded bg-zinc-900/70 border border-zinc-800 flex justify-between">
            <span className="text-zinc-500">assignee</span><span className="text-zinc-200">@{task.assignee}</span>
          </div>
          <div className="px-2.5 py-1.5 rounded bg-zinc-900/70 border border-zinc-800 flex justify-between">
            <span className="text-zinc-500">branch</span><span className="text-cyan-300">⎇ {task.branch}</span>
          </div>
          <div className="px-2.5 py-1.5 rounded bg-zinc-900/70 border border-zinc-800 flex justify-between">
            <span className="text-zinc-500">agent</span><span className="text-purple-300">{task.agentStatus}</span>
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 font-mono border-t border-zinc-800/60 pt-2">
          {isDiff
            ? `Pending patch: ${task.agentSummary}. Full diff viewer lands in Phase 2.`
            : `${task.agentSummary} · ☑ ${task.subtaskCount.completed}/${task.subtaskCount.total} sub-tasks · updated ${task.updatedAt}. Full spec editor lands in Step 4.`}
        </p>
        <button
          type="button"
          onClick={() => {
            setCanvasViewMode('stream');
            addSystemLog('USR', `Preview: returned to Stream from "${mode}"`);
          }}
          className="px-2.5 py-1.5 text-xs font-medium rounded bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700 transition-all"
        >
          ← Back to Stream
        </button>
        <p className="text-[10px] text-zinc-600 font-mono">
          Tip: press <span className="text-cyan-400">Esc</span> to return to Stream View
        </p>
      </div>
    </div>
  );
}

export default React.memo(TaskPreviewCard);
