'use client';

import { Loader2, AlertTriangle, CalendarDays, CheckCircle2 } from 'lucide-react';
import { GanttChart } from '@/components/features/schedule/GanttChart';
import { formatDate } from '@/lib/task-utils';
import type { ScheduleData } from '@/hooks/useSchedule';
import type { UseMutationResult } from '@tanstack/react-query';

export function GanttContent({
  schedule,
  scheduleLoading,
  scheduleError,
  selectedProject,
  applyMutation,
  projects,
  projectsLoading,
  dailyHourLimit,
}: {
  schedule: ScheduleData | null | undefined;
  scheduleLoading: boolean;
  scheduleError: Error | null;
  selectedProject: { name?: string | null; description?: string | null } | undefined;
  applyMutation: UseMutationResult<void, Error, void, unknown>;
  projects: { id: string; name: string }[];
  projectsLoading: boolean;
  dailyHourLimit: number;
}) {
  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-24">
        <CalendarDays className="mb-3 h-12 w-12 text-slate-200" />
        <p className="text-sm text-muted-foreground">暂无进行中的项目</p>
      </div>
    );
  }

  if (scheduleError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        <AlertTriangle className="h-4 w-4" />排期计算失败，请稍后重试
      </div>
    );
  }

  if (scheduleLoading || !schedule) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {selectedProject?.name || '全部项目'}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {formatDate(schedule.summary.projectStart)} ~ {formatDate(schedule.summary.projectEnd)}
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-2xs-plus text-muted-foreground">
            {schedule.tasks.length} 个任务
          </span>
          <button
            onClick={() => applyMutation.mutate()}
            disabled={!schedule.tasks.length || applyMutation.isPending}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            应用排期
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <GanttChart tasks={schedule.tasks} dailyWorkload={schedule.dailyWorkload} dailyLimit={dailyHourLimit} />
      </div>
    </div>
  );
}
