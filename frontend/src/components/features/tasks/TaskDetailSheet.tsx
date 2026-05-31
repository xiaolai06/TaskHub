'use client';

import { cn } from '@/lib/utils';
import {
  X, Edit3, Trash2, Clock, Calendar, DollarSign, Ban,
  CheckSquare, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import type { Task } from '@/hooks/useTasks';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCost(fen: number | null | undefined): string {
  if (!fen) return '—';
  const yuan = fen / 100;
  return `¥${yuan.toLocaleString()}`;
}

function isOverdue(dateStr: string | null, status: string): boolean {
  if (!dateStr || status === 'DONE') return false;
  return new Date(dateStr) < new Date();
}

interface TaskDetailSheetProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (task: Task) => void;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
}

export function TaskDetailSheet({ task, open, onClose, onEdit, onDelete, onStatusChange }: TaskDetailSheetProps) {
  if (!open || !task) return null;

  const children = task.children || [];
  const doneCount = children.filter((c) => c.status === 'DONE').length;
  const overdue = isOverdue(task.dueDate, task.status);
  const isBlocked = task.status === 'BLOCKED';

  return (
    <>
      {/* 遮罩 */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* 抽屉 */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
        {/* 头部 */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex-1 pr-4">
            <h2 className={cn(
              'text-base font-bold leading-snug',
              task.status === 'DONE' ? 'text-slate-400 line-through' : 'text-slate-800',
            )}>
              {task.title}
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit?.(task)}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <Edit3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => { onDelete?.(task.id); onClose(); }}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {/* 描述 */}
            <div>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">描述</h3>
              {task.description ? (
                <p className="text-sm leading-relaxed text-slate-600">{task.description}</p>
              ) : (
                <p className="text-sm text-slate-300">暂无描述</p>
              )}
            </div>

            {/* 阻塞原因 */}
            {isBlocked && task.blockedReason && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                  <Ban className="h-4 w-4" />
                  阻塞原因
                </div>
                <p className="mt-1 text-sm text-red-500">{task.blockedReason}</p>
              </div>
            )}

            {/* 关键信息 */}
            <div className="grid grid-cols-2 gap-3">
              <InfoCard label="所属项目" value={task.project?.name || '—'} />
              <InfoCard label="优先级" value={task.priority === 'URGENT' ? '紧急' : task.priority === 'HIGH' ? '高' : task.priority === 'MEDIUM' ? '中' : '低'} />
              <InfoCard
                label="预估工时"
                value={task.estimatedHours > 0 ? `${task.estimatedHours} 小时` : '—'}
                icon={<Clock className="h-3.5 w-3.5" />}
              />
              <InfoCard
                label="实际工时"
                value={task.actualHours ? `${task.actualHours} 小时` : '未填写'}
                icon={<Clock className="h-3.5 w-3.5" />}
              />
              <InfoCard
                label="截止日期"
                value={formatDate(task.dueDate)}
                icon={<Calendar className="h-3.5 w-3.5" />}
                highlight={overdue}
              />
              <InfoCard
                label="花销"
                value={formatCost(task.cost)}
                icon={<DollarSign className="h-3.5 w-3.5" />}
              />
              {task.costNote && (
                <div className="col-span-2">
                  <InfoCard label="花销说明" value={task.costNote} />
                </div>
              )}
            </div>

            {/* 时间信息 */}
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">时间线</h3>
              <div className="space-y-2 text-[13px]">
                <TimeLineRow label="创建时间" value={formatDateTime(task.createdAt)} />
                <TimeLineRow label="最后更新" value={formatDateTime(task.updatedAt)} />
                {task.completedAt && (
                  <TimeLineRow label="完成时间" value={formatDateTime(task.completedAt)} />
                )}
              </div>
            </div>

            {/* 子任务 */}
            {children.length > 0 && (
              <div>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  子任务 {doneCount}/{children.length}
                </h3>
                {/* 进度条 */}
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${children.length > 0 ? Math.round((doneCount / children.length) * 100) : 0}%` }}
                  />
                </div>
                <div className="space-y-1">
                  {children.map((child) => (
                    <div key={child.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                      <button
                        onClick={() => onStatusChange?.(child.id, child.status === 'DONE' ? 'TODO' : 'DONE')}
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all',
                          child.status === 'DONE'
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-slate-300 hover:border-indigo-400',
                        )}
                      >
                        {child.status === 'DONE' && <CheckSquare className="h-2.5 w-2.5" />}
                      </button>
                      <span className={cn(
                        'flex-1 text-[13px]',
                        child.status === 'DONE' ? 'text-slate-400 line-through' : 'text-slate-600',
                      )}>
                        {child.title}
                      </span>
                      <StatusBadge status={child.status} className="text-[10px]" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function InfoCard({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={cn('flex items-center gap-1 text-sm font-medium', highlight ? 'text-red-500' : 'text-slate-700')}>
        {icon}
        {value}
      </p>
    </div>
  );
}

function TimeLineRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-600">{value}</span>
    </div>
  );
}
