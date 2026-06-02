'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown, ChevronRight, ChevronUp, Edit3, Trash2,
  CheckSquare, Clock, DollarSign, Calendar, Ban, ArrowUpDown,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import type { Task } from '@/hooks/useTasks';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function formatCost(fen: number | null | undefined): string {
  if (!fen) return '—';
  const yuan = fen / 100;
  return yuan >= 10000 ? `¥${(yuan / 10000).toFixed(1)}万` : `¥${yuan.toLocaleString()}`;
}

function isOverdue(dateStr: string | null, status: string): boolean {
  if (!dateStr || status === 'DONE') return false;
  return new Date(dateStr) < new Date();
}

// 排序配置
type SortField = 'priority' | 'dueDate' | 'estimatedHours' | 'title' | 'cost';
type SortOrder = 'asc' | 'desc';

const priorityOrder: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function sortTasks(tasks: Task[], field: SortField, order: SortOrder): Task[] {
  const sorted = [...tasks].sort((a, b) => {
    switch (field) {
      case 'priority': {
        const av = priorityOrder[a.priority] ?? 99;
        const bv = priorityOrder[b.priority] ?? 99;
        return av - bv;
      }
      case 'dueDate': {
        const av = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bv = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return av - bv;
      }
      case 'estimatedHours':
        return (a.estimatedHours || 0) - (b.estimatedHours || 0);
      case 'cost':
        return (a.cost || 0) - (b.cost || 0);
      case 'title':
        return a.title.localeCompare(b.title, 'zh-CN');
      default:
        return 0;
    }
  });
  return order === 'desc' ? sorted.reverse() : sorted;
}

// ========== 排序表头 ==========

function SortHeader({
  label,
  field,
  currentField,
  currentOrder,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  currentOrder: SortOrder;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = currentField === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={cn(
        'flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider transition-colors',
        isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-600',
        className,
      )}
    >
      {label}
      {isActive ? (
        currentOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

// ========== 单行 ==========

function TaskRow({
  task,
  depth = 0,
  expandedIds,
  onToggleExpand,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  task: Task;
  depth?: number;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
}) {
  const children = task.children || [];
  const isExpanded = expandedIds.has(task.id);
  const doneCount = children.filter((c) => c.status === 'DONE').length;
  const overdue = isOverdue(task.dueDate, task.status);
  const isBlocked = task.status === 'BLOCKED';

  return (
    <>
      <tr className="group transition-colors hover:bg-slate-50/60">
        <td className="w-8 pl-3">
          {children.length > 0 ? (
            <button onClick={() => onToggleExpand(task.id)} className="rounded p-0.5 text-slate-500 hover:text-slate-600">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : null}
        </td>

        {/* 标题 */}
        <td className="py-3">
          <div className="flex items-center gap-2" style={{ paddingLeft: depth * 20 }}>
            <span className={cn('text-sm font-medium', task.status === 'DONE' ? 'text-slate-400 line-through' : 'text-slate-700')}>
              {task.title}
            </span>
            {children.length > 0 && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                {doneCount}/{children.length}
              </span>
            )}
          </div>
          {task.description && depth === 0 && (
            <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500" style={{ paddingLeft: depth * 20 }}>
              {task.description}
            </p>
          )}
          {/* 阻塞原因 */}
          {isBlocked && task.blockedReason && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-red-400" style={{ paddingLeft: depth * 20 }}>
              <Ban className="h-3 w-3" />{task.blockedReason}
            </p>
          )}
        </td>

        {/* 状态 */}
        <td className="py-3">
          <button
            onClick={() => onStatusChange?.(task.id, task.status === 'DONE' ? 'TODO' : 'DONE')}
            className="transition-opacity group-hover:opacity-100 md:opacity-0"
          >
            <StatusBadge status={task.status} />
          </button>
        </td>

        {/* 优先级 */}
        <td className="py-3"><PriorityBadge priority={task.priority} /></td>

        {/* 项目 + 花销 */}
        <td className="py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] text-slate-600">{task.project?.name || '—'}</span>
            {task.cost > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] text-slate-500">
                <DollarSign className="h-3 w-3" />{formatCost(task.cost)}
              </span>
            )}
          </div>
        </td>

        {/* 工时 */}
        <td className="py-3 text-[13px] tabular-nums text-slate-500">
          {task.estimatedHours > 0 ? (
            <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-slate-500" />{task.estimatedHours}h</span>
          ) : '—'}
        </td>

        {/* 截止日期 */}
        <td className={cn('py-3 text-[13px]', overdue ? 'font-semibold text-red-500' : 'text-slate-500')}>
          {task.dueDate ? (
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-slate-500" />{formatDate(task.dueDate)}</span>
          ) : '—'}
        </td>

        {/* 操作 */}
        <td className="py-3">
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button onClick={() => onEdit?.(task)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-600">
              <Edit3 className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onDelete?.(task.id)} className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-500">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {isExpanded && children.map((child) => (
        <TaskRow
          key={child.id}
          task={child}
          depth={depth + 1}
          expandedIds={expandedIds}
          onToggleExpand={onToggleExpand}
          onEdit={onEdit}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
        />
      ))}
    </>
  );
}

// ========== 主组件 ==========

interface TaskListProps {
  tasks: Task[];
  onEdit?: (task: Task) => void;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
}

export function TaskList({ tasks, onEdit, onDelete, onStatusChange }: TaskListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const topLevelTasks = tasks.filter((t) => !t.parentId);
  const sortedTasks = sortTasks(topLevelTasks, sortField, sortOrder);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  }

  if (topLevelTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200/60 bg-white py-20">
        <CheckSquare className="mb-3 h-10 w-10 text-slate-200" />
        <p className="text-sm text-slate-500">暂无任务</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80">
            <th className="w-8 pl-4" />
            <th className="px-3 py-2.5 text-left">
              <SortHeader label="任务名称" field="title" currentField={sortField} currentOrder={sortOrder} onSort={handleSort} />
            </th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">状态</th>
            <th className="px-3 py-2.5 text-left">
              <SortHeader label="优先级" field="priority" currentField={sortField} currentOrder={sortOrder} onSort={handleSort} />
            </th>
            <th className="px-3 py-2.5 text-left">
              <SortHeader label="项目/花销" field="cost" currentField={sortField} currentOrder={sortOrder} onSort={handleSort} />
            </th>
            <th className="px-3 py-2.5 text-left">
              <SortHeader label="工时" field="estimatedHours" currentField={sortField} currentOrder={sortOrder} onSort={handleSort} />
            </th>
            <th className="px-3 py-2.5 text-left">
              <SortHeader label="截止日期" field="dueDate" currentField={sortField} currentOrder={sortOrder} onSort={handleSort} />
            </th>
            <th className="w-20 px-3 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortedTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
