'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useProjectList } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';
import { AlertTriangle, Calendar, CheckCircle2, Clock, Loader2, Play, Timer, TrendingUp } from 'lucide-react';

interface ScheduledTask {
  id: string;
  title: string;
  priority: string;
  estimatedHours: number;
  scheduledStart: string;
  scheduledEnd: string;
  originalDueDate: string | null;
  isDelayed: boolean;
  delayDays: number;
  isConflict: boolean;
  status: string;
}

interface DailyWorkload {
  date: string;
  hours: number;
  isOverloaded: boolean;
  tasks: string[];
}

interface ScheduleResult {
  tasks: ScheduledTask[];
  dailyWorkload: DailyWorkload[];
  summary: {
    totalTasks: number;
    totalHours: number;
    delayedTasks: number;
    conflictDays: number;
    projectStart: string | null;
    projectEnd: string | null;
  };
}

const priorityLabel: Record<string, string> = { URGENT: '紧急', HIGH: '高', MEDIUM: '中', LOW: '低' };
const statusLabel: Record<string, string> = { TODO: '待办', IN_PROGRESS: '进行中', BLOCKED: '阻塞', DONE: '已完成' };

function fmtDate(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function ScheduleContent() {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId') || '';
  const [projectId, setProjectId] = useState(initialProjectId);
  const [dailyHourLimit, setDailyHourLimit] = useState(8);

  const { data: projectList, isLoading: projectsLoading } = useProjectList({ limit: 100, status: 'ACTIVE' });
  const projects = projectList?.data || [];
  const effectiveProjectId = projectId || projects[0]?.id || '';

  const { data: schedule, isLoading, error, refetch, isFetching } = useQuery<ScheduleResult>({
    queryKey: ['schedule', effectiveProjectId, dailyHourLimit],
    queryFn: () => api.post('/scheduler/calculate', { projectId: effectiveProjectId, dailyHourLimit }),
    enabled: !!effectiveProjectId,
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!schedule) return;
      await Promise.all(schedule.tasks.map((task) => api.put(`/tasks/${task.id}`, {
        startDate: new Date(task.scheduledStart).toISOString(),
        dueDate: new Date(task.scheduledEnd).toISOString(),
      })));
    },
    onSuccess: () => refetch(),
  });

  const selectedProject = useMemo(() => projects.find((project) => project.id === effectiveProjectId), [projects, effectiveProjectId]);

  if (projectsLoading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>;
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-24">
        <Calendar className="mb-3 h-12 w-12 text-slate-200" />
        <p className="text-sm text-slate-500">暂无进行中的项目</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">排期工作台</h1>
          <p className="mt-0.5 text-xs text-slate-400">按优先级、最早开始、截止日和每日可用工时计算真实交付排期</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={effectiveProjectId} onChange={(event) => setProjectId(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-300">
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600">
            每日
            <input type="number" min={1} max={24} value={dailyHourLimit} onChange={(event) => setDailyHourLimit(Number(event.target.value) || 8)}
              className="w-12 border-none bg-transparent text-center outline-none" />
            h
          </label>
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            重新计算
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" />排期计算失败
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
      ) : schedule ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat icon={<Calendar className="h-4 w-4" />} label="项目" value={selectedProject?.name || '-'} />
            <Stat icon={<Timer className="h-4 w-4" />} label="总工时" value={`${schedule.summary.totalHours}h`} />
            <Stat icon={<Clock className="h-4 w-4" />} label="预计完成" value={fmtDate(schedule.summary.projectEnd)} />
            <Stat icon={<AlertTriangle className="h-4 w-4" />} label="延期任务" value={schedule.summary.delayedTasks} tone={schedule.summary.delayedTasks > 0 ? 'bad' : 'normal'} />
            <Stat icon={<TrendingUp className="h-4 w-4" />} label="每日上限" value={`${dailyHourLimit}h`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-2">
              {schedule.tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20">
                  <CheckCircle2 className="mb-3 h-12 w-12 text-slate-200" />
                  <p className="text-sm text-slate-500">该项目没有待排期任务</p>
                </div>
              ) : schedule.tasks.map((task, index) => (
                <div key={task.id} className={cn('flex items-center gap-3 rounded-xl border bg-white px-4 py-3', task.isDelayed ? 'border-red-200 bg-red-50/30' : 'border-slate-200')}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-sm font-semibold', task.isDelayed ? 'text-red-700' : 'text-slate-800')}>{task.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{priorityLabel[task.priority] || task.priority} · {statusLabel[task.status] || task.status} · {task.estimatedHours}h</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>{fmtDate(task.scheduledStart)} - {fmtDate(task.scheduledEnd)}</p>
                    {task.originalDueDate && <p className={task.isDelayed ? 'font-medium text-red-600' : 'text-slate-400'}>截止 {fmtDate(task.originalDueDate)}{task.isDelayed ? ` · 延期 ${task.delayDays} 天` : ''}</p>}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-700">每日负载</h2>
                  <span className="text-[11px] text-slate-400">{schedule.dailyWorkload.length} 天</span>
                </div>
                <div className="space-y-2">
                  {schedule.dailyWorkload.map((day) => (
                    <div key={day.date}>
                      <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                        <span>{fmtDate(day.date)}</span>
                        <span>{day.hours}h</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className={cn('h-full rounded-full', day.isOverloaded ? 'bg-red-400' : 'bg-indigo-500')} style={{ width: `${Math.min(100, (day.hours / dailyHourLimit) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => applyMutation.mutate()} disabled={!schedule.tasks.length || applyMutation.isPending}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {applyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                应用排期到任务日期
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ icon, label, value, tone = 'normal' }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: 'normal' | 'bad' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className={cn('mb-2 inline-flex rounded-lg p-1.5', tone === 'bad' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600')}>{icon}</div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-base font-bold text-slate-800">{value}</p>
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>}>
      <ScheduleContent />
    </Suspense>
  );
}
