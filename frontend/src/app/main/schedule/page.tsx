'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useProjectList } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';
import {
  Loader2, Calendar, AlertTriangle, Clock, CheckCircle2,
  ChevronLeft, ChevronRight, ArrowUp, ArrowDown, GripVertical,
  Flame, Zap, Timer, Trophy, TrendingUp,
} from 'lucide-react';

// ═══ 类型 ═══

interface TaskItem {
  id: string;
  title: string;
  priority: string;
  status: string;
  estimatedHours: number;
  startDate: string | null;
  dueDate: string | null;
  projectName: string;
  projectId: string;
  assigneeName: string | null;
}

interface Stats {
  total: number;
  overdue: number;
  today: number;
  thisWeek: number;
  doneThisWeek: number;
}

// ═══ 工具 ═══

const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const PRIORITY_LABEL: Record<string, string> = { URGENT: '紧急', HIGH: '高', MEDIUM: '中', LOW: '低' };
const PRIORITY_CLASS: Record<string, string> = {
  URGENT: 'bg-red-50 text-red-700 border-red-200',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
  MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
  LOW: 'bg-slate-50 text-slate-600 border-slate-200',
};
const STATUS_LABEL: Record<string, string> = {
  TODO: '待办', IN_PROGRESS: '进行中', BLOCKED: '阻塞', REVIEW: '审查', DONE: '已完成',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const date = new Date(d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const diff = Math.ceil((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === -1) return '昨天';
  if (diff < 0) return `已逾期 ${Math.abs(diff)} 天`;
  if (diff <= 7) return `${diff} 天后`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

type SortKey = 'priority' | 'dueDate' | 'hours' | 'project';
type ViewMode = 'timeline' | 'priority' | 'projects';

export default function SchedulePage() {
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // 加载所有项目的所有任务
  const { data: projectList } = useProjectList({ limit: 50 });

  const { data: allTasks, isLoading } = useQuery<TaskItem[]>({
    queryKey: ['schedule', 'all-tasks'],
    queryFn: async () => {
      const tasks: TaskItem[] = [];
      const projects = projectList?.data || [];
      for (const p of projects) {
        try {
          const res = await api.get<any>(`/tasks?projectId=${p.id}&limit=100`);
          const items = res?.data || res?.tasks || [];
          for (const t of items) {
            if (t.status !== 'DONE') {
              tasks.push({ ...t, projectName: p.name, projectId: p.id });
            }
          }
        } catch {}
      }
      return tasks;
    },
    enabled: !!(projectList?.data?.length),
  });

  // ═══ 统计 ═══

  const stats = useMemo((): Stats => {
    if (!allTasks) return { total: 0, overdue: 0, today: 0, thisWeek: 0, doneThisWeek: 0 };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
    return {
      total: allTasks.length,
      overdue: allTasks.filter(t => t.dueDate && new Date(t.dueDate) < today).length,
      today: allTasks.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString()).length,
      thisWeek: allTasks.filter(t => t.dueDate && new Date(t.dueDate) <= weekEnd && new Date(t.dueDate) >= today).length,
      doneThisWeek: 0,
    };
  }, [allTasks]);

  // ═══ 排序 ═══

  const sortedTasks = useMemo(() => {
    if (!allTasks) return [];
    let filtered = allTasks;
    if (filterStatus !== 'all') {
      filtered = allTasks.filter(t => t.status === filterStatus);
    }

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'priority':
          cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
          if (cmp === 0) {
            // 同优先级按截止日期
            cmp = (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity);
          }
          break;
        case 'dueDate':
          cmp = (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity);
          break;
        case 'hours':
          cmp = (a.estimatedHours || 0) - (b.estimatedHours || 0);
          break;
        case 'project':
          cmp = a.projectName.localeCompare(b.projectName);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [allTasks, sortKey, sortAsc, filterStatus]);

  // ═══ 分组 ═══

  const grouped = useMemo(() => {
    const groups: Record<string, TaskItem[]> = {};
    for (const t of sortedTasks) {
      let key: string;
      switch (viewMode) {
        case 'timeline': {
          const today = new Date(); today.setHours(0, 0, 0, 0);
          if (t.dueDate && new Date(t.dueDate) < today) key = '⚠️ 已逾期';
          else if (t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString()) key = '📅 今天';
          else if (t.dueDate) {
            const d = new Date(t.dueDate);
            const wkEnd = new Date(today); wkEnd.setDate(wkEnd.getDate() + 7);
            if (d <= wkEnd) key = '📆 本周';
            else key = '📋 之后';
          } else {
            key = '📋 未排期';
          }
          break;
        }
        case 'priority':
          key = `${PRIORITY_LABEL[t.priority] || t.priority} 优先级`;
          break;
        case 'projects':
          key = t.projectName;
          break;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return groups;
  }, [sortedTasks, viewMode]);

  // ═══ UI ═══

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* 标题栏 */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">排期视图</h1>
          <p className="mt-0.5 text-xs text-slate-400">按优先级和截止日排列所有项目中的任务</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        <StatCard icon={<GripVertical className="h-4 w-4" />} label="全部任务" value={stats.total} color="slate" />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="已逾期" value={stats.overdue} color={stats.overdue > 0 ? 'red' : 'slate'} />
        <StatCard icon={<Calendar className="h-4 w-4" />} label="今天" value={stats.today} color="blue" />
        <StatCard icon={<Flame className="h-4 w-4" />} label="本周内" value={stats.thisWeek} color="amber" />
      </div>

      {/* 工具栏 */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
        {/* 视图切换 */}
        <div className="flex gap-1 rounded-lg bg-slate-50 p-0.5">
          {([
            { key: 'timeline', label: '时间线', icon: Clock },
            { key: 'priority', label: '优先级', icon: Zap },
            { key: 'projects', label: '按项目', icon: Calendar },
          ] as const).map(v => (
            <button key={v.key} onClick={() => setViewMode(v.key)}
              className={cn('flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                viewMode === v.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              <v.icon className="h-3 w-3" />{v.label}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-slate-200" />

        {/* 排序 */}
        <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none focus:border-indigo-300">
          <option value="priority">按优先级</option>
          <option value="dueDate">按截止日期</option>
          <option value="hours">按工时</option>
          <option value="project">按项目</option>
        </select>
        <button onClick={() => setSortAsc(!sortAsc)}
          className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-50" title={sortAsc ? '升序' : '降序'}>
          {sortAsc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
        </button>

        <div className="h-5 w-px bg-slate-200" />

        {/* 状态过滤 */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none focus:border-indigo-300">
          <option value="all">全部状态</option>
          <option value="TODO">待办</option>
          <option value="IN_PROGRESS">进行中</option>
          <option value="BLOCKED">阻塞</option>
          <option value="REVIEW">审查中</option>
        </select>

        <div className="flex-1" />
        <p className="text-[11px] text-slate-400">{sortedTasks.length} 个任务</p>
      </div>

      {/* 任务列表 */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([groupName, tasks]) => (
          <div key={groupName}>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {groupName}
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">{tasks.length}</span>
            </h2>
            <div className="space-y-1">
              {tasks.map(task => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          </div>
        ))}
        {sortedTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 className="h-12 w-12 text-slate-200" />
            <p className="mt-3 text-sm font-medium text-slate-500">所有任务已完成 🎉</p>
            <p className="mt-1 text-xs text-slate-400">没有待处理的任务了</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ 统计卡片 ═══

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number; color: string;
}) {
  const colorMap: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-3.5')}>
      <div className="flex items-center gap-2">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', colorMap[color] || colorMap.slate)}>
          {icon}
        </div>
        <div>
          <p className="text-[11px] text-slate-400">{label}</p>
          <p className="text-lg font-bold text-slate-800">{value}</p>
        </div>
      </div>
    </div>
  );
}

// ═══ 任务行 ═══

function TaskRow({ task }: { task: TaskItem }) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
  return (
    <div className={cn(
      'flex items-center gap-3 rounded-lg border bg-white px-4 py-3 transition-colors hover:border-slate-300',
      isOverdue ? 'border-red-200 bg-red-50/30' : 'border-slate-200',
    )}>
      {/* 优先级色条 */}
      <div className={cn(
        'h-8 w-1 shrink-0 rounded-full',
        task.priority === 'URGENT' ? 'bg-red-500' :
        task.priority === 'HIGH' ? 'bg-orange-500' :
        task.priority === 'MEDIUM' ? 'bg-blue-500' : 'bg-slate-400',
      )} />

      {/* 状态 */}
      <span className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
        task.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
        task.status === 'BLOCKED' ? 'bg-red-100 text-red-700' :
        task.status === 'REVIEW' ? 'bg-purple-100 text-purple-700' :
        'bg-slate-100 text-slate-600',
      )}>
        {STATUS_LABEL[task.status] || task.status}
      </span>

      {/* 标题 */}
      <div className="min-w-0 flex-1">
        <span className={cn('text-sm font-medium', isOverdue ? 'text-red-700' : 'text-slate-800')}>
          {task.title}
        </span>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
          <span>{task.projectName}</span>
          {task.estimatedHours > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <Timer className="h-3 w-3" />
              <span>{task.estimatedHours}h</span>
            </>
          )}
        </div>
      </div>

      {/* 优先级 */}
      <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium', PRIORITY_CLASS[task.priority])}>
        {PRIORITY_LABEL[task.priority]}
      </span>

      {/* 截止日 */}
      <div className={cn(
        'shrink-0 text-right',
        isOverdue ? 'text-red-600 font-semibold' : 'text-slate-500',
      )}>
        <p className="text-xs">{fmtDate(task.dueDate)}</p>
        {task.startDate && (
          <p className="text-[10px] text-slate-400">{fmtDate(task.startDate)} 开始</p>
        )}
      </div>
    </div>
  );
}
