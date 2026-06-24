'use client';

import {
  ListChecks, Clock, BarChart3, CalendarDays, AlertTriangle, CalendarX, Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScheduleData } from '@/hooks/useSchedule';

export function GanttMetricCards({ schedule }: { schedule: ScheduleData }) {
  const { summary, dailyWorkload } = schedule;
  const workDays = dailyWorkload.filter(d => d.hours > 0).length;
  const avgHours = workDays > 0 ? Math.round((summary.totalHours / workDays) * 10) / 10 : 0;
  const daysLeft = summary.projectEnd
    ? Math.max(0, Math.ceil((new Date(summary.projectEnd).getTime() - Date.now()) / 86400000))
    : null;

  const items = [
    { icon: <ListChecks className="h-4 w-4" />, label: '待排任务', value: `${summary.totalTasks}`, color: 'text-indigo-500' },
    { icon: <Clock className="h-4 w-4" />, label: '总工时', value: `${summary.totalHours}h`, color: 'text-sky-500' },
    { icon: <BarChart3 className="h-4 w-4" />, label: '日均工时', value: `${avgHours}h`, color: avgHours > 8 ? 'text-amber-500' : 'text-violet-500' },
    { icon: <CalendarDays className="h-4 w-4" />, label: '工作日', value: `${workDays}天`, color: 'text-teal-500' },
    { icon: <AlertTriangle className="h-4 w-4" />, label: '延期', value: `${summary.delayedTasks}`, color: summary.delayedTasks > 0 ? 'text-red-500' : 'text-emerald-500' },
    { icon: <CalendarX className="h-4 w-4" />, label: '冲突', value: `${summary.conflictDays}`, color: summary.conflictDays > 0 ? 'text-orange-500' : 'text-emerald-500' },
    { icon: <Timer className="h-4 w-4" />, label: '预计完成', value: daysLeft !== null ? `${daysLeft}天` : '—', color: daysLeft !== null && daysLeft <= 7 ? 'text-red-500' : 'text-indigo-500' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map((c, i) => (
        <div key={i} className="flex h-9 items-center gap-2.5 rounded-lg border border-border bg-card px-3.5">
          <span className={cn('flex shrink-0', c.color)}>{c.icon}</span>
          <span className="whitespace-nowrap text-2xs-plus text-muted-foreground">{c.label}</span>
          <span className="whitespace-nowrap text-sm font-bold text-foreground">{c.value}</span>
        </div>
      ))}
    </div>
  );
}
