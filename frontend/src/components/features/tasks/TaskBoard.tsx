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
import { GripVertical } from 'lucide-react';
import { TaskCard } from './TaskCard';
import type { Task } from '@/hooks/useTasks';

// ========== 列配置 ==========

interface ColumnDef {
  key: string;
  label: string;
  color: string;
  accentBg: string;
  countBg: string;
}

const columns: ColumnDef[] = [
  { key: 'TODO', label: '待办', color: 'text-slate-600', accentBg: 'bg-slate-100', countBg: 'bg-slate-100 text-slate-500' },
  { key: 'IN_PROGRESS', label: '进行中', color: 'text-blue-600', accentBg: 'bg-blue-50', countBg: 'bg-blue-50 text-blue-500' },
  { key: 'DONE', label: '已完成', color: 'text-emerald-600', accentBg: 'bg-emerald-50', countBg: 'bg-emerald-50 text-emerald-500' },
  { key: 'BLOCKED', label: '阻塞', color: 'text-red-600', accentBg: 'bg-red-50', countBg: 'bg-red-50 text-red-500' },
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
      style={{ opacity: isDragging ? 0.3 : 1 }}
      className="group/card relative"
    >
      {/* 拖拽手柄 */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 z-10 flex h-full w-7 cursor-grab items-center justify-center rounded-l-xl opacity-0 transition-opacity hover:bg-slate-100/60 group-hover/card:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-slate-300" />
      </div>
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
    <div className="flex min-w-[280px] flex-1 flex-col">
      {/* 列头 */}
      <div className="mb-2 flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2">
          <div className={cn('h-2.5 w-2.5 rounded-full', column.accentBg)} />
          <h3 className={cn('text-sm font-semibold', column.color)}>{column.label}</h3>
        </div>
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', column.countBg)}>
          {tasks.length}
        </span>
      </div>

      {/* 分割线 */}
      <div className="mb-3 h-px bg-slate-200/60" />

      {/* 卡片区域 — 独立滚动 */}
      <div
        className={cn(
          'flex-1 space-y-3 overflow-y-auto rounded-xl border-2 border-dashed p-3 transition-colors',
          isOver
            ? 'border-indigo-300 bg-indigo-50/40'
            : 'border-transparent bg-slate-50/60',
        )}
        style={{ maxHeight: 'calc(100vh - 220px)' }}
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
          <div className="flex h-20 items-center justify-center text-[12px] text-slate-300">
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
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
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
      const activeTask = findTaskById(activeId);
      if (activeTask && activeTask.status !== targetColumn) {
        onStatusChange(activeId, targetColumn);
      }
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-5 overflow-x-auto pb-2">
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

      <DragOverlay dropAnimation={null}>
        {activeTask && (
          <div className="w-[280px]">
            <TaskCard task={activeTask} isDragging />
          </div>
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
