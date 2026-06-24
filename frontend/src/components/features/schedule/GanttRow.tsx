'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import type { ScheduledTask } from '@/hooks/useSchedule';

const PRIORITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  URGENT: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700' },
  HIGH:   { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700' },
  MEDIUM: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700' },
  LOW:    { bg: 'bg-muted', border: 'border-border', text: 'text-foreground/60' },
};

const PRIORITY_LABEL: Record<string, string> = {
  URGENT: '紧急', HIGH: '高', MEDIUM: '中', LOW: '低',
};

export { PRIORITY_COLORS, PRIORITY_LABEL };

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getBarColor(task: ScheduledTask): string {
  if (task.isOverdue) return 'bg-rose-500';
  if (task.isDelayed) return 'bg-red-400';
  if (task.isConflict) return 'bg-orange-400';
  const map: Record<string, string> = { URGENT: 'bg-red-400', HIGH: 'bg-orange-400', MEDIUM: 'bg-blue-400', LOW: 'bg-slate-300' };
  return map[task.priority] ?? 'bg-blue-400';
}

function getColors(priority: string) {
  return PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.MEDIUM;
}

export function GanttRow({
  task, dates, cellW, labelW, rowH, taskDayMap, useFlex, isSelected, onSelect,
}: {
  task: ScheduledTask; dates: Date[];
  cellW: number; labelW: number; rowH: number;
  taskDayMap: Map<string, Map<string, number>>; useFlex?: boolean;
  isSelected?: boolean; onSelect?: (id: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [labelRect, setLabelRect] = useState<DOMRect | null>(null);

  const colors = getColors(task.priority);
  const dayMap = taskDayMap.get(task.id);

  const cellCls = useFlex
    ? 'flex-1 border-r border-border flex items-center justify-center min-w-0'
    : 'flex-shrink-0 border-r border-border flex items-center justify-center';

  return (
    <div
      className={cn(
        'flex border-b border-border last:border-b-0 transition-colors cursor-pointer',
        isSelected ? 'bg-transparent' : 'hover:bg-indigo-50/20',
      )}
      style={{ height: rowH }}
      onClick={() => onSelect?.(task.id)}
    >
      {/* 左列：任务名称 */}
      <div
        className="flex-shrink-0 border-r border-border flex items-center gap-2.5 px-4 overflow-hidden"
        style={{ width: labelW }}
        onMouseEnter={(e) => { setIsHovered(true); setLabelRect(e.currentTarget.getBoundingClientRect()); }}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className={cn('w-1.5 h-6 rounded-full flex-shrink-0', getBarColor(task))} />
        <div className="min-w-0 flex-1 overflow-hidden">
          <span className={cn('text-sm truncate block leading-tight', task.isDelayed ? 'text-red-600 font-semibold' : 'text-foreground font-medium')}>
            {task.title}
          </span>
          <span className="text-2xs text-muted-foreground/60 truncate block leading-tight mt-0.5">
            {task.effectiveHours}h · {PRIORITY_LABEL[task.priority]}优先
            {task.isOverdue && <span className="text-rose-600 ml-1 font-semibold">已逾期</span>}
            {!task.isOverdue && task.isDelayed && <span className="text-red-500 ml-1">延期{task.delayDays}天</span>}
          </span>
        </div>
        {task.isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />}
        {!task.isOverdue && task.isDelayed && <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
      </div>

      {/* hover 悬浮卡片 */}
      {isHovered && labelRect && createPortal(
        <div
          className="fixed z-50 w-64 rounded-xl border border-border bg-card shadow-xl animate-in fade-in-0 zoom-in-95 duration-150"
          style={{ left: labelRect.right + 8, top: labelRect.top }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="px-4 pt-3 pb-2">
            <p className="text-sm font-semibold text-foreground leading-snug truncate">{task.title}</p>
          </div>

          <div className="flex items-center gap-1.5 px-4 pb-2.5 text-2xs text-muted-foreground">
            <span className={cn(
              'inline-block h-1.5 w-1.5 rounded-full',
              task.status === 'IN_PROGRESS' ? 'bg-blue-500'
                : task.status === 'DONE' ? 'bg-emerald-500'
                  : task.status === 'BLOCKED' ? 'bg-red-400'
                    : 'bg-slate-400',
            )} />
            <span>
              {task.status === 'TODO' ? '待办' : task.status === 'IN_PROGRESS' ? '进行中' : task.status === 'BLOCKED' ? '阻塞' : task.status === 'DONE' ? '已完成' : task.status}
            </span>
            <span className="text-border/60">·</span>
            <span>{PRIORITY_LABEL[task.priority]}</span>
            {task.projectName && (
              <>
                <span className="text-border/60">·</span>
                <span className="text-indigo-500 truncate">{task.projectName}</span>
              </>
            )}
          </div>

          <div className="border-t border-border/40" />

          <div className="flex flex-col divide-y divide-border/30">
            <div className="flex items-center justify-between px-4 py-2 text-xs">
              <span className="text-muted-foreground">排期</span>
              <span className="font-medium text-foreground tabular-nums">{task.scheduledStart} → {task.scheduledEnd}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2 text-xs">
              <span className="text-muted-foreground">工时</span>
              <span className="font-medium text-foreground">{task.effectiveHours}h{task.actualHours ? `（实际 ${task.actualHours}h）` : ''}</span>
            </div>
            {task.originalDueDate && (
              <div className="flex items-center justify-between px-4 py-2 text-xs">
                <span className="text-muted-foreground">原始截止</span>
                <span className="font-medium text-foreground tabular-nums">{task.originalDueDate}</span>
              </div>
            )}
            {task.originalDueDate && task.originalDueDate !== task.scheduledEnd && (
              <div className="flex items-center justify-between px-4 py-2 text-xs">
                <span className="text-muted-foreground">实际完成</span>
                <span className={cn('font-semibold tabular-nums', (task.isOverdue || task.isDelayed) ? 'text-rose-600' : 'text-foreground')}>
                  {task.scheduledEnd}
                  {(task.isOverdue || task.isDelayed) && <span className="text-rose-500 ml-1">+{task.delayDays}天</span>}
                </span>
              </div>
            )}
          </div>

          {(task.isOverdue || task.isConflict) && (
            <div className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium border-t rounded-b-xl',
              task.isOverdue ? 'bg-rose-50/80 text-rose-600 border-rose-100' : 'bg-orange-50/80 text-orange-600 border-orange-100',
            )}>
              <AlertTriangle className="h-3 w-3" />
              <span>{task.isOverdue ? `已逾期 ${task.delayDays} 天` : '存在工时冲突'}</span>
            </div>
          )}
        </div>,
        document.body,
      )}

      {/* 右列：每日工时格子 */}
      <div className={useFlex ? 'flex flex-1 min-w-0' : 'flex relative'} style={useFlex ? undefined : { width: dates.length * cellW }}>
        {dates.map((d, i) => {
          const key = fmtDate(d);
          const hours = dayMap?.get(key) ?? 0;
          const isToday = d.getTime() === todayStart().getTime();
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const overloaded = hours > 8;

          return (
            <div
              key={i}
              className={cn(
                cellCls,
                isToday && 'bg-indigo-50/40',
                !isToday && isWeekend && 'bg-slate-50/60',
              )}
              style={useFlex ? { height: rowH } : { width: cellW, height: rowH } as React.CSSProperties}
            >
              {hours > 0 ? (
                <div
                  className={cn(
                    'rounded-lg border px-2 py-1 text-center transition-all',
                    task.isOverdue ? 'bg-rose-50 border-rose-300 text-rose-700'
                      : task.isDelayed ? 'bg-red-50 border-red-300 text-red-700'
                        : task.isConflict ? 'bg-orange-50 border-orange-300 text-orange-700'
                          : overloaded ? 'bg-amber-50 border-amber-300 text-amber-700'
                            : `${colors.bg} ${colors.border} ${colors.text}`,
                  )}
                  style={{ minWidth: useFlex ? 36 : Math.max(cellW - 6, 20) }}
                >
                  <span className="font-bold text-xs leading-none">
                    {hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`}
                  </span>
                </div>
              ) : isToday ? (
                <span className="text-2xs-plus text-indigo-300">—</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
