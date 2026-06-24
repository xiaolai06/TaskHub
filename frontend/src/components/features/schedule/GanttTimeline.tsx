'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { CalendarDays, ZoomIn, ZoomOut, AlertTriangle, FolderOpen } from 'lucide-react';
import { GanttRow, PRIORITY_LABEL } from './GanttRow';
import type { ScheduledTask, DailyWorkload } from '@/hooks/useSchedule';

type ZoomLevel = 'day' | 'week' | 'month';

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getColors(priority: string) {
  const PRIORITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    URGENT: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700' },
    HIGH:   { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700' },
    MEDIUM: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700' },
    LOW:    { bg: 'bg-muted', border: 'border-border', text: 'text-foreground/60' },
  };
  return PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.MEDIUM;
}

// ======================== 工具栏 ========================

export function GanttToolbar({
  zoom, onZoom,
}: {
  zoom: ZoomLevel;
  onZoom: (z: ZoomLevel) => void;
}) {
  const modes: { key: ZoomLevel; label: string; icon: typeof ZoomIn }[] = [
    { key: 'day', label: '日', icon: ZoomIn },
    { key: 'week', label: '周', icon: CalendarDays },
    { key: 'month', label: '月', icon: ZoomOut },
  ];

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4 text-2xs-plus text-foreground/60">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-5 rounded-sm border border-indigo-300 bg-indigo-50" />
          正常排期
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-5 rounded-sm border border-rose-300 bg-rose-100" />
          已逾期
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-5 rounded-sm border border-red-300 bg-red-50" />
          延期任务
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-5 rounded-sm border border-orange-300 bg-orange-50" />
          工时冲突
        </span>
      </div>

      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
        {modes.map((m) => {
          const Icon = m.icon;
          const active = zoom === m.key;
          return (
            <button
              key={m.key}
              onClick={() => onZoom(m.key)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                active ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {m.label}视图
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ======================== 日视图 ========================

export function DayView({
  tasks, taskDayMap,
}: {
  tasks: ScheduledTask[];
  taskDayMap: Map<string, Map<string, number>>;
}) {
  const today = todayStart();
  const todayStr = fmtDate(today);
  const weekday = WEEKDAY_NAMES[today.getDay()];

  const dayTasks = tasks
    .map((t) => ({ task: t, hours: taskDayMap.get(t.id)?.get(todayStr) ?? 0 }))
    .filter((x) => x.hours > 0)
    .sort((a, b) => {
      const order: Record<string, number> = { IN_PROGRESS: 0, TODO: 1, BLOCKED: 2, DONE: 3 };
      return (order[a.task.status] ?? 9) - (order[b.task.status] ?? 9);
    });

  const totalHours = dayTasks.reduce((s, x) => s + x.hours, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-foreground">{today.getMonth() + 1}月{today.getDate()}日</span>
          <span className="text-sm text-muted-foreground">周{weekday}</span>
        </div>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
          {dayTasks.length} 个任务 · {totalHours}h
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {dayTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CalendarDays className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">今日暂无排期任务</p>
            <p className="text-xs mt-1">在任务中填写预估工时后，排期将自动计算</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {dayTasks.map(({ task, hours }) => {
              const colors = getColors(task.priority);
              const inProgress = task.status === 'IN_PROGRESS';
              const done = task.status === 'DONE';
              const blocked = task.status === 'BLOCKED';
              const delayed = task.isDelayed;

              return (
                <div
                  key={task.id}
                  className={cn(
                    'flex items-center px-5 py-3 gap-4 transition-colors hover:bg-muted/30',
                    inProgress && 'bg-blue-50/40',
                    blocked && 'bg-red-50/30',
                  )}
                >
                  <div className={cn('w-1 h-8 rounded-full flex-shrink-0', colors.bg, colors.border, 'border')} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {delayed && <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                      <span className={cn('text-sm truncate', delayed ? 'text-red-600 font-semibold' : 'font-medium text-foreground')}>
                        {task.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {task.projectName && (
                        <span className="flex items-center gap-1">
                          <FolderOpen className="h-3 w-3" />
                          {task.projectName}
                        </span>
                      )}
                      <span>
                        排期 {task.scheduledStart} ~ {task.scheduledEnd}
                        <span className="ml-1 text-foreground/50">({task.effectiveHours}h 总计)</span>
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 w-16">
                    <span className="text-lg font-bold text-foreground">{hours}h</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={cn('rounded px-2 py-0.5 text-2xs-plus font-medium border', colors.text, colors.border, colors.bg)}>
                      {PRIORITY_LABEL[task.priority]}
                    </span>
                    <span className={cn(
                      'rounded px-2 py-0.5 text-2xs-plus font-medium border',
                      inProgress ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : done ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          : blocked ? 'bg-red-100 text-red-700 border-red-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200',
                    )}>
                      {inProgress ? '进行中' : done ? '已完成' : blocked ? '阻塞' : '待办'}
                    </span>
                    {task.isOverdue && (
                      <span className="rounded bg-rose-100 px-2 py-0.5 text-2xs-plus font-semibold text-rose-700 border border-rose-200">
                        已逾期
                      </span>
                    )}
                    {!task.isOverdue && delayed && (
                      <span className="rounded bg-red-100 px-2 py-0.5 text-2xs-plus font-semibold text-red-700 border border-red-200">
                        延期 {task.delayDays} 天
                      </span>
                    )}
                    {task.isConflict && (
                      <span className="rounded bg-orange-100 px-2 py-0.5 text-2xs-plus font-semibold text-orange-700 border border-orange-200">
                        冲突
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ======================== 周/月共用表头 ========================

export const GanttHeader = function GanttHeader({
  dates, cellW, labelW, useFlex,
}: {
  dates: Date[]; cellW: number; labelW: number; useFlex?: boolean;
}) {
  const colStyle = useFlex ? undefined : { width: cellW };
  const colCls = useFlex
    ? 'flex-1 border-r border-border flex flex-col items-center justify-center min-w-0'
    : 'flex-shrink-0 border-r border-border flex flex-col items-center justify-center';

  return (
    <div className="flex border-b-2 border-border bg-muted/40 sticky top-0 z-10" style={{ height: 48 }}>
      <div className="flex-shrink-0 border-r border-border flex items-center px-4 text-xs font-semibold text-muted-foreground" style={{ width: labelW }}>
        任务名称
      </div>
      <div className={useFlex ? 'flex flex-1 min-w-0' : 'flex'} style={useFlex ? undefined : { width: dates.length * cellW }}>
        {dates.map((d, i) => {
          const isToday = d.getTime() === todayStart().getTime();
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const isFirst = d.getDate() === 1;

          return (
            <div
              key={i}
              className={cn(colCls, isToday && 'bg-indigo-100/60', !isToday && isWeekend && 'bg-slate-50')}
              style={colStyle}
            >
              {isFirst && (
                <span className="text-2xs font-bold text-indigo-500 leading-tight">{MONTH_NAMES[d.getMonth()]}</span>
              )}
              <span className={cn(
                'text-sm font-bold leading-tight',
                isToday ? 'text-indigo-600' : isWeekend ? 'text-muted-foreground/40' : 'text-foreground/70',
              )}>
                {d.getDate()}
              </span>
              <span className={cn(
                'text-2xs-plus leading-tight',
                isToday ? 'text-indigo-500 font-medium' : isWeekend ? 'text-muted-foreground/30' : 'text-muted-foreground/50',
              )}>
                {WEEKDAY_NAMES[d.getDay()]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ======================== 周/月共用工时底栏 ========================

const FOOTER_H = 30;

export const WorkloadFooter = function WorkloadFooter({
  dates, workloadMap, cellW, labelW, useFlex,
}: {
  dates: Date[]; workloadMap: Map<string, DailyWorkload>; cellW: number; labelW: number; useFlex?: boolean;
}) {
  const cellCls = useFlex
    ? 'flex-1 border-r border-border flex items-center justify-center min-w-0'
    : 'flex-shrink-0 border-r border-border flex items-center justify-center';

  return (
    <div className="flex border-t-2 border-border bg-muted/20" style={{ height: FOOTER_H }}>
      <div className="flex-shrink-0 border-r border-border flex items-center px-4 text-2xs-plus font-semibold text-muted-foreground" style={{ width: labelW }}>
        每日工时
      </div>
      <div className={useFlex ? 'flex flex-1 min-w-0' : 'flex'} style={useFlex ? undefined : { width: dates.length * cellW }}>
        {dates.map((d, i) => {
          const key = fmtDate(d);
          const wl = workloadMap.get(key);
          const hours = wl?.hours ?? 0;
          const overloaded = wl?.isOverloaded ?? false;

          return (
            <div
              key={i}
              className={cn(cellCls, overloaded && 'bg-red-100/60')}
              style={useFlex ? undefined : { width: cellW }}
            >
              {hours > 0 && (
                <span className={cn(
                  'font-mono font-bold',
                  overloaded ? 'text-red-600' : 'text-muted-foreground/70',
                  'text-2xs-plus',
                )}>
                  {hours % 1 === 0 ? `${hours}` : hours.toFixed(1)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ======================== 周/月视图 ========================

export function TimelineView({
  zoom, tasks, taskDayMap, dates, totalDays, workloadMap,
}: {
  zoom: 'week' | 'month';
  tasks: ScheduledTask[];
  taskDayMap: Map<string, Map<string, number>>;
  dates: Date[];
  totalDays: number;
  workloadMap: Map<string, DailyWorkload>;
}) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const CELL_W: Record<string, number> = { day: 80, week: 52, month: 30 };
  const LABEL_W: Record<string, number> = { day: 260, week: 200, month: 160 };
  const ROW_H: Record<string, number> = { day: 36, week: 44, month: 36 };

  const cellW = CELL_W[zoom];
  const labelW = LABEL_W[zoom];
  const rowH = ROW_H[zoom];
  const useFlex = zoom === 'week' || zoom === 'month';
  const chartWidth = labelW + totalDays * cellW;

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <CalendarDays className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">暂无排期数据</p>
        <p className="text-xs mt-1">在任务中填写预估工时后，排期将自动计算</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
        <div style={useFlex ? { minWidth: labelW + totalDays * 48 } : { minWidth: chartWidth }}>
          <GanttHeader dates={dates} cellW={cellW} labelW={labelW} useFlex={useFlex} />

          {tasks.map((task) => (
            <GanttRow
              key={task.id}
              task={task}
              dates={dates}
              cellW={cellW}
              labelW={labelW}
              rowH={rowH}
              taskDayMap={taskDayMap}
              useFlex={useFlex}
              isSelected={task.id === selectedTaskId}
              onSelect={(id) => setSelectedTaskId(prev => prev === id ? null : id)}
            />
          ))}

          <WorkloadFooter dates={dates} workloadMap={workloadMap} cellW={cellW} labelW={labelW} useFlex={useFlex} />
        </div>
      </div>
    </div>
  );
}
