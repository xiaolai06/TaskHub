'use client';

import { cn } from '@/lib/utils';
import { Clock, Calendar, DollarSign, Ban, MoreVertical, Edit3, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Task } from '@/hooks/useTasks';
import { getPriorityBorderColor } from '@/components/ui/PriorityBadge';

const priorityDot: Record<string, string> = {
  URGENT: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-amber-400',
  LOW: 'bg-accent',
};

const priorityLabel: Record<string, string> = {
  URGENT: '紧急',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function formatCost(fen: number | null | undefined): string {
  if (!fen) return '';
  const yuan = fen / 100;
  return yuan >= 10000 ? `¥${(yuan / 10000).toFixed(1)}万` : `¥${yuan.toLocaleString()}`;
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (id: string) => void;
  onClick?: (task: Task) => void;
  isDragging?: boolean;
}

export function TaskCard({ task, onEdit, onDelete, onClick, isDragging }: TaskCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const children = task.children || [];
  const doneCount = children.filter((c) => c.status === 'DONE').length;
  const isDone = task.status === 'DONE';
  const isBlocked = task.status === 'BLOCKED';
  const overdue = !isDone && isOverdue(task.dueDate);
  const cost = formatCost(task.cost);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div
      onClick={() => onClick?.(task)}
      className={cn(
        'group relative flex h-[168px] flex-col rounded-xl border border-border/60 bg-card shadow-sm transition-all',
        'border-l-[3px] pl-4 pr-3.5 py-3.5',
        getPriorityBorderColor(task.priority),
        isDragging && 'shadow-xl scale-[1.03] rotate-[1.5deg] border-indigo-200',
        isDone && 'opacity-55',
        onClick && 'cursor-pointer hover:border-border hover:shadow-md',
      )}
    >
      {/* 顶部：标题 + 操作 — 固定 40px */}
      <div className="flex h-10 items-start justify-between gap-2">
        <h4
          className={cn(
            'line-clamp-2 flex-1 text-sm font-semibold leading-snug',
            isDone ? 'text-muted-foreground line-through' : 'text-foreground',
          )}
        >
          {task.title}
        </h4>

        {/* 操作菜单 */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="rounded-md p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-muted hover:text-muted-foreground group-hover:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full z-20 mt-1 w-28 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit?.(task); setShowMenu(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-foreground/70 hover:bg-muted"
              >
                <Edit3 className="h-3 w-3" />编辑
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.(task.id); setShowMenu(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-red-500 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" />删除
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 描述 / 阻塞原因 — 固定 36px */}
      <div className="mt-1 h-9">
        {isBlocked && task.blockedReason ? (
          <p className="line-clamp-2 flex items-start gap-1 text-[12px] leading-[18px] text-red-400">
            <Ban className="mt-0.5 h-3 w-3 shrink-0" />
            {task.blockedReason}
          </p>
        ) : task.description ? (
          <p className="line-clamp-2 text-[12px] leading-[18px] text-muted-foreground">
            {task.description}
          </p>
        ) : (
          <p className="text-[12px] leading-[18px] text-transparent">占位</p>
        )}
      </div>

      {/* 项目名称 + 状态徽章 — 固定 24px */}
      <div className="mt-1.5 flex h-6 items-center gap-2">
        {task.project && (
          <span className="max-w-[120px] truncate rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {task.project.name}
          </span>
        )}
        <StatusBadge status={task.status} className="text-[10px]" />
      </div>

      {/* 底部信息行 — 固定 32px */}
      <div className="mt-auto flex h-8 items-center gap-x-3 border-t border-border pt-0 text-[11px]">
        {/* 优先级 */}
        <span className="flex items-center gap-1 text-muted-foreground">
          <span className={cn('h-1.5 w-1.5 rounded-full', priorityDot[task.priority] || 'bg-accent')} />
          {priorityLabel[task.priority] || '中'}
        </span>
        <span className="h-0.5 w-0.5 rounded-full bg-accent" />

        {/* 任务花销（任务自身的 cost） */}
        {cost ? (
          <span className="flex items-center gap-0.5 text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            {cost}
          </span>
        ) : (
          <span className="text-transparent">—</span>
        )}
        <span className="h-0.5 w-0.5 rounded-full bg-accent" />

        {/* 预估工时 */}
        {task.estimatedHours > 0 ? (
          <span className="flex items-center gap-0.5 text-muted-foreground">
            <Clock className="h-3 w-3" />
            {task.estimatedHours}h
          </span>
        ) : (
          <span className="text-transparent">—</span>
        )}

        {/* 截止日期 — 始终靠右 */}
        <span className={cn(
          'ml-auto flex items-center gap-0.5',
          overdue ? 'font-semibold text-red-500' : task.dueDate ? 'text-muted-foreground' : 'text-transparent',
        )}>
          <Calendar className="h-3 w-3" />
          {task.dueDate ? formatDate(task.dueDate) : '无日期'}
          {overdue && ' · 逾期'}
        </span>

        {/* 子任务进度 */}
        {children.length > 0 && (
          <span className="text-muted-foreground">{doneCount}/{children.length}</span>
        )}
      </div>
    </div>
  );
}
