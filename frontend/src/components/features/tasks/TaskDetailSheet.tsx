'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  X, Edit3, Trash2, DollarSign, Clock, Calendar, Ban,
  CheckSquare, AlertTriangle,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import type { Task } from '@/hooks/useTasks';
import { formatDate, formatDateTime, formatCost, isOverdue } from '@/lib/task-utils';

interface TaskDetailSheetProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (task: Task) => void;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
  onCost?: (task: Task) => void;
}

export function TaskDetailSheet({ task, open, onClose, onEdit, onDelete, onStatusChange, onCost }: TaskDetailSheetProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!open || !task) return null;

  const children = task.children || [];
  const doneCount = children.filter((c) => c.status === 'DONE').length;
  const overdue = isOverdue(task.dueDate, task.status);
  const isBlocked = task.status === 'BLOCKED';

  const currentTask = task; // capture for closures after null guard

  function handleDelete() {
    onDelete?.(currentTask.id);
    setConfirmDelete(false);
    onClose();
  }

  return createPortal(
    <>
      {/* 遮罩 */}
      <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet 面板 */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex h-screen w-[520px] flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-in-out"
        style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* 头部 */}
        <div className="shrink-0 border-b border-border/60 px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <h2 className={cn(
                'text-base font-bold leading-snug',
                task.status === 'DONE' ? 'text-muted-foreground line-through' : 'text-foreground',
              )}>
                {task.title}
              </h2>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 操作按钮栏 */}
        <div className="shrink-0 flex items-center gap-2 border-b border-border/40 px-6 py-3">
          <button
            onClick={() => onEdit?.(task)}
            className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3.5 py-2 text-xs font-medium text-foreground/70 transition-colors hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200"
          >
            <Edit3 className="h-3.5 w-3.5" />
            编辑
          </button>
          {onCost && (
            <button
              onClick={() => onCost(task)}
              className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3.5 py-2 text-xs font-medium text-foreground/70 transition-colors hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200"
            >
              <DollarSign className="h-3.5 w-3.5" />
              记账
            </button>
          )}
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3.5 py-2 text-xs font-medium text-foreground/70 transition-colors hover:bg-red-50 hover:text-red-500 hover:border-red-200"
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            {/* 描述 */}
            <Section label="描述">
              {task.description ? (
                <p className="text-[13px] leading-relaxed text-foreground/65">{task.description}</p>
              ) : (
                <p className="text-xs italic text-muted-foreground/40">暂无描述</p>
              )}
            </Section>

            {/* 阻塞原因 */}
            {isBlocked && task.blockedReason && (
              <div className="rounded-lg border border-red-200/60 bg-red-50/60 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
                  <Ban className="h-3.5 w-3.5" />
                  阻塞原因
                </div>
                <p className="mt-1 text-xs text-red-500/80">{task.blockedReason}</p>
              </div>
            )}

            {/* 关键信息 */}
            <Section label="关键信息">
              <div className="grid grid-cols-3 gap-2">
                <InfoChip label="所属项目" value={task.project?.name || '—'} />
                <InfoChip label="优先级" value={task.priority === 'URGENT' ? '紧急' : task.priority === 'HIGH' ? '高' : task.priority === 'MEDIUM' ? '中' : '低'} />
                <InfoChip
                  label="预估工时"
                  value={task.estimatedHours > 0 ? `${task.estimatedHours}h` : '—'}
                  icon={<Clock className="h-3 w-3" />}
                />
                <InfoChip
                  label="实际工时"
                  value={task.actualHours ? `${task.actualHours}h` : '—'}
                  icon={<Clock className="h-3 w-3" />}
                />
                <InfoChip
                  label="截止日期"
                  value={formatDate(task.dueDate)}
                  icon={<Calendar className="h-3 w-3" />}
                  highlight={overdue}
                />
                <InfoChip
                  label="花销"
                  value={formatCost(task.cost, '¥0')}
                  icon={<DollarSign className="h-3 w-3" />}
                />
              </div>
              {task.costNote && (
                <p className="mt-2 text-xs text-muted-foreground/60">
                  <span className="font-medium text-muted-foreground/80">花销说明：</span>
                  {task.costNote}
                </p>
              )}
            </Section>

            {/* 子任务 */}
            {children.length > 0 && (
              <Section label={`子任务 ${doneCount}/${children.length}`}>
                <div className="mb-2.5 h-1 overflow-hidden rounded-full bg-muted/60">
                  <div
                    className="h-full rounded-full bg-emerald-500 progress-animate"
                    style={{ width: `${Math.round((doneCount / children.length) * 100)}%` }}
                  />
                </div>
                <div className="space-y-px">
                  {children.map((child) => (
                    <div key={child.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 transition-colors">
                      <button
                        onClick={() => onStatusChange?.(child.id, child.status === 'DONE' ? 'TODO' : 'DONE')}
                        className={cn(
                          'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-all',
                          child.status === 'DONE'
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-border/60 hover:border-indigo-400',
                        )}
                      >
                        {child.status === 'DONE' && <CheckSquare className="h-2 w-2" />}
                      </button>
                      <span className={cn(
                        'flex-1 text-[13px]',
                        child.status === 'DONE' ? 'text-muted-foreground/50 line-through' : 'text-foreground/70',
                      )}>
                        {child.title}
                      </span>
                      <StatusBadge status={child.status} className="text-2xs" />
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* 时间线 */}
            <Section label="时间线">
              <div className="space-y-1.5 text-xs">
                <TimeLineRow label="创建时间" value={formatDateTime(task.createdAt)} />
                <TimeLineRow label="最后更新" value={formatDateTime(task.updatedAt)} />
                {task.completedAt && (
                  <TimeLineRow label="完成时间" value={formatDateTime(task.completedAt)} />
                )}
              </div>
            </Section>
          </div>
        </div>
      </div>

      {/* 删除二次确认 */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center" onClick={() => setConfirmDelete(false)}>
          <div
            className="w-[360px] rounded-xl border border-border bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">删除任务</h3>
                <p className="mt-0.5 text-xs text-muted-foreground truncate max-w-[240px]">{task.title}</p>
              </div>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-foreground/60">
              确定要删除这个任务吗？关联的子任务和花销记录也会被删除，此操作不可撤销。
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="h-9 flex-1 rounded-lg border border-border px-4 text-xs font-medium text-foreground/70 transition-colors hover:bg-muted"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="h-9 flex-1 rounded-lg bg-red-500 px-4 text-xs font-medium text-white transition-colors hover:bg-red-600"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</h4>
      {children}
    </div>
  );
}

function InfoChip({ label, value, icon, highlight }: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/40 bg-muted/30 px-2.5 py-1.5">
      <p className="mb-px text-2xs text-muted-foreground/60">{label}</p>
      <p className={cn(
        'flex items-center gap-1 text-xs font-semibold',
        highlight ? 'text-red-500' : 'text-foreground/75',
      )}>
        {icon}
        {value}
      </p>
    </div>
  );
}

function TimeLineRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-muted/30">
      <span className="text-muted-foreground/60">{label}</span>
      <span className="font-medium text-foreground/60">{value}</span>
    </div>
  );
}
