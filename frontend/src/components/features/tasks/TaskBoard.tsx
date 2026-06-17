'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { TaskCard } from './TaskCard';
import type { Task } from '@/hooks/useTasks';

// ========== 列配置 ==========

interface ColumnDef {
  key: string;
  label: string;
  borderColor: string;
  bgColor: string;
}

const columns: ColumnDef[] = [
  { key: 'TODO', label: '📝 待办', borderColor: 'border-slate-200', bgColor: 'bg-slate-50/50' },
  { key: 'IN_PROGRESS', label: '🔄 进行中', borderColor: 'border-blue-200', bgColor: 'bg-blue-50/30' },
  { key: 'DONE', label: '✅ 已完成', borderColor: 'border-emerald-200', bgColor: 'bg-emerald-50/30' },
  { key: 'BLOCKED', label: '🚫 阻塞', borderColor: 'border-red-200', bgColor: 'bg-red-50/30' },
];

// ========== 可拖拽卡片 ==========

function DraggableCard({
  task,
  onEdit,
  onDelete,
  onClick,
}: {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (id: string) => void;
  onClick?: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      className={cn('group/card relative transition-opacity', isDragging && 'opacity-40')}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onEdit={onEdit} onDelete={onDelete} onClick={onClick} />
    </div>
  );
}

// ========== 可放置列 ==========

function DroppableColumn({
  column,
  tasks,
  isOver,
  onEdit,
  onDelete,
  onClick,
}: {
  column: ColumnDef;
  tasks: Task[];
  isOver: boolean;
  onEdit?: (task: Task) => void;
  onDelete?: (id: string) => void;
  onClick?: (task: Task) => void;
}) {
  return (
    <div className="flex flex-col">
      {/* 列头 — 与 GoalBoard 统一样式 */}
      <div className={cn('mb-2 flex items-center gap-2 rounded-lg border px-3 py-2', column.borderColor, column.bgColor)}>
        <span className="text-sm font-semibold">{column.label}</span>
        <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      {/* 卡片区域 — 独立滚动 */}
      <div
        className={cn(
          'flex-1 space-y-2 overflow-y-auto rounded-xl border-2 border-dashed p-2 transition-colors',
          isOver
            ? 'border-indigo-300 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-950/30'
            : 'border-transparent',
        )}
        style={{ maxHeight: 'calc(100vh - 260px)' }}
      >
        {tasks.map((task) => (
          <DraggableCard
            key={task.id}
            task={task}
            onEdit={onEdit}
            onDelete={onDelete}
            onClick={onClick}
          />
        ))}
        {tasks.length === 0 && !isOver && (
          <div className="flex h-20 items-center justify-center text-xs text-muted-foreground/50">
            暂无任务
          </div>
        )}
      </div>
    </div>
  );
}

// ========== 主组件 ==========

interface TaskBoardProps {
  tasks: Task[];
  onStatusChange: (taskId: string, newStatus: string) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (id: string) => void;
  onClick?: (task: Task) => void;
}

export function TaskBoard({ tasks, onStatusChange, onEdit, onDelete, onClick }: TaskBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const topLevelTasks = tasks.filter((t) => !t.parentId);
  const tasksByStatus: Record<string, Task[]> = { TODO: [], IN_PROGRESS: [], DONE: [], BLOCKED: [] };
  for (const task of topLevelTasks) {
    if (tasksByStatus[task.status]) tasksByStatus[task.status].push(task);
  }

  function findTaskById(id: string): Task | undefined {
    return topLevelTasks.find((t) => t.id === id);
  }

  function handleDragStart(event: DragStartEvent) {
    const task = findTaskById(String(event.active.id));
    if (task) setActiveTask(task);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const targetColumn =
      columns.find((c) => c.key === overId)?.key ||
      findTaskById(overId)?.status;

    if (targetColumn) {
      const draggedTask = findTaskById(activeId);
      if (draggedTask && draggedTask.status !== targetColumn) {
        onStatusChange(activeId, targetColumn);
      }
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-4 gap-4">
        {columns.map((col) => (
          <DroppableColumnWrapper
            key={col.key}
            column={col}
            tasks={tasksByStatus[col.key] || []}
            onEdit={onEdit}
            onDelete={onDelete}
            onClick={onClick}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease-out' }}>
        {activeTask && (
          <TaskCard task={activeTask} isDragging />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function DroppableColumnWrapper({
  column,
  tasks,
  onEdit,
  onDelete,
  onClick,
}: {
  column: ColumnDef;
  tasks: Task[];
  onEdit?: (task: Task) => void;
  onDelete?: (id: string) => void;
  onClick?: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });

  return (
    <div ref={setNodeRef} data-column={column.key}>
      <DroppableColumn
        column={column}
        tasks={tasks}
        isOver={isOver}
        onEdit={onEdit}
        onDelete={onDelete}
        onClick={onClick}
      />
    </div>
  );
}
