'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CalendarDays,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  Clock,
  FolderOpen,
  ChevronRight,
} from 'lucide-react';
import type { ScheduledTask, DailyWorkload } from '@/hooks/useSchedule';

// ======================== 类型 & 常量 ========================

type ZoomLevel = 'day' | 'week' | 'month';

interface GanttChartProps {
  tasks: ScheduledTask[];
  dailyWorkload: DailyWorkload[];
  dailyLimit?: number;
}

const PRIORITY_COLORS: Record<string, { bg: string; border: string; text: string; bar: string }> = {
  URGENT: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', bar: 'bg-red-100 border-red-300 text-red-700' },
  HIGH:   { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', bar: 'bg-orange-100 border-orange-300 text-orange-700' },
  MEDIUM: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', bar: 'bg-blue-100 border-blue-300 text-blue-700' },
  LOW:    { bg: 'bg-muted', border: 'border-border', text: 'text-foreground/60', bar: 'bg-muted border-border text-foreground/60' },
};

const PRIORITY_LABEL: Record<string, string> = {
  URGENT: '紧急', HIGH: '高', MEDIUM: '中', LOW: '低',
};

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const CELL_W: Record<ZoomLevel, number> = { day: 80, week: 52, month: 30 };
const LABEL_W: Record<ZoomLevel, number> = { day: 260, week: 200, month: 160 };
const ROW_H: Record<ZoomLevel, number> = { day: 36, week: 44, month: 36 };
const FOOTER_H = 30;

// ======================== 工具函数 ========================

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDate(s: string): Date {
  return new Date(s + 'T00:00:00');
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isWorkday(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

function getColors(priority: string) {
  return PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.MEDIUM;
}

function getBarColor(task: ScheduledTask): string {
  if (task.isOverdue) return 'bg-rose-500';
  if (task.isDelayed) return 'bg-red-400';
  if (task.isConflict) return 'bg-orange-400';
  const map: Record<string, string> = { URGENT: 'bg-red-400', HIGH: 'bg-orange-400', MEDIUM: 'bg-blue-400', LOW: 'bg-slate-300' };
  return map[task.priority] ?? 'bg-blue-400';
}

// ======================== Hooks ========================

/** 计算日期范围 — 全部从今天开始，不显示过去 */
function useDateRange(zoom: ZoomLevel) {
  return useMemo(() => {
    const today = todayStart();
    const start = new Date(today);

    let count: number;
    if (zoom === 'day') {
      count = 1;
    } else if (zoom === 'week') {
      // 本周剩余天数（含今天）+ 补足到 7 天
      const dayOfWeek = today.getDay();
      const remainInWeek = 7 - dayOfWeek;
      count = Math.max(remainInWeek, 7);
    } else {
      count = 30;
    }

    const dates: Date[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }

    return { startDate: start, dates, totalDays: count };
  }, [zoom]);
}

/** 计算每个任务在每天分配多少小时 — 优先使用后端 workdayAllocs，降级到本地计算 */
function useTaskDayMap(tasks: ScheduledTask[], _dailyWorkload: DailyWorkload[], startDate: Date, totalDays: number, dailyLimit: number) {
  return useMemo(() => {
    const map = new Map<string, Map<string, number>>();

    for (const task of tasks) {
      const dayMap = new Map<string, number>();

      // 优先使用后端返回的逐天分配数据（权威来源）
      if (task.workdayAllocs && Object.keys(task.workdayAllocs).length > 0) {
        for (const [date, hours] of Object.entries(task.workdayAllocs)) {
          if (hours > 0) dayMap.set(date, hours);
        }
      } else {
        // 降级：本地计算（兼容旧版本后端）
        const taskStart = toDate(task.scheduledStart);
        const taskEnd = toDate(task.scheduledEnd);
        const workDates: Date[] = [];
        const cursor = new Date(taskStart);
        while (cursor <= taskEnd) {
          if (isWorkday(cursor)) workDates.push(new Date(cursor));
          cursor.setDate(cursor.getDate() + 1);
        }
        if (workDates.length === 0) continue;

        let remaining = task.effectiveHours;
        let cursor2 = 0;
        while (remaining > 0.05 && cursor2 < workDates.length) {
          const alloc = Math.min(dailyLimit, Math.round(remaining * 10) / 10);
          dayMap.set(fmtDate(workDates[cursor2]), alloc);
          remaining -= alloc;
          cursor2++;
        }
      }

      map.set(task.id, dayMap);
    }

    return map;
  }, [tasks, _dailyWorkload, startDate, totalDays, dailyLimit]);
}

/** 工时汇总 Map — 按日期索引 */
function useWorkloadMap(dailyWorkload: DailyWorkload[]) {
  return useMemo(() => {
    const map = new Map<string, DailyWorkload>();
    for (const d of dailyWorkload) map.set(d.date, d);
    return map;
  }, [dailyWorkload]);
}

// ======================== 工具栏 ========================

function GanttToolbar({
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
      {/* 图例 */}
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

      {/* 缩放切换 */}
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

function DayView({
  tasks, taskDayMap,
}: {
  tasks: ScheduledTask[];
  taskDayMap: Map<string, Map<string, number>>;
}) {
  const today = todayStart();
  const todayStr = fmtDate(today);
  const weekday = WEEKDAY_NAMES[today.getDay()];

  const dayTasks = tasks
    .map((t) => ({
      task: t,
      hours: taskDayMap.get(t.id)?.get(todayStr) ?? 0,
    }))
    .filter((x) => x.hours > 0)
    .sort((a, b) => {
      const order: Record<string, number> = { IN_PROGRESS: 0, TODO: 1, BLOCKED: 2, DONE: 3 };
      return (order[a.task.status] ?? 9) - (order[b.task.status] ?? 9);
    });

  const totalHours = dayTasks.reduce((s, x) => s + x.hours, 0);

  return (
    <div className="space-y-3">
      {/* 日期头部 */}
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-foreground">{today.getMonth() + 1}月{today.getDate()}日</span>
          <span className="text-sm text-muted-foreground">周{weekday}</span>
        </div>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
          {dayTasks.length} 个任务 · {totalHours}h
        </span>
      </div>

      {/* 任务列表 */}
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
                  {/* 优先级指示条 */}
                  <div className={cn('w-1 h-8 rounded-full flex-shrink-0', colors.bg, colors.border, 'border')} />

                  {/* 任务信息 */}
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

                  {/* 工时 */}
                  <div className="text-right flex-shrink-0 w-16">
                    <span className="text-lg font-bold text-foreground">{hours}h</span>
                  </div>

                  {/* 状态标签 */}
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

const GanttHeader = function GanttHeader({
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

// ======================== 周/月共用任务行 ========================

const GanttRow = function GanttRow({
  task, dates, startDate, cellW, labelW, rowH, taskDayMap, useFlex,
}: {
  task: ScheduledTask; dates: Date[]; startDate: Date;
  cellW: number; labelW: number; rowH: number;
  taskDayMap: Map<string, Map<string, number>>; useFlex?: boolean;
}) {
  const colors = getColors(task.priority);
  const dayMap = taskDayMap.get(task.id);
  const totalInView = dayMap
    ? Array.from(dayMap.entries())
      .filter(([d]) => d >= fmtDate(startDate))
      .reduce((s, [, h]) => s + h, 0)
    : 0;

  const colStyle = useFlex ? undefined : { width: cellW };
  const cellCls = useFlex
    ? 'flex-1 border-r border-border flex items-center justify-center min-w-0'
    : 'flex-shrink-0 border-r border-border flex items-center justify-center';

  return (
    <div className="flex border-b border-border last:border-b-0 hover:bg-indigo-50/20 transition-colors" style={{ height: rowH }}>
      {/* 左列：任务名称 */}
      <Tooltip>
        <TooltipTrigger>
          <div className="flex-shrink-0 border-r border-border flex items-center gap-2.5 px-4 overflow-hidden cursor-default" style={{ width: labelW }}>
            <div className={cn('w-1.5 h-6 rounded-full flex-shrink-0', getBarColor(task))} />
            <div className="min-w-0 flex-1">
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
        </TooltipTrigger>
        <TaskTooltipContent task={task} totalInView={totalInView} />
      </Tooltip>

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
              style={useFlex ? { height: rowH } : { ...colStyle, height: rowH } as React.CSSProperties}
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
                  {task.isDelayed && (
                    <div className="text-2xs font-bold text-red-500 leading-none mt-0.5">
                      +{task.delayDays}天
                    </div>
                  )}
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
};

// ======================== 任务 Tooltip ========================

function TaskTooltipContent({ task, totalInView }: { task: ScheduledTask; totalInView: number }) {
  const colors = getColors(task.priority);

  return (
    <TooltipContent side="right" sideOffset={8} className="w-72 p-0 bg-card text-foreground border border-border shadow-xl overflow-hidden">
      <div className="px-4 pt-3 pb-2 bg-muted/40">
        <p className="text-sm font-semibold leading-snug">{task.title}</p>
        {task.projectName && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-indigo-600">
            <FolderOpen className="h-3.5 w-3.5" />{task.projectName}
          </p>
        )}
        {task.description && (
          <p className="mt-1 text-2xs-plus text-muted-foreground line-clamp-2">{task.description}</p>
        )}
      </div>

      <div className="px-4 py-2.5 space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn('rounded px-1.5 py-0.5 text-2xs font-medium border', colors.text, colors.border, colors.bg)}>
            {PRIORITY_LABEL[task.priority]}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
            {task.status === 'TODO' ? '待办' : task.status === 'IN_PROGRESS' ? '进行中' : task.status === 'BLOCKED' ? '阻塞' : task.status}
          </span>
          {task.isOverdue && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-2xs font-semibold text-rose-600">已逾期</span>}
          {!task.isOverdue && task.isDelayed && <span className="rounded bg-red-100 px-1.5 py-0.5 text-2xs font-semibold text-red-600">延期 {task.delayDays} 天</span>}
          {task.isConflict && <span className="rounded bg-orange-100 px-1.5 py-0.5 text-2xs font-semibold text-orange-600">工时冲突</span>}
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />总工时</span>
          <span className="font-medium">{task.effectiveHours}h{task.actualHours ? <span className="text-muted-foreground ml-1">(实际 {task.actualHours}h)</span> : <span className="text-muted-foreground ml-1">(预估)</span>}</span>
          <span className="text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" />排期</span>
          <span className="font-medium">{task.scheduledStart} ~ {task.scheduledEnd}</span>
          <span className="text-muted-foreground flex items-center gap-1"><ChevronRight className="h-3 w-3" />当前视图</span>
          <span className="font-medium">{totalInView % 1 === 0 ? `${totalInView}h` : `${totalInView.toFixed(1)}h`}</span>
          {task.originalDueDate && (
            <>
              <span className="text-muted-foreground">截止</span>
              <span className={task.isDelayed ? 'text-red-500 font-semibold' : 'font-medium'}>{task.originalDueDate}</span>
            </>
          )}
        </div>
      </div>
    </TooltipContent>
  );
}

// ======================== 周/月共用工时底栏 ========================

const WorkloadFooter = function WorkloadFooter({
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

// ======================== 周视图 / 月视图 ========================

function TimelineView({
  zoom, tasks, taskDayMap, dates, startDate, totalDays, workloadMap,
}: {
  zoom: 'week' | 'month';
  tasks: ScheduledTask[];
  taskDayMap: Map<string, Map<string, number>>;
  dates: Date[];
  startDate: Date;
  totalDays: number;
  workloadMap: Map<string, DailyWorkload>;
}) {
  const cellW = CELL_W[zoom];
  const labelW = LABEL_W[zoom];
  const rowH = ROW_H[zoom];
  const useFlex = zoom === 'week' || zoom === 'month';
  const chartWidth = useFlex ? undefined : labelW + totalDays * cellW;

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
      <div className={useFlex ? 'overflow-x-hidden' : 'overflow-x-auto'} style={{ maxHeight: 'calc(100vh - 260px)' }}>
        <div style={useFlex ? { minWidth: labelW + totalDays * 48 } : { minWidth: chartWidth }}>
          <GanttHeader dates={dates} cellW={cellW} labelW={labelW} useFlex={useFlex} />

          {tasks.map((task) => (
            <GanttRow
              key={task.id}
              task={task}
              dates={dates}
              startDate={startDate}
              cellW={cellW}
              labelW={labelW}
              rowH={rowH}
              taskDayMap={taskDayMap}
              useFlex={useFlex}
            />
          ))}

          <WorkloadFooter dates={dates} workloadMap={workloadMap} cellW={cellW} labelW={labelW} useFlex={useFlex} />
        </div>
      </div>
    </div>
  );
}

// ======================== 主组件 ========================

export function GanttChart({ tasks, dailyWorkload, dailyLimit = 8 }: GanttChartProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('day');
  const { startDate, dates, totalDays } = useDateRange(zoom);
  const taskDayMap = useTaskDayMap(tasks, dailyWorkload, startDate, totalDays, dailyLimit);
  const workloadMap = useWorkloadMap(dailyWorkload);

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <GanttToolbar zoom={zoom} onZoom={setZoom} />

        {zoom === 'day' ? (
          <DayView tasks={tasks} taskDayMap={taskDayMap} />
        ) : (
          <TimelineView
            zoom={zoom as 'week' | 'month'}
            tasks={tasks}
            taskDayMap={taskDayMap}
            dates={dates}
            startDate={startDate}
            totalDays={totalDays}
            workloadMap={workloadMap}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
