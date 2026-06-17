'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ListChecks, ChevronRight, AlertCircle, CheckSquare, Zap } from 'lucide-react';
import { StatCard } from './StatCard';
import { DonutChart } from './DonutChart';
import { HorizontalBars } from './HorizontalBars';
import { buildDateQuery } from './DateFilter';
import { SectionCard, EmptyPlaceholder, ErrorState, StatSkeleton, ChartSkeleton, CHART_COLORS } from './report-utils';
import type { DateFilterValue } from './DateFilter';

// ─── Types ───

interface TaskStats {
  statusDist: { status: string; count: number }[];
  priorityDist: { priority: string; count: number }[];
  totalTasks: number; doneTasks: number; completionRate: number;
  overdueCount: number; totalActive: number; totalCost: number;
}
interface TimeAnalysis {
  byProject: { project: string; hours: number }[];
  totalHours: number; avgPerDay: number;
}
interface OverdueTask {
  id: string; title: string; priority: string;
  dueDate: string; status: string;
  project: { id: string; name: string };
}
interface TaskDetail {
  id: string; title: string; priority: string;
  dueDate: string | null; projectName: string;
  status?: string;
}
type TasksByStatus = Record<string, TaskDetail[]>;
type TasksByPriority = Record<string, TaskDetail[]>;

// ─── Helpers ───

const STATUS_LABEL: Record<string, string> = {
  TODO: '待办', IN_PROGRESS: '进行中', DONE: '已完成', BLOCKED: '阻塞',
};
const STATUS_COLOR: Record<string, string> = {
  TODO: '#94a3b8', IN_PROGRESS: '#f59e0b', DONE: '#10b981', BLOCKED: '#f43f5e',
};
const PRIORITY_LABEL: Record<string, string> = {
  URGENT: '紧急', HIGH: '高', MEDIUM: '中', LOW: '低',
};
const PRIORITY_COLOR: Record<string, string> = {
  URGENT: '#f43f5e', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#6366f1',
};
const PRIORITY_DOT_CLASS: Record<string, string> = {
  URGENT: 'bg-red-500', HIGH: 'bg-orange-500', MEDIUM: 'bg-amber-500', LOW: 'bg-indigo-400',
};
const PRIORITY_ORDER = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

function daysAgo(dateStr: string): number {
  return Math.ceil((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function fmtDueDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (diff < 0) return `逾期${Math.abs(diff)}天`;
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  return `${diff}天后`;
}

// ─── 任务详情列表（弹窗用） ───

function TaskListInPopover({ tasks, maxVisible = 8 }: {
  tasks: TaskDetail[];
  maxVisible?: number;
}) {
  if (tasks.length === 0) {
    return <p className="py-2 text-center text-muted-foreground">暂无任务</p>;
  }
  return (
    <div className="space-y-0.5" style={{ maxHeight: 240, overflowY: 'auto' }}>
      {tasks.slice(0, maxVisible).map((t) => (
        <div key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 transition-colors">
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', PRIORITY_DOT_CLASS[t.priority] ?? 'bg-slate-400')} />
          <span className="flex-1 truncate text-[11px] text-foreground/80">{t.title}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">{t.projectName}</span>
          {t.dueDate && (
            <span className={cn('shrink-0 text-[10px] font-medium', daysAgo(t.dueDate) > 0 && t.status !== 'DONE' ? 'text-red-500' : 'text-muted-foreground')}>
              {fmtDueDate(t.dueDate)}
            </span>
          )}
        </div>
      ))}
      {tasks.length > maxVisible && (
        <p className="pt-1 text-center text-[10px] text-muted-foreground">还有 {tasks.length - maxVisible} 个任务...</p>
      )}
    </div>
  );
}

// ─── Component ───

interface TaskTabProps {
  dateFilter: DateFilterValue;
}

export function TaskTab({ dateFilter }: TaskTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [timeAnalysis, setTimeAnalysis] = useState<TimeAnalysis | null>(null);
  const [overdueTasks, setOverdueTasks] = useState<OverdueTask[]>([]);
  const [tasksByStatus, setTasksByStatus] = useState<TasksByStatus>({});
  const [tasksByPriority, setTasksByPriority] = useState<TasksByPriority>({});

  const qs = buildDateQuery(dateFilter);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<TaskStats>(`/reports/task-stats?${qs}`),
      api.get<TimeAnalysis>(`/reports/time-analysis?${qs}`),
      api.get<OverdueTask[]>('/reports/overdue-tasks'),
      api.get<TasksByStatus>(`/reports/tasks-by-status?${qs}`),
      api.get<TasksByPriority>(`/reports/tasks-by-priority?${qs}`),
    ]).then(([ts, ta, ot, tbs, tbp]) => {
      setTaskStats(ts); setTimeAnalysis(ta); setOverdueTasks(ot);
      setTasksByStatus(tbs); setTasksByPriority(tbp);
    }).catch((e) => setError(e instanceof ApiError ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [qs]);

  if (loading) return (
    <div className="space-y-5 animate-in fade-in-0 duration-300">
      <StatSkeleton />
      <ChartSkeleton count={4} />
    </div>
  );
  if (error) return <ErrorState message={error} />;

  const hours = timeAnalysis?.totalHours ?? 0;
  const hourlyRate = hours > 0 && taskStats ? Math.round(taskStats.totalCost / hours / 100) : 0;

  const sortedPriority = [...(taskStats?.priorityDist ?? [])].sort(
    (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority),
  );

  return (
    <div className="space-y-5 animate-in fade-in-0 duration-300">
      {/* ── 第一层 · 决策指标 ── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          icon={AlertCircle} label="逾期任务" value={String(taskStats?.overdueCount ?? 0)}
          iconBg="bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
          hint={taskStats?.overdueCount ? '⚠ 需要关注' : '全部按时'}
        />
        <StatCard
          icon={ListChecks} label="总任务数" value={String(taskStats?.totalTasks ?? 0)}
          iconBg="bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
          hint={`进行中 ${taskStats?.totalActive ?? 0}`}
        />
        <StatCard
          icon={CheckSquare} label="完成率" value={`${taskStats?.completionRate ?? 0}%`}
          iconBg="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
        />
        <StatCard
          icon={Zap} label="有效时薪" value={hourlyRate > 0 ? `¥${hourlyRate}/h` : '-'}
          iconBg="bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
          hint={timeAnalysis ? `合计 ${timeAnalysis.totalHours}h` : undefined}
        />
      </div>

      {/* ── 第二层 · 逾期 + 状态分布 ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard
          title="逾期任务"
          right={
            <Link href="/main/tasks" className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              查看全部 <ChevronRight className="h-3 w-3" />
            </Link>
          }
        >
          {overdueTasks.length === 0 ? (
            <EmptyPlaceholder text="暂无逾期任务" />
          ) : (
            <div className="space-y-2">
              {overdueTasks.slice(0, 6).map((task) => (
                <Link
                  key={task.id}
                  href="/main/tasks"
                  className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'inline-block h-1.5 w-1.5 rounded-full',
                        task.priority === 'URGENT' ? 'bg-red-500' :
                        task.priority === 'HIGH' ? 'bg-orange-500' : 'bg-amber-500',
                      )} />
                      <span className="text-xs font-medium text-foreground truncate">{task.title}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground ml-3.5">
                      {task.project.name}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-medium text-red-500">
                    逾期 {daysAgo(task.dueDate)} 天
                  </span>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="任务状态分布">
          {!taskStats || taskStats.statusDist.length === 0 ? (
            <EmptyPlaceholder text="暂无任务" />
          ) : (
            <DonutChart
              data={taskStats.statusDist.map((s) => ({
                label: STATUS_LABEL[s.status] || s.status,
                value: s.count,
                color: STATUS_COLOR[s.status] || '#94a3b8',
                detail: (
                  <div>
                    <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[s.status] || '#94a3b8' }} />
                        <span className="text-[12px] font-semibold text-foreground">{STATUS_LABEL[s.status] || s.status}</span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">{s.count} 个</span>
                    </div>
                    <TaskListInPopover tasks={tasksByStatus[s.status] ?? []} />
                  </div>
                ),
              }))}
              centerLabel="总任务"
              centerValue={String(taskStats.totalTasks)}
            />
          )}
        </SectionCard>
      </div>

      {/* ── 第三层 · 优先级 + 工时 ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="优先级分布">
          {sortedPriority.length === 0 ? (
            <EmptyPlaceholder text="暂无任务" />
          ) : (
            <HorizontalBars
              data={sortedPriority.map((p) => ({
                label: PRIORITY_LABEL[p.priority] || p.priority,
                value: p.count,
                color: PRIORITY_COLOR[p.priority] || '#94a3b8',
                tag: `${p.count} 个`,
                detail: (
                  <div>
                    <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2.5 w-2.5 rounded-full', PRIORITY_DOT_CLASS[p.priority] ?? 'bg-slate-400')} />
                        <span className="text-[12px] font-semibold text-foreground">{PRIORITY_LABEL[p.priority] || p.priority}优先级</span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">{p.count} 个</span>
                    </div>
                    <TaskListInPopover tasks={tasksByPriority[p.priority] ?? []} />
                  </div>
                ),
              }))}
            />
          )}
        </SectionCard>

        <SectionCard
          title="工时分析"
          right={
            timeAnalysis && timeAnalysis.byProject.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                合计 {timeAnalysis.totalHours}h · 日均 {timeAnalysis.avgPerDay}h
              </span>
            ) : undefined
          }
        >
          {!timeAnalysis || timeAnalysis.byProject.length === 0 ? (
            <EmptyPlaceholder text="暂无工时记录" />
          ) : (
            <HorizontalBars
              data={timeAnalysis.byProject.map((p, i) => ({
                label: p.project,
                value: p.hours,
                color: CHART_COLORS[i % CHART_COLORS.length],
                tag: `${p.hours}h`,
                detail: (
                  <div className="space-y-0.5 text-[11px]">
                    <p className="font-medium text-foreground">{p.project}</p>
                    <div className="flex justify-between"><span className="text-muted-foreground">工时</span><span className="font-mono">{p.hours}h</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">占比</span><span className="font-mono">{timeAnalysis.totalHours > 0 ? Math.round((p.hours / timeAnalysis.totalHours) * 100) : 0}%</span></div>
                  </div>
                ),
              }))}
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
