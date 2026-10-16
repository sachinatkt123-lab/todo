import React from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import TaskCard from './TaskCard';
import { STATUSES, COLUMN_TITLES } from '../utils';

// Kanban board: three droppable columns; dropping fires onDragEnd which the
// parent uses to call PATCH /tasks/:id/status.
export default function BoardView({ tasks, onDragEnd, onEdit, onDelete, onSnooze }) {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, tasks.filter((t) => t.status === s)]));

  function handleDragEnd(result) {
    if (!result.destination || result.source.droppableId === result.destination.droppableId) return;
    onDragEnd(result.draggableId, result.destination.droppableId);
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {STATUSES.map((status) => (
          <Droppable droppableId={status} key={status}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-h-[40vh] rounded-xl bg-slate-200/60 p-3 transition-colors ${
                  snapshot.isDraggingOver ? 'bg-indigo-100 ring-2 ring-indigo-300' : ''
                }`}
              >
                <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-bold uppercase tracking-wide text-slate-600">
                  {COLUMN_TITLES[status]}
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
                    {byStatus[status].length}
                  </span>
                </h2>
                <div className="space-y-3">
                  {byStatus[status].map((task, i) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      index={i}
                      draggable
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onSnooze={onSnooze}
                    />
                  ))}
                </div>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}
