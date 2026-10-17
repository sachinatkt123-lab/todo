import React from 'react';
import { PRIORITY_DOT, formatDue, isOverdue } from '../utils';

// One row in the task list: checkbox, title, meta chips. Click opens detail.
const PRIORITY_LABEL = { high: 'High', medium: 'Normal', low: 'Low' };

function TaskItem({ task, onToggle, onOpen }) {
  const done = task.status === 'done';
  const due = formatDue(task);
  const overdue = isOverdue(task);

  return (
    <li className="group">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(task)}
        onKeyDown={(e) => e.key === 'Enter' && onOpen(task)}
        className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white px-4 py-3 transition-all card-shadow hover:border-indigo-200 ${
          done ? 'border-slate-100 opacity-60' : 'border-slate-200'
        }`}
      >
        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(task); }}
          aria-label={done ? `Mark "${task.title}" as not complete` : `Complete "${task.title}"`}
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
            done
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-slate-300 bg-white text-transparent hover:border-indigo-400'
          }`}
        >
          ✓
        </button>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
            {task.title}
          </p>
          {(task.priority || due || (task.tags || []).length > 0) && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              {task.priority && (
                <span className="inline-flex items-center gap-1" title={`${PRIORITY_LABEL[task.priority]} priority`}>
                  <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority]}`} aria-hidden />
                  {PRIORITY_LABEL[task.priority]}
                </span>
              )}
              {due && (
                <span className={`rounded-full px-2 py-0.5 ${overdue ? 'bg-red-50 font-semibold text-red-600' : 'bg-slate-100'}`}>
                  {overdue ? '⚠ ' : ''}{due}
                </span>
              )}
              {(task.tags || []).map((t) => (
                <span key={t} className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-600">#{t}</span>
              ))}
            </div>
          )}
        </div>

        <span className="shrink-0 self-center text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>✎</span>
      </div>
    </li>
  );
}

export default React.memo(TaskItem);
