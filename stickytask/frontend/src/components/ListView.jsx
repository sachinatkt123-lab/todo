import React from 'react';
import TaskCard from './TaskCard';

// Clean vertical list of tasks (non-draggable cards).
export default function ListView({ tasks, onEdit, onDelete, onSnooze }) {
  if (!tasks.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
        Nothing here yet — add a task above 👆
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} onSnooze={onSnooze} />
      ))}
    </ul>
  );
}
