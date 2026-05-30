'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import type { ScheduledTask, DailyWorkload } from '@/hooks/useSchedule';

// ======================== 常量 ========================

const PRIORITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  URGENT: { bg: 'bg-red-100', border: 'border-red-400', text: 'text-red-700' },
  HIGH: { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-700' },
  MEDIUM: { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-700' },
  LOW: { bg: 'bg-slate-100', border: 'border-slate-400', text: 'text-slate-600' },
};

const PRIORITY_LABELS: Record<string, string> = {
  URGENT: '紧急',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

type ZoomLevel = 'day' | 'week';

// ======================== 工具函数 ========================

function toDate(d: string): Date {
  return new Date(d + 'T00:00:00');
}

function diffDays(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (86400000));
}

function formatShort(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatFull(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ======================== 组件 ========================

interface GanttChartProps {
  tasks: ScheduledTask[];
  dailyWorkload: DailyWorkload[];
}

export function GanttChart({ tasks, dailyWorkload }: GanttChartProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('day');

  // 计算日期范围
  const { startDate, totalDays, dates } = useMemo(() => {
    if (tasks.length === 0 || dailyWorkload.length === 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return { startDate: today, totalDays: 14, dates: [] };
    }

    const allDates = dailyWorkload.map((d) => toDate(d.date));
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

    // 前后各加 2 天 padding
    const start = new Date(minDate);
    start.setDate(start.getDate() - 2);
    const end = new Date(maxDate);
    end.setDate(end.getDate() + 2);

    const days = diffDays(start, end);
    const dateList: Date[] = [];
    for (let i = 0; i <= days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dateList.push(d);
    }

    return { startDate: start, totalDays: days, dates: dateList };
  }, [tasks, dailyWorkload]);

  // 今日标记位置
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOffset = diffDays(startDate, today);

  // 工时映射
  const workloadMap = useMemo(() => {
    const map = new Map<string, DailyWorkload>();
    for (const d of dailyWorkload) {
      map.set(d.date, d);
    }
    return map;
  }, [dailyWorkload]);

  // 列宽：日视图 40px，周视图 20px
  const cellWidth = zoom === 'day' ? 40 : 20;
  const labelWidth = 200;
  const headerHeight = 60;
  const rowHeight = 44;
  const chartWidth = labelWidth + totalDays * cellWidth;

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <CalendarDays className="h-12 w-12 mb-3" />
        <p className="text-sm font-medium">暂无排期数据</p>
        <p className="text-xs mt-1">请先为项目添加任务</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-100 border border-red-400" />
          <span>延期</span>
          <span className="inline-block w-3 h-3 rounded-sm bg-orange-100 border border-orange-400 ml-2" />
          <span>冲突</span>
          <span className="inline-block w-3 h-3 rounded-sm bg-indigo-100 border border-indigo-400 ml-2" />
          <span>今日</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={zoom === 'day' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setZoom('day')}
          >
            <ZoomIn className="h-3 w-3 mr-1" />
            日
          </Button>
          <Button
            variant={zoom === 'week' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setZoom('week')}
          >
            <ZoomOut className="h-3 w-3 mr-1" />
            周
          </Button>
        </div>
      </div>

      {/* 甘特图主体 */}
      <div className="border rounded-lg overflow-x-auto bg-white">
        <div style={{ minWidth: chartWidth }}>
          {/* 表头：日期 */}
          <div
            className="flex border-b bg-muted/30 sticky top-0 z-10"
            style={{ height: headerHeight }}
          >
            {/* 任务名称列 */}
            <div
              className="flex-shrink-0 border-r flex items-center px-3 text-xs font-medium text-slate-500"
              style={{ width: labelWidth }}
            >
              任务名称
            </div>
            {/* 日期列 */}
            <div className="flex relative" style={{ width: totalDays * cellWidth }}>
              {dates.map((d, i) => {
                const isToday = d.getTime() === today.getTime();
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const isMonday = d.getDay() === 1;
                const showLabel =
                  zoom === 'day'
                    ? d.getDate() === 1 || isMonday || i === 0
                    : isMonday || d.getDate() === 1 || i === 0;

                return (
                  <div
                    key={i}
                    className={`
                      flex-shrink-0 border-r flex flex-col items-center justify-center
                      ${isToday ? 'bg-indigo-50' : isWeekend ? 'bg-slate-50/50' : ''}
                      ${zoom === 'day' ? 'border-r-slate-100' : 'border-r-slate-100'}
                    `}
                    style={{ width: cellWidth }}
                  >
                    {showLabel && (
                      <>
                        <span className="text-[10px] text-slate-400 leading-tight">
                          {d.getMonth() + 1}月
                        </span>
                        <span
                          className={`text-[10px] leading-tight font-medium ${
                            isToday ? 'text-indigo-600' : 'text-slate-500'
                          }`}
                        >
                          {zoom === 'day' ? d.getDate() : `W${Math.ceil(d.getDate() / 7)}`}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}

              {/* 今日竖线 */}
              {todayOffset >= 0 && todayOffset <= totalDays && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-indigo-400 z-20"
                  style={{ left: todayOffset * cellWidth + cellWidth / 2 }}
                >
                  <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[9px] px-1 py-0.5 rounded-b whitespace-nowrap">
                    今日
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 任务行 */}
          {tasks.map((task, idx) => {
            const taskStart = toDate(task.scheduledStart);
            const taskEnd = toDate(task.scheduledEnd);
            const startOffset = diffDays(startDate, taskStart);
            const duration = Math.max(1, diffDays(taskStart, taskEnd) + 1);
            const colors = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.MEDIUM;

            return (
              <div
                key={task.id}
                className={`flex border-b last:border-b-0 ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                } hover:bg-indigo-50/30 transition-colors`}
                style={{ height: rowHeight }}
              >
                {/* 任务名称 */}
                <div
                  className="flex-shrink-0 border-r flex items-center gap-2 px-3 overflow-hidden"
                  style={{ width: labelWidth }}
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger
                        className="flex items-center gap-2 min-w-0 cursor-default"
                      >
                        {task.isDelayed && (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                        )}
                        <span
                          className={`text-xs truncate ${
                            task.isDelayed ? 'text-red-600 font-medium' : 'text-slate-700'
                          }`}
                        >
                          {task.title}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1 py-0 flex-shrink-0 ${colors.text} ${colors.border}`}
                        >
                          {PRIORITY_LABELS[task.priority] ?? task.priority}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        <p className="font-medium">{task.title}</p>
                        <p className="text-slate-500">
                          {task.estimatedHours}h · {task.scheduledStart} ~ {task.scheduledEnd}
                        </p>
                        {task.isDelayed && (
                          <p className="text-red-500">
                            延期 {task.delayDays} 天（截止 {task.originalDueDate}）
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* 甘特条 */}
                <div
                  className="relative"
                  style={{ width: totalDays * cellWidth }}
                >
                  {/* 任务横条 */}
                  <div
                    className={`
                      absolute top-1.5 rounded-md border text-[10px] font-medium
                      flex items-center px-1.5 gap-1
                      ${task.isDelayed
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : task.isConflict
                          ? 'bg-orange-50 border-orange-300 text-orange-700'
                          : `${colors.bg} ${colors.border} ${colors.text}`
                      }
                      transition-all duration-200
                    `}
                    style={{
                      left: startOffset * cellWidth + 2,
                      width: Math.max(duration * cellWidth - 4, cellWidth),
                      height: rowHeight - 12,
                    }}
                  >
                    <Clock className="h-3 w-3 flex-shrink-0 opacity-60" />
                    <span className="truncate">{task.estimatedHours}h</span>
                    {task.isDelayed && (
                      <span className="text-red-500 flex-shrink-0">+{task.delayDays}d</span>
                    )}
                  </div>

                  {/* 截止日期标记 */}
                  {task.originalDueDate && (() => {
                    const dueDate = toDate(task.originalDueDate);
                    const dueOffset = diffDays(startDate, dueDate);
                    if (dueOffset >= 0 && dueOffset <= totalDays) {
                      return (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-red-300"
                          style={{ left: dueOffset * cellWidth + cellWidth / 2 }}
                        >
                          <div className="absolute -bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-400 rounded-full" />
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            );
          })}

          {/* 每日工时底栏 */}
          <div
            className="flex border-t-2 bg-muted/20"
            style={{ height: 32 }}
          >
            <div
              className="flex-shrink-0 border-r flex items-center px-3 text-[10px] font-medium text-slate-400"
              style={{ width: labelWidth }}
            >
              每日工时
            </div>
            <div className="flex" style={{ width: totalDays * cellWidth }}>
              {dates.map((d, i) => {
                const dateStr = formatFull(d);
                const wl = workloadMap.get(dateStr);
                const hours = wl?.hours ?? 0;
                const isOverloaded = wl?.isOverloaded ?? false;

                return (
                  <div
                    key={i}
                    className={`
                      flex-shrink-0 border-r flex items-center justify-center
                      ${isOverloaded ? 'bg-red-50' : ''}
                    `}
                    style={{ width: cellWidth }}
                  >
                    {hours > 0 && (
                      <span
                        className={`text-[9px] font-mono ${
                          isOverloaded ? 'text-red-600 font-bold' : 'text-slate-400'
                        }`}
                      >
                        {hours % 1 === 0 ? hours : hours.toFixed(1)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
