'use client';

import { useMemo, useState, type ComponentType } from 'react';
import { AlertTriangle, CheckSquare, Clock, DollarSign, FolderKanban, Loader2, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

interface DashboardStats {
  projectCount: number;
  totalTasks: number;
  doneTasks: number;
  completionRate: number;
  totalCost: number;
  monthlyIncome: number;
  estimatedProfit: number;
  overdueCount: number;
}

interface RecentTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  updatedAt: string;
  project: { id: string; name: string };
  assignee: { id: string; name: string } | null;
}

interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  quote: number;
  totalTasks: number;
  doneTasks: number;
}

interface CustomerSummary {
  id: string;
  name: string;
  contact: string;
  status: string;
  projects: number;
  quoteTotal: number;
  completedOrders: number;
  lastContactAt: string | null;
}

function formatYuan(fen: number): string {
  const yuan = fen / 100;
  if (yuan >= 10000) {
    return `¥${(yuan / 10000).toFixed(1)}w`;
  }
  return `¥${yuan.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatDate(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  });
}

function timeAgo(date: string): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;

  return `${Math.floor(hours / 24)} 天前`;
}

const priorityLabel: Record<string, string> = {
  URGENT: '紧急',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

const priorityClass: Record<string, string> = {
  URGENT: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
  HIGH: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400',
  MEDIUM: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  LOW: 'bg-muted text-muted-foreground',
};

const projectStatusLabel: Record<string, string> = {
  ACTIVE: '进行中',
  COMPLETED: '已完成',
  ARCHIVED: '已归档',
};

const projectStatusClass: Record<string, string> = {
  ACTIVE: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  COMPLETED: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  ARCHIVED: 'bg-muted text-muted-foreground',
};

const customerStatusLabel: Record<string, string> = {
  ACTIVE: '活跃',
  VIP: '重点客户',
  LEAD: '待跟进',
  INACTIVE: '已暂停',
};

const customerStatusClass: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  VIP: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  LEAD: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  INACTIVE: 'bg-muted text-muted-foreground',
};

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  toneClass,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  toneClass: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
          {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
        <div className={cn('rounded-lg p-2', toneClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const [statsRes, tasksRes, projectsRes, customersRes] = await Promise.all([
        api.get<{ stats: DashboardStats }>('/dashboard/summary'),
        api.get<{ tasks: RecentTask[] }>('/dashboard/recent-activity'),
        api.get<{ projects: ProjectSummary[] }>('/dashboard/project-stats'),
        api.get<{ customers: CustomerSummary[] }>('/dashboard/customer-stats'),
      ]);
      return {
        stats: statsRes.stats,
        recentTasks: tasksRes.tasks,
        projects: projectsRes.projects,
        customers: customersRes.customers,
      };
    },
    staleTime: 10_000,
  });

  const stats = data?.stats ?? null;
  const recentTasks = data?.recentTasks ?? [];
  const projects = data?.projects ?? [];
  const customers = data?.customers ?? [];
  const loading = isLoading;
  const errMsg = error ? (error instanceof ApiError ? error.message : '加载仪表盘失败') : null;

  const pendingTasks = useMemo(() => {
    if (!stats) return 0;
    return Math.max(0, stats.totalTasks - stats.doneTasks);
  }, [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (errMsg || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <AlertTriangle className="h-10 w-10 text-red-300" />
        <p className="mt-4 text-sm text-red-500">{errMsg || '加载仪表盘失败'}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <StatCard
          icon={FolderKanban}
          label="进行中订单"
          value={stats.projectCount}
          hint="项目总数"
          toneClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
        />
        <StatCard
          icon={CheckSquare}
          label="任务完成率"
          value={`${stats.completionRate}%`}
          hint={`${stats.doneTasks}/${stats.totalTasks} 个任务`}
          toneClass="bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
        />
        <StatCard
          icon={TrendingUp}
          label="本月入款"
          value={formatYuan(stats.monthlyIncome)}
          hint="已完成订单报价合计"
          toneClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
        />
        <StatCard
          icon={DollarSign}
          label="已发生成本"
          value={formatYuan(stats.totalCost)}
          hint="成本记录 + 任务成本"
          toneClass="bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
        />
        <StatCard
          icon={TrendingUp}
          label="预估利润"
          value={formatYuan(stats.estimatedProfit)}
          hint="本月入款 - 已发生成本"
          toneClass={stats.estimatedProfit >= 0
            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
            : 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'}
        />
        <StatCard
          icon={Clock}
          label="逾期任务"
          value={stats.overdueCount}
          hint={pendingTasks > 0 ? `待处理 ${pendingTasks} 个` : '当前无积压'}
          toneClass={stats.overdueCount > 0
            ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="text-sm font-semibold text-foreground">订单进度</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-4 py-4">
            {projects.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">暂无订单数据</p>
            ) : (
              projects.map((project) => {
                const progress = project.totalTasks > 0
                  ? Math.round((project.doneTasks / project.totalTasks) * 100)
                  : 0;

                return (
                  <div key={project.id} className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{project.name}</p>
                        <p className="text-xs text-muted-foreground">
                          报价 {formatYuan(project.quote)} · {project.doneTasks}/{project.totalTasks} 个任务
                        </p>
                      </div>
                      <span className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                        projectStatusClass[project.status] || projectStatusClass.ACTIVE,
                      )}>
                        {projectStatusLabel[project.status] || project.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-[11px] text-muted-foreground">
                        {progress}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="text-sm font-semibold text-foreground">近期任务动态</CardTitle>
          </CardHeader>
          <CardContent className="px-0 py-0">
            {recentTasks.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">暂无任务动态</p>
            ) : (
              <div className="divide-y divide-border">
                {recentTasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-3 px-4 py-3">
                    <span className={cn(
                      'mt-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                      priorityClass[task.priority] || priorityClass.LOW,
                    )}>
                      {priorityLabel[task.priority] || task.priority}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {task.project.name}
                        {task.assignee ? ` · ${task.assignee.name}` : ''}
                        {task.dueDate ? ` · 截止 ${formatDate(task.dueDate)}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {timeAgo(task.updatedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="text-sm font-semibold text-foreground">任务闭环检查</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 px-3 py-3">
                <p className="text-xs text-muted-foreground">全部任务</p>
                <p className="mt-1 text-lg font-bold text-foreground">{stats.totalTasks}</p>
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-3">
                <p className="text-xs text-muted-foreground">未完成任务</p>
                <p className="mt-1 text-lg font-bold text-foreground">{pendingTasks}</p>
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-3">
                <p className="text-xs text-muted-foreground">已完成任务</p>
                <p className="mt-1 text-lg font-bold text-foreground">{stats.doneTasks}</p>
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-3">
                <p className="text-xs text-muted-foreground">逾期风险</p>
                <p className={cn(
                  'mt-1 text-lg font-bold',
                  stats.overdueCount > 0 ? 'text-red-600' : 'text-foreground',
                )}>
                  {stats.overdueCount}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">整体完成进度</span>
                <span className="font-medium text-foreground">{stats.completionRate}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${stats.completionRate}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold text-foreground">客户跟进概览</CardTitle>
              <span className="text-xs text-muted-foreground">{customers.length} 个客户</span>
            </div>
          </CardHeader>
          <CardContent className="px-0 py-0">
            {customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
                <Users className="mb-2 h-8 w-8 text-slate-300" />
                暂无客户数据
              </div>
            ) : (
              <div className="divide-y divide-border">
                {customers.map((customer) => (
                  <div key={customer.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
                      {customer.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{customer.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        联系人 {customer.contact} · {customer.projects} 单 · 报价 {formatYuan(customer.quoteTotal)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        customerStatusClass[customer.status] || customerStatusClass.ACTIVE,
                      )}>
                        {customerStatusLabel[customer.status] || customer.status}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {customer.lastContactAt ? `最近联系 ${formatDate(customer.lastContactAt)}` : '待建立联系'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
