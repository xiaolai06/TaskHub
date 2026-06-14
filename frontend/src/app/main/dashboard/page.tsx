'use client';

import { type ComponentType } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, CheckSquare, ChevronRight, Clock, DollarSign, FolderKanban,
  Loader2, TrendingUp, Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useDashboard, useRefreshDashboard } from '@/hooks/useDashboard';
import type { DashboardStats } from '@/hooks/dashboardTypes';

// ─── Constants ───

const PRIORITY_LABEL: Record<string, string> = {
  URGENT: '紧急', HIGH: '高', MEDIUM: '中', LOW: '低',
};

const PRIORITY_CLASS: Record<string, string> = {
  URGENT: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
  HIGH: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400',
  MEDIUM: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  LOW: 'bg-muted/60 text-muted-foreground',
};

const PROJECT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: '进行中', COMPLETED: '已完成', ARCHIVED: '已归档',
};

const PROJECT_STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  COMPLETED: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  ARCHIVED: 'bg-muted text-muted-foreground',
};

const CUSTOMER_STATUS_LABEL: Record<string, string> = {
  ACTIVE: '活跃', VIP: '重点客户', LEAD: '待跟进', INACTIVE: '已暂停',
};

const CUSTOMER_STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  VIP: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  LEAD: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  INACTIVE: 'bg-muted text-muted-foreground',
};

// ─── Helpers ───

function formatYuan(fen: number): string {
  const yuan = fen / 100;
  if (yuan >= 10000) return `¥${(yuan / 10000).toFixed(1)}w`;
  return `¥${yuan.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function timeAgo(date: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

// ─── Skeleton ───

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-6 w-20 animate-pulse rounded bg-muted" />
          <div className="mt-1.5 h-2.5 w-24 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-4 w-12 animate-pulse rounded bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 page-enter">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </div>
            <ListSkeleton rows={3} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── StatCard ───

function StatCard({
  icon: Icon, label, value, hint, toneClass,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  toneClass: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs-plus text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
          {hint && <p className="mt-0.5 text-2xs-plus text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn('rounded-lg p-2', toneClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// ─── Page ───

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboard();
  const refreshDashboard = useRefreshDashboard();

  if (isLoading) return <DashboardSkeleton />;

  const errMsg = error ? (error instanceof ApiError ? error.message : '加载仪表盘失败') : null;
  if (errMsg || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <AlertTriangle className="h-10 w-10 text-red-400 dark:text-red-500" />
        <p className="mt-4 text-sm text-red-500">{errMsg || '加载仪表盘失败'}</p>
        <button
          type="button"
          onClick={refreshDashboard}
          className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          重试
        </button>
      </div>
    );
  }

  const { stats, recentTasks: rawTasks, projects: rawProjects, customers } = data;
  const pendingTasks = Math.max(0, stats.totalTasks - stats.doneTasks);

  const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

  const projects = [...rawProjects].sort((a, b) => {
    const pa = a.totalTasks > 0 ? Math.round((a.doneTasks / a.totalTasks) * 100) : 0;
    const pb = b.totalTasks > 0 ? Math.round((b.doneTasks / b.totalTasks) * 100) : 0;
    if (a.status !== b.status) return a.status === 'ACTIVE' ? -1 : 1;
    return pa - pb;
  });

  const recentTasks = [...rawTasks].sort((a, b) =>
    (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
  );

  return (
    <div className="flex flex-col gap-4 page-enter">
      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <StatCard
          icon={FolderKanban} label="进行中订单" value={stats.projectCount}
          hint="项目总数"
          toneClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
        />
        <StatCard
          icon={CheckSquare} label="任务完成率" value={`${stats.completionRate}%`}
          hint={`${stats.doneTasks}/${stats.totalTasks} 个任务`}
          toneClass="bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
        />
        <StatCard
          icon={TrendingUp} label="本月入款" value={formatYuan(stats.monthlyIncome)}
          hint="已完成订单报价合计"
          toneClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
        />
        <StatCard
          icon={DollarSign} label="已发生成本" value={formatYuan(stats.totalCost)}
          hint="成本记录 + 任务成本"
          toneClass="bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
        />
        <StatCard
          icon={TrendingUp} label="预估利润" value={formatYuan(stats.estimatedProfit)}
          hint="本月入款 - 已发生成本"
          toneClass={stats.estimatedProfit >= 0
            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
            : 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'}
        />
        <StatCard
          icon={Clock} label="逾期任务" value={stats.overdueCount}
          hint={pendingTasks > 0 ? `待处理 ${pendingTasks} 个` : '当前无积压'}
          toneClass={stats.overdueCount > 0
            ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'}
        />
      </div>

      {/* ── Detail Cards ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">

        {/* 订单进度 */}
        <Card className="border-border/60 bg-card shadow-sm flex flex-col">
          <CardHeader className="border-b border-border/50 px-4 py-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground">项目情况</CardTitle>
              {projects.length > 5 && (
                <Link href="/main/projects"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-60 px-3 py-1.5">
            {projects.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">暂无订单数据</p>
            ) : (
              <div>
                {projects.slice(0, 10).map((p) => {
                  const progress = p.totalTasks > 0 ? Math.round((p.doneTasks / p.totalTasks) * 100) : 0;
                  return (
                    <Link key={p.id} href="/main/projects" className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground/80">{p.name}</p>
                        <p className="text-2xs-plus text-muted-foreground">
                          {formatYuan(p.quote)} · {p.doneTasks}/{p.totalTasks} 任务
                        </p>
                      </div>
                      <div className="flex w-24 items-center gap-1.5">
                        {progress > 0 ? (
                          <>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="w-7 text-right text-2xs tabular-nums text-muted-foreground">{progress}%</span>
                          </>
                        ) : (
                          <span className="text-2xs text-muted-foreground/60">0%</span>
                        )}
                      </div>
                      <span className={cn(
                        'shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-medium',
                        PROJECT_STATUS_CLASS[p.status] || PROJECT_STATUS_CLASS.ACTIVE,
                      )}>
                        {PROJECT_STATUS_LABEL[p.status] || p.status}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 近期任务动态 */}
        <Card className="border-border/60 bg-card shadow-sm flex flex-col">
          <CardHeader className="border-b border-border/50 px-4 py-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground">任务状态</CardTitle>
              {recentTasks.length > 5 && (
                <Link href="/main/tasks"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-60 px-0 py-0">
            {recentTasks.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">暂无任务动态</p>
            ) : (
              <div className="divide-y divide-border/30">
                {recentTasks.slice(0, 10).map((task) => (
                  <Link key={task.id} href="/main/tasks" className="flex items-center gap-2.5 px-4 py-1.5 transition-colors hover:bg-muted/50">
                    <span className={cn(
                      'shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-medium',
                      PRIORITY_CLASS[task.priority] || PRIORITY_CLASS.LOW,
                    )}>
                      {PRIORITY_LABEL[task.priority] || task.priority}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground/80">{task.title}</p>
                    <span className="shrink-0 text-2xs text-muted-foreground">{timeAgo(task.updatedAt)}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 任务闭环检查 */}
        <Card className="border-border/60 bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 px-4 py-2">
            <CardTitle className="text-sm font-semibold text-foreground">任务情况</CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '全部', value: stats.totalTasks, color: 'text-foreground' },
                { label: '未完成', value: pendingTasks, color: 'text-foreground' },
                { label: '已完成', value: stats.doneTasks, color: 'text-emerald-600 dark:text-emerald-400' },
                { label: '逾期', value: stats.overdueCount, color: stats.overdueCount > 0 ? 'text-red-600' : 'text-foreground' },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-muted/40 px-2.5 py-2 text-center">
                  <p className={cn('text-base font-bold tabular-nums', item.color)}>{item.value}</p>
                  <p className="text-2xs text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-2xs-plus">
                <span className="text-muted-foreground">整体完成进度</span>
                <span className="font-medium tabular-nums text-foreground">{stats.completionRate}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${stats.completionRate}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 客户跟进概览 */}
        <Card className="border-border/60 bg-card shadow-sm flex flex-col">
          <CardHeader className="border-b border-border/50 px-4 py-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground">客户情况</CardTitle>
              {customers.length > 5 && (
                <Link href="/main/customers"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-60 px-0 py-0">
            {customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
                <Users className="mb-2 h-6 w-6 text-slate-300" />
                暂无客户数据
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {customers.slice(0, 10).map((c) => (
                  <Link key={c.id} href="/main/customers" className="flex items-center gap-2.5 px-4 py-1.5 transition-colors hover:bg-muted/50">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-2xs-plus font-semibold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
                      {c.name?.slice(0, 1) || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground/80">{c.name}</p>
                      <p className="text-2xs text-muted-foreground">
                        {c.contact} · {c.projects} 单 · {formatYuan(c.quoteTotal)}
                      </p>
                    </div>
                    <span className={cn(
                      'shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-medium',
                      CUSTOMER_STATUS_CLASS[c.status] || CUSTOMER_STATUS_CLASS.ACTIVE,
                    )}>
                      {CUSTOMER_STATUS_LABEL[c.status] || c.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
