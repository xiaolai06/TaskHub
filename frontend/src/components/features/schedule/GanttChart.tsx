'use client';

import { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { GanttToolbar, DayView } from './GanttTimeline';
import { TimelineView } from './GanttTimeline';
import type { ScheduledTask, DailyWorkload } from '@/hooks/useSchedule';

// ======================== 类型 & 常量 ========================

type ZoomLevel = 'day' | 'week' | 'month';

interface GanttChartProps {
  tasks: ScheduledTask[];
  dailyWorkload: DailyWorkload[];
  dailyLimit?: number;
}

// ======================== 工具函数 ========================

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDate(s: string): Date {
  return new Date(s + 'T00:00:00');
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isWorkday(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

// ======================== Hooks ========================

function useDateRange(zoom: ZoomLevel) {
  return useMemo(() => {
    const today = todayStart();
    const start = new Date(today);

    let count: number;
    if (zoom === 'day') {
      count = 1;
    } else if (zoom === 'week') {
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

function useTaskDayMap(tasks: ScheduledTask[], _dailyWorkload: DailyWorkload[], startDate: Date, totalDays: number, dailyLimit: number) {
  return useMemo(() => {
    const map = new Map<string, Map<string, number>>();

    for (const task of tasks) {
      const dayMap = new Map<string, number>();

      if (task.workdayAllocs && Object.keys(task.workdayAllocs).length > 0) {
        for (const [date, hours] of Object.entries(task.workdayAllocs)) {
          if (hours > 0) dayMap.set(date, hours);
        }
      } else {
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

function useWorkloadMap(dailyWorkload: DailyWorkload[]) {
  return useMemo(() => {
    const map = new Map<string, DailyWorkload>();
    for (const d of dailyWorkload) map.set(d.date, d);
    return map;
  }, [dailyWorkload]);
}

// ======================== 主组件 ========================

export function GanttChart({ tasks, dailyWorkload, dailyLimit = 8 }: GanttChartProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('day');
  const { startDate, dates, totalDays } = useDateRange(zoom);
  const taskDayMap = useTaskDayMap(tasks, dailyWorkload, startDate, totalDays, dailyLimit);
  const workloadMap = useWorkloadMap(dailyWorkload);

  return (
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
          totalDays={totalDays}
          workloadMap={workloadMap}
        />
      )}
    </div>
  );
}
