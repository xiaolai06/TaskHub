'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Plus, ChevronDown, ChevronRight, Trash2, Edit3,
  CheckSquare, Loader2, DollarSign, X,
} from 'lucide-react';
import { TaskForm } from '@/components/features/tasks/TaskForm';
import type { Task, CreateTaskInput } from '@/hooks/useTasks';

const statusConfig: Record<string, { label: string; color: string }> = {
  TODO: { label: '待办', color: 'bg-slate-100 text-slate-600' },
  IN_PROGRESS: { label: '进行中', color: 'bg-blue-50 text-blue-600' },
  DONE: { label: '已完成', color: 'bg-emerald-50 text-emerald-600' },
  BLOCKED: { label: '阻塞', color: 'bg-red-50 text-red-600' },
};

const priorityDot: Record<string, string> = {
  URGENT: 'bg-red-500', HIGH: 'bg-orange-500', MEDIUM: 'bg-amber-400', LOW: 'bg-slate-300',
};

interface SubtaskListProps {
  tasks: Task[];
  projectId: string;
  onCreateSubtask: (data: CreateTaskInput) => void;
  onUpdateTask: (id: string, data: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  isLoading?: boolean;
}

function formatCost(fen: number | undefined): string {
  if (!fen) return '';
  const yuan = fen / 100;
  return yuan >= 1000 ? `¥${(yuan / 1000).toFixed(1)}k` : `¥${yuan}`;
}

/** 快捷记账悬浮弹窗 */
function CostPopup({ task, onSave, onClose }: {
  task: Task;
  onSave: (id: string, data: { cost: number; costNote?: string }) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const costFen = amount ? Number(amount) * 100 : 0;
    if (costFen <= 0) return;
    const newEntry = note.trim() ? `${note.trim()}:¥${amount}` : `记账:¥${amount}`;
    const existing = task.costNote || '';
    onSave(task.id, {
      cost: (task.cost || 0) + costFen,
      costNote: existing ? `${existing}；${newEntry}` : newEntry,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[80]" onClick={onClose}>
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-1/2 top-20 w-80 -translate-x-1/2 rounded-xl border border-amber-200 bg-white p-5 shadow-2xl"
      >
        {/* 箭头 */}
        <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l border-t border-amber-200 bg-white" />

        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">快捷记账</span>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>

        <p className="mb-4 truncate text-xs text-slate-400">任务：{task.title}</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">金额（元）</label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-400">¥</span>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00" min="0" step="0.01" autoFocus
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">备注说明</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="如：外包费用、材料采购"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="h-10 flex-1 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50">取消</button>
            <button type="submit" disabled={!amount}
              className="h-10 flex-1 rounded-lg bg-amber-500 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50">记录</button>
          </div>
        </form>

        {/* 已有记录 */}
        {task.costNote && (
          <div className="mt-3 border-t border-slate-100 pt-2">
            <p className="mb-1 text-[11px] font-medium text-slate-500">已有记录：</p>
            <div className="space-y-0.5">
              {task.costNote.split('；').map((entry, i) => (
                <p key={i} className="text-[11px] text-slate-500">· {entry}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SubtaskList({ tasks, projectId, onCreateSubtask, onUpdateTask, onDeleteTask, isLoading }: SubtaskListProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [costTask, setCostTask] = useState<Task | null>(null);

  const topLevelTasks = tasks.filter((t) => !t.parentId);

  function toggleExpand(id: string) {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleStatusToggle(task: Task) {
    onUpdateTask(task.id, { status: task.status === 'DONE' ? 'TODO' : 'DONE' });
  }

  function handleEditTask(task: Task) {
    setEditTask(task);
    setShowTaskForm(true);
  }

  function handleCostSave(id: string, data: { cost: number; costNote?: string }) {
    onUpdateTask(id, data as unknown as Record<string, unknown>);
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>;
  }

  return (
    <>
      <div className="space-y-1">
        {topLevelTasks.map((task) => {
          const st = statusConfig[task.status] || statusConfig.TODO;
          const children = task.children || [];
          const isExpanded = expandedTasks.has(task.id);
          const doneCount = children.filter((c) => c.status === 'DONE').length;
          const totalCost = (task.cost || 0) + (task.childrenCost || 0);

          return (
            <div key={task.id}>
              <div className="group flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-slate-50">
                {children.length > 0 ? (
                  <button onClick={() => toggleExpand(task.id)} className="shrink-0 text-slate-400 hover:text-slate-600">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                ) : <span className="w-4 shrink-0" />}

                <button onClick={() => handleStatusToggle(task)}
                  className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all',
                    task.status === 'DONE' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-indigo-400')}>
                  {task.status === 'DONE' && <CheckSquare className="h-3 w-3" />}
                </button>

                <span className={cn('h-2 w-2 shrink-0 rounded-full', priorityDot[task.priority] || 'bg-slate-300')} />

                <span className={cn('flex-1 text-[13px] font-medium', task.status === 'DONE' ? 'text-slate-400 line-through' : 'text-slate-700')}>
                  {task.title}
                </span>

                {totalCost > 0 && (
                  <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-amber-500" title={task.costNote || ''}>
                    <DollarSign className="h-3 w-3" />{formatCost(totalCost)}
                  </span>
                )}

                {children.length > 0 && <span className="shrink-0 text-[11px] text-slate-500">{doneCount}/{children.length}</span>}
                <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium', st.color)}>{st.label}</span>

                <div className="flex shrink-0 items-center gap-0.5">
                  <button onClick={() => setCostTask(task)}
                    className="rounded p-1 text-slate-400 hover:bg-amber-50 hover:text-amber-500" title="快捷记账">
                    <DollarSign className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleEditTask(task)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="编辑">
                    <Edit3 className="h-3 w-3" />
                  </button>
                  <button onClick={() => onDeleteTask(task.id)}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500" title="删除">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {isExpanded && children.length > 0 && (
                <div className="ml-8 space-y-0.5 border-l border-slate-200 pl-3">
                  {children.map((child) => {
                    const cst = statusConfig[child.status] || statusConfig.TODO;
                    return (
                      <div key={child.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50">
                        <button onClick={() => handleStatusToggle(child)}
                          className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all',
                            child.status === 'DONE' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-indigo-400')}>
                          {child.status === 'DONE' && <CheckSquare className="h-2.5 w-2.5" />}
                        </button>
                        <span className={cn('flex-1 text-[12px]', child.status === 'DONE' ? 'text-slate-400 line-through' : 'text-slate-600')}>
                          {child.title}
                        </span>
                        {child.cost && child.cost > 0 && (
                          <span className="text-[11px] text-amber-500" title={child.costNote || ''}>
                            {formatCost(child.cost)}
                            {child.costNote && <span className="ml-1 text-slate-400">({child.costNote})</span>}
                          </span>
                        )}
                        <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', cst.color)}>{cst.label}</span>
                        <button onClick={() => onDeleteTask(child.id)}
                          className="shrink-0 rounded p-0.5 text-slate-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <button onClick={() => { setEditTask(null); setShowTaskForm(true); }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-slate-400 transition-colors hover:bg-slate-50 hover:text-indigo-600">
          <Plus className="h-4 w-4" />添加任务
        </button>
      </div>

      {/* 记账悬浮弹窗 */}
      {costTask && (
        <CostPopup task={costTask} onSave={handleCostSave} onClose={() => setCostTask(null)} />
      )}

      {/* 任务表单 */}
      <TaskForm
        open={showTaskForm}
        onClose={() => { setShowTaskForm(false); setEditTask(null); }}
        onSubmit={(data) => {
          if (editTask) onUpdateTask(editTask.id, data as unknown as Record<string, unknown>);
          else onCreateSubtask(data);
          setShowTaskForm(false); setEditTask(null);
        }}
        editTask={editTask}
        projectId={projectId}
      />
    </>
  );
}
