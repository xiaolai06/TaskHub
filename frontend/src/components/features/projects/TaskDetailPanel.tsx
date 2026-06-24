'use client';

import {
  Edit3, Trash2, DollarSign, CheckSquare,
  ChevronDown, ChevronRight, Clock, Calendar, Ban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { formatDate, formatDateTime, formatCost, isOverdue, PRIORITY_DOT, PRIORITY_LABEL } from '@/lib/task-utils';
import type { Task } from '@/hooks/useTasks';

const statusConfig: Record<string, { label: string; color: string }> = {
  TODO: { label: '待办', color: 'bg-muted text-foreground/70' },
  IN_PROGRESS: { label: '进行中', color: 'bg-blue-50 text-blue-600' },
  DONE: { label: '已完成', color: 'bg-emerald-50 text-emerald-600' },
  BLOCKED: { label: '阻塞', color: 'bg-red-50 text-red-600' },
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</h4>
      {children}
    </div>
  );
}

function InfoChip({ label, value, icon, highlight }: {
  label: string; value: string; icon?: React.ReactNode; highlight?: boolean;
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

export function TaskDetailPanel({ task, onStatusChange, onEditTask, onCostTask, onDeleteTask }: {
  task: Task;
  onStatusChange?: (id: string, status: string) => void;
  onEditTask?: (task: Task) => void;
  onCostTask?: (task: Task) => void;
  onDeleteTask?: (id: string) => void;
}) {
  const children = task.children || [];
  const doneCount = children.filter((c) => c.status === 'DONE').length;
  const overdue = isOverdue(task.dueDate, task.status);
  const isBlocked = task.status === 'BLOCKED';

  return (
    <div className="px-6 py-5">
      <div className="space-y-5">
        {/* 标题区 */}
        <div className="border-b border-border/40 pb-4">
          <div className="flex items-start justify-between">
            <h3 className={cn(
              'text-[15px] font-bold leading-snug flex-1 pr-3',
              task.status === 'DONE' ? 'text-muted-foreground line-through' : 'text-foreground',
            )}>
              {task.title}
            </h3>
            {onEditTask && (
              <button
                onClick={() => onEditTask(task)}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-indigo-50 hover:text-indigo-500"
                title="编辑任务"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            {onEditTask && (
              <button onClick={() => onEditTask(task)}
                className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200">
                <Edit3 className="h-3 w-3" />编辑
              </button>
            )}
            {onCostTask && (
              <button onClick={() => onCostTask(task)}
                className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200">
                <DollarSign className="h-3 w-3" />记账
              </button>
            )}
            {onDeleteTask && (
              <button onClick={() => onDeleteTask(task.id)}
                className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-red-50 hover:text-red-500 hover:border-red-200">
                <Trash2 className="h-3 w-3" />删除
              </button>
            )}
          </div>
        </div>

        <Section label="描述">
          {task.description ? (
            <p className="text-[13px] leading-relaxed text-foreground/65">{task.description}</p>
          ) : (
            <p className="text-xs italic text-muted-foreground/40">暂无描述</p>
          )}
        </Section>

        {isBlocked && task.blockedReason && (
          <div className="rounded-lg border border-red-200/60 bg-red-50/60 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
              <Ban className="h-3.5 w-3.5" />
              阻塞原因
            </div>
            <p className="mt-1 text-xs text-red-500/80">{task.blockedReason}</p>
          </div>
        )}

        <Section label="关键信息">
          <div className="grid grid-cols-3 gap-2">
            <InfoChip label="优先级" value={PRIORITY_LABEL[task.priority] || task.priority} />
            <InfoChip label="状态" value={statusConfig[task.status]?.label || task.status} />
            <InfoChip
              label="预估"
              value={task.estimatedHours > 0 ? `${task.estimatedHours}h` : '—'}
              icon={<Clock className="h-3 w-3" />}
            />
            <InfoChip
              label="实际"
              value={task.actualHours ? `${task.actualHours}h` : '—'}
              icon={<Clock className="h-3 w-3" />}
            />
            <InfoChip
              label="截止"
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

        <Section label="时间线">
          <div className="space-y-1.5 text-xs">
            <TimeLineRow label="创建" value={formatDateTime(task.createdAt)} />
            <TimeLineRow label="更新" value={formatDateTime(task.updatedAt)} />
            {task.completedAt && (
              <TimeLineRow label="完成" value={formatDateTime(task.completedAt)} />
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

export { Section, InfoChip, TimeLineRow };
