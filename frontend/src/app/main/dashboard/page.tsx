'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  FolderKanban, CheckSquare, TrendingUp, AlertTriangle,
  DollarSign, Clock, ArrowUpRight, ArrowDownRight, Loader2,
  Users, Calendar, ChevronLeft, ChevronRight,
} from 'lucide-react';

// ========== 类型 ==========

interface DashboardStats {
  projectCount: number;
  totalTasks: number;
  doneTasks: number;
  completionRate: number;
  totalCost: number;
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
  totalTasks: number;
  doneTasks: number;
}

type TimeRange = 'today' | 'week' | 'month' | 'quarter';

// ========== 工具 ==========

const priorityColor: Record<string, string> = {
  URGENT: 'text-red-600 bg-red-50',
  HIGH: 'text-orange-600 bg-orange-50',
  MEDIUM: 'text-amber-600 bg-amber-50',
  LOW: 'text-slate-500 bg-slate-50',
};

const statusColor: Record<string, string> = {
  TODO: 'text-slate-600 bg-slate-50',
  IN_PROGRESS: 'text-blue-600 bg-blue-50',
  DONE: 'text-emerald-600 bg-emerald-50',
  BLOCKED: 'text-red-600 bg-red-50',
};

const statusLabel: Record<string, string> = {
  TODO: '待办', IN_PROGRESS: '进行中', DONE: '已完成', BLOCKED: '阻塞',
  ACTIVE: '进行中', COMPLETED: '已完成', ARCHIVED: '已归档',
};

// TODO: 接入真实 API 后删除此常量
const MOCK_CUSTOMERS = [
  { id: '1', name: '张三公司', contact: '张经理', projects: 3, status: '活跃' },
  { id: '2', name: '李四科技', contact: '李总', projects: 2, status: '活跃' },
  { id: '3', name: '王五集团', contact: '王主管', projects: 1, status: '跟进中' },
  { id: '4', name: '赵六传媒', contact: '赵经理', projects: 4, status: '活跃' },
];

function formatCost(fen: number): string {
  const yuan = fen / 100;
  if (yuan >= 10000) return `¥${(yuan / 10000).toFixed(1)}w`;
  return `¥${yuan.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

// ========== 统计卡片 ==========

function StatCard({
  icon: Icon, label, value, trend, colorClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  trend?: { value: string; positive: boolean };
  colorClass: string;
}) {
  return (
    <div className="flex items-start justify-between rounded-xl border border-slate-200/60 bg-white px-4 py-3 shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98]">
      <div>
        <p className="text-[12px] text-slate-500">{label}</p>
        <p className="mt-1 text-xl font-extrabold text-slate-900">{value}</p>
        {trend && (
          <p className="mt-0.5 flex items-center gap-0.5 text-[11px]">
            {trend.positive ? <ArrowUpRight className="h-3 w-3 text-emerald-500" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />}
            <span className={trend.positive ? 'text-emerald-600' : 'text-red-500'}>{trend.value}</span>
            <span className="ml-0.5 text-slate-500">较上周</span>
          </p>
        )}
      </div>
      <div className={cn('rounded-lg p-2', colorClass)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
    </div>
  );
}

// ========== 卡片容器 ==========

function Card({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[280px] flex-col rounded-xl border border-slate-200/60 bg-white shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {count !== undefined && <span className="text-xs text-slate-400">{count}</span>}
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

// ========== 页面 ==========

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    async function load() {
      try {
        const [s, a, p] = await Promise.all([
          api.get<{ stats: DashboardStats }>('/dashboard/summary'),
          api.get<{ tasks: RecentTask[] }>('/dashboard/recent-activity'),
          api.get<{ projects: ProjectSummary[] }>('/dashboard/project-stats'),
        ]);
        setStats(s.stats);
        setRecentTasks(a.tasks);
        setProjects(p.projects);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : '加载仪表盘失败');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const timeRanges: { key: TimeRange; label: string }[] = [
    { key: 'today', label: '今日' },
    { key: 'week', label: '本周' },
    { key: 'month', label: '本月' },
    { key: 'quarter', label: '本季度' },
  ];

  // 模拟客户数据（TODO: 接入真实 API 后删除）
  // eslint-disable-next-line react-hooks/rules-of-hooks -- 常量，非 hook
  const customers = MOCK_CUSTOMERS;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" aria-hidden="true" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <AlertTriangle className="h-10 w-10 text-red-300" aria-hidden="true" />
        <p className="mt-4 text-sm text-red-500">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      {/* 顶部：日期选择 + 快捷切换 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 具体日期 */}
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2">
          <Calendar className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <label htmlFor="dashboard-date" className="sr-only">选择日期</label>
          <input
            id="dashboard-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40 bg-transparent text-sm text-slate-600 outline-none"
          />
        </div>
        <div className="h-5 w-px bg-slate-200" />
        {/* 快捷切换 */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {timeRanges.map((r) => (
            <button
              key={r.key}
              onClick={() => setTimeRange(r.key)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none',
                timeRange === r.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={FolderKanban} label="项目总数" value={stats?.projectCount ?? 0} colorClass="bg-indigo-100 text-indigo-600" />
        <StatCard icon={CheckSquare} label="总任务" value={stats?.totalTasks ?? 0} trend={{ value: `${stats?.completionRate ?? 0}% 完成`, positive: true }} colorClass="bg-blue-100 text-blue-600" />
        <StatCard icon={TrendingUp} label="完成率" value={`${stats?.completionRate ?? 0}%`} colorClass="bg-emerald-100 text-emerald-600" />
        <StatCard icon={DollarSign} label="总成本" value={stats ? formatCost(stats.totalCost) : '¥0'} colorClass="bg-amber-100 text-amber-600" />
        <StatCard icon={Clock} label="逾期任务" value={stats?.overdueCount ?? 0} trend={(stats?.overdueCount ?? 0) > 0 ? { value: '需要关注', positive: false } : undefined} colorClass="bg-red-100 text-red-600" />
      </div>

      {/* 2x2 网格布局 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 项目概览 */}
        <Card title="项目概览" count={projects.length}>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-sm text-slate-400">
              <FolderKanban className="mb-2 h-8 w-8 text-slate-200" aria-hidden="true" />暂无项目
            </div>
          ) : (
            <div className="divide-y">
              {projects.map((p) => {
                const progress = p.totalTasks > 0 ? Math.round((p.doneTasks / p.totalTasks) * 100) : 0;
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-slate-800">{p.name}</p>
                      <p className="text-[11px] text-slate-500">{p.doneTasks}/{p.totalTasks} 任务</p>
                    </div>
                    <div className="w-20">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className={cn('h-full rounded-full', progress >= 80 ? 'bg-amber-400' : 'bg-indigo-500')} style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-[11px] font-medium text-slate-500">{progress}%</span>
                      </div>
                    </div>
                    <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium', statusColor[p.status] || statusColor.TODO)}>
                      {statusLabel[p.status] || p.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* 最近活动 */}
        <Card title="最近活动" count={recentTasks.length}>
          {recentTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-sm text-slate-400">
              <Clock className="mb-2 h-8 w-8 text-slate-200" aria-hidden="true" />暂无活动
            </div>
          ) : (
            <div className="divide-y">
              {recentTasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50">
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', task.priority === 'URGENT' || task.priority === 'HIGH' ? 'bg-red-400' : task.priority === 'MEDIUM' ? 'bg-amber-400' : 'bg-slate-300')} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-700">{task.title}</p>
                    <p className="text-[11px] text-slate-500">{task.project.name}{task.assignee && ` · ${task.assignee.name}`}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', priorityColor[task.priority] || 'text-slate-500 bg-slate-50')}>
                      {task.priority === 'URGENT' ? '紧急' : task.priority === 'HIGH' ? '高' : task.priority === 'MEDIUM' ? '中' : '低'}
                    </span>
                    <span className="text-[10px] text-slate-500">{timeAgo(task.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 任务分布 */}
        <Card title="任务分布">
          <div className="px-4 py-3">
            {(() => {
              const statusCounts: Record<string, number> = {};
              recentTasks.forEach((t) => { statusCounts[t.status] = (statusCounts[t.status] || 0) + 1; });
              const total = recentTasks.length || 1;
              const bars = [
                { key: 'IN_PROGRESS', label: '进行中', color: 'bg-blue-500' },
                { key: 'TODO', label: '待办', color: 'bg-slate-400' },
                { key: 'DONE', label: '已完成', color: 'bg-emerald-500' },
                { key: 'BLOCKED', label: '阻塞', color: 'bg-red-400' },
              ];
              return (
                <>
                  <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                    {bars.map((bar) => {
                      const count = statusCounts[bar.key] || 0;
                      if (count === 0) return null;
                      return <div key={bar.key} className={cn('h-full', bar.color)} style={{ width: `${(count / total) * 100}%` }} />;
                    })}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {bars.map((bar) => (
                      <div key={bar.key} className="flex items-center gap-2">
                        <span className={cn('h-2.5 w-2.5 rounded-full', bar.color)} />
                        <span className="text-xs text-slate-500">{bar.label}</span>
                        <span className="ml-auto text-xs font-semibold text-slate-700">{statusCounts[bar.key] || 0}</span>
                      </div>
                    ))}
                  </div>
                  {/* 总计 */}
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-400">总计任务</span>
                    <span className="text-sm font-bold text-slate-700">{recentTasks.length}</span>
                  </div>
                </>
              );
            })()}
          </div>
        </Card>

        {/* 客户概览 */}
        <Card title="客户概览" count={customers.length}>
          <div className="divide-y">
            {customers.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                  {c.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-800">{c.name}</p>
                  <p className="text-[11px] text-slate-500">{c.contact} · {c.projects} 个项目</p>
                </div>
                <span className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                  c.status === '活跃' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
                )}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
