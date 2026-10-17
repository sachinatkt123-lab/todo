import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { noteStyle, PRIORITY_BADGE, formatDue, isOverdue, justReappeared } from '../utils';

// A single sticky-note card. Used in both board (draggable=true via
// react-beautiful-dnd) and list views.
//
// Perf: memoized so the 5s poll (which re-renders App) does NOT re-render
// every unchanged card — only tasks whose object identity changed (edited,
// dragged, snoozed…) update. Callbacks are stable (useCallback in App), so
// shallow prop comparison works well here.
function TaskCard({ task, index = 0, draggable = false, onEdit, onDelete, onSnooze }) {
  const { rotation, color } = noteStyle(task.id);
  const due = formatDue(task);
  const overdue = isOverdue(task);
  const reappeared = justReappeared(task);

  const inner = (
    <div
      className={`note ${color} w-full text-left ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${
        reappeared ? 'animate-bounceIn' : ''
      } ${task.status === 'done' ? 'opacity-70' : ''}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className={`font-semibold leading-snug ${task.status === 'done' ? 'line-through text-slate-500' : 'text-slate-800'}`}>
          {task.title}
        </h3>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit?.(task); }}
            className="rounded px-1.5 text-xs text-slate-600 hover:bg-white/60"
            title="Edit"
            aria-label="Edit task"
          >
            ✎
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSnooze?.(task); }}
            className="rounded px-1.5 text-xs text-slate-600 hover:bg-white/60"
            title="Snooze 1 hour"
            aria-label="Snooze task"
          >
            💤
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(task); }}
            className="rounded px-1.5 text-xs text-red-500 hover:bg-white/60"
            title="Delete"
            aria-label="Delete task"
          >
            ✕
          </button>
        </div>
      </div>

      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-slate-600">{task.description}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {task.priority && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${PRIORITY_BADGE[task.priority]}`}>
            {task.priority}
          </span>
        )}
        {due && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${overdue ? 'bg-red-600 text-white' : 'bg-white/70 text-slate-700'}`}>
            {overdue ? '⚠ ' : '📅 '}{due}
          </span>
        )}
        {(task.tags || []).map((t) => (
          <span key={t} className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] text-slate-600">
            #{t}
          </span>
        ))}
      </div>
    </div>
  );

  if (!draggable) return <li className="list-none">{inner}</li>;

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={snapshot.isDragging ? 'rotate-2 scale-105 opacity-90' : ''}
        >
          {inner}
        </div>
      )}
    </Draggable>
  );
}

export default React.memo(TaskCard);
