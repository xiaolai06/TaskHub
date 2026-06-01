'use client';

import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Calendar, CheckSquare, Clock, DollarSign, FolderKanban, Loader2, TrendingUp, Users } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

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
  projects: number;
  status: string;
  quoteTotal: number;
  completedOrders: number;
}

const priorityColor: Record<string, string> = {
  URGENT: 'text-red-600 bg-red-50',
  HIGH: 'text-orange-600 bg-orange-50',
  MEDIUM: 'text-amber-600 bg-amber-50',
  LOW: 'text-slate-500 bg-slate-50',
};

const priorityLabel: Record<string, string> = { URGENT: '紧急', HIGH: '高', MEDIUM: '中', LOW: '低' };
const taskStatusLabel: Record<string, string> = { TODO: '待办', IN_PROGRESS: '进行中', DONE: '已完成', BLOCKED: '阻塞' };
const projectStatusLabel: Record<string, string> = { ACTIVE: '进行中', COMPLETED: '已完成', ARCHIVED: '已归档' };
const customerStatusLabel: Record<string, string> = { LEAD: '线索', ACTIVE: '活跃', INACTIVE: '沉寂', LOST: '流失' };

function formatMoney(fen: number): string {
  const yuan = fen / 100;
  return yuan >= 10000 ? `¥${(yuan / 10000).toFixed(1)}w` : `¥${yuan.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '无截止';
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function StatCard({ icon: Icon, label, value, trend, colorClass }: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  trend?: { value: string; positive: boolean };
  colorClass: string;
}) {
  return (
    <div className="flex items-start justify-between rounded-xl border border-slate-200/60 bg-white px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <p className="text-[12px] text-slate-500">{label}</p>
        <p className="mt-1 truncate text-xl font-extrabold text-slate-900">{value}</p>
        {trend && (
          <p className="mt-0.5 flex items-center gap-0.5 text-[11px]">
            {trend.positive ? <ArrowUpRight className="h-3 w-3 text-emerald-500" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />}
            <span className={trend.positive ? 'text-emerald-600' : 'text-red-500'}>{trend.value}</span>
          </p>
        )}
      </div>
      <div className={cn('rounded-lg p-2', colorClass)}><Icon className="h-4 w-4" /></div>
    </div>
  );
}

function Panel({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="flex min-h-[280px] flex-col rounded-xl border border-slate-200/60 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {count !== undefined && <span className="text-xs text-slate-400">{count}</span>}
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [summary, activity, projectStats, customerStats] = await Promise.all([
          api.get<{ stats: DashboardStats }>('/dashboard/summary'),
          api.get<{ tasks: RecentTask[] }>('/dashboard/recent-activity'),
          api.get<{ projects: ProjectSummary[] }>('/dashboard/project-stats'),
          api.get<{ customers: CustomerSummary[] }>('/dashboard/customer-stats'),
        ]);
        setStats(summary.stats);
        setRecentTasks(activity.tasks);
        setProjects(projectStats.projects);
        setCustomers(customerStats.customers);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : '加载仪表盘失败');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <AlertTriangle className="h-10 w-10 text-red-300" />
        <p className="mt-4 max-w-xl whitespace-pre-line text-center text-sm text-red-500">{error}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline">重试</button>
      </div>
    );
  }

  const taskBars = [
    { key: 'IN_PROGRESS', label: '进行中', color: 'bg-blue-500' },
    { key: 'TODO', label: '待办', color: 'bg-slate-400' },
    { key: 'DONE', label: '已完成', color: 'bg-emerald-500' },
    { key: 'BLOCKED', label: '阻塞', color: 'bg-red-400' },
  ];
  const taskStatusCounts = recentTasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});
  const totalRecentTasks = recentTasks.length || 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">经营仪表盘</h1>
          <p className="mt-0.5 text-xs text-slate-400">跟踪订单、任务、报价、成本和本月入款</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-500">
          <Calendar className="h-4 w-4 text-slate-400" />
          {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={FolderKanban} label="订单总数" value={stats?.projectCount ?? 0} colorClass="bg-indigo-100 text-indigo-600" />
        <StatCard icon={CheckSquare} label="总任务" value={stats?.totalTasks ?? 0} trend={{ value: `${stats?.completionRate ?? 0}% 完成`, positive: true }} colorClass="bg-blue-100 text-blue-600" />
        <StatCard icon={TrendingUp} label="本月入款" value={stats ? formatMoney(stats.monthlyIncome) : '¥0'} colorClass="bg-emerald-100 text-emerald-600" />
        <StatCard icon={DollarSign} label="订单利润" value={stats ? formatMoney(stats.estimatedProfit) : '¥0'} trend={stats && stats.estimatedProfit < 0 ? { value: '利润为负', positive: false } : undefined} colorClass="bg-amber-100 text-amber-600" />
        <StatCard icon={Clock} label="逾期任务" value={stats?.overdueCount ?? 0} trend={(stats?.overdueCount ?? 0) > 0 ? { value: '需要处理', positive: false } : undefined} colorClass="bg-red-100 text-red-600" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="订单概览" count={projects.length}>
          {projects.length === 0 ? (
            <EmptyState icon={FolderKanban} text="暂无订单" />
          ) : (
            <div className="divide-y divide-slate-100">
              {projects.map((project) => {
                const progress = project.totalTasks > 0 ? Math.round((project.doneTasks / project.totalTasks) * 100) : 0;
                return (
                  <div key={project.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-slate-800">{project.name}</p>
                      <p className="text-[11px] text-slate-400">{project.doneTasks}/{project.totalTasks} 任务 · {formatMoney(project.quote)} 报价</p>
                    </div>
                    <div className="w-20">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className={cn('h-full rounded-full', progress >= 80 ? 'bg-emerald-500' : 'bg-indigo-500')} style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-[11px] font-medium text-slate-500">{progress}%</span>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{projectStatusLabel[project.status] || project.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="最近活动" count={recentTasks.length}>
          {recentTasks.length === 0 ? (
            <EmptyState icon={Clock} text="暂无活动" />
          ) : (
            <div className="divide-y divide-slate-100">
              {recentTasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50">
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', task.priority === 'URGENT' || task.priority === 'HIGH' ? 'bg-red-400' : task.priority === 'MEDIUM' ? 'bg-amber-400' : 'bg-slate-300')} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-700">{task.title}</p>
                    <p className="text-[11px] text-slate-400">{task.project.name}{task.assignee && ` · ${task.assignee.name}`} · {formatDate(task.dueDate)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', priorityColor[task.priority] || 'text-slate-500 bg-slate-50')}>{priorityLabel[task.priority] || task.priority}</span>
                    <span className="text-[10px] text-slate-400">{timeAgo(task.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="任务分布">
          <div className="px-4 py-3">
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
              {taskBars.map((bar) => {
                const count = taskStatusCounts[bar.key] || 0;
                if (count === 0) return null;
                return <div key={bar.key} className={cn('h-full', bar.color)} style={{ width: `${(count / totalRecentTasks) * 100}%` }} />;
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {taskBars.map((bar) => (
                <div key={bar.key} className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', bar.color)} />
                  <span className="text-xs text-slate-500">{bar.label}</span>
                  <span className="ml-auto text-xs font-semibold text-slate-700">{taskStatusCounts[bar.key] || 0}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-400">最近任务</span>
              <span className="text-sm font-bold text-slate-700">{recentTasks.length}</span>
            </div>
          </div>
        </Panel>

        <Panel title="客户概览" count={customers.length}>
          {customers.length === 0 ? (
            <EmptyState icon={Users} text="暂无客户" />
          ) : (
            <div className="divide-y divide-slate-100">
              {customers.map((customer) => (
                <div key={customer.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">{customer.name.slice(0, 1)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-800">{customer.name}</p>
                    <p className="text-[11px] text-slate-400">{customer.contact} · {customer.projects} 订单 · {customer.completedOrders} 已完成</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{customerStatusLabel[customer.status] || customer.status}</span>
                    <span className="text-[11px] font-medium text-slate-500">{formatMoney(customer.quoteTotal)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-sm text-slate-400">
      <Icon className="mb-2 h-8 w-8 text-slate-200" />{text}
    </div>
  );
}