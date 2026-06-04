'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Loader2, AlertTriangle, CheckSquare, Plus, LayoutList, Columns3,
  CalendarDays, X, Search, FolderKanban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTaskList, useCreateTask, useUpdateTask, useUpdateTaskStatus, useDeleteTask } from '@/hooks/useTasks';
import { useProjectList } from '@/hooks/useProjects';
import { TaskBoard } from '@/components/features/tasks/TaskBoard';
import { TaskList } from '@/components/features/tasks/TaskList';
import { TaskForm } from '@/components/features/tasks/TaskForm';
import { TaskDetailSheet } from '@/components/features/tasks/TaskDetailSheet';
import type { Task, CreateTaskInput, TaskQueryParams } from '@/hooks/useTasks';

type ViewMode = 'board' | 'list';

const statusFilters = [
  { key: '', label: '全部' },
  { key: 'TODO', label: '待办' },
  { key: 'IN_PROGRESS', label: '进行中' },
  { key: 'DONE', label: '已完成' },
  { key: 'BLOCKED', label: '阻塞' },
];

const priorityFilters = [
  { key: '', label: '全部' },
  { key: 'URGENT', label: '紧急' },
  { key: 'HIGH', label: '高' },
  { key: 'MEDIUM', label: '中' },
  { key: 'LOW', label: '低' },
];

// 统一的筛选组件样式
const filterBoxCls = 'flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs';
const filterChipCls = (active: boolean) =>
  cn('rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all',
    active ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent');
const filterBoxInner = 'border-none bg-transparent text-[11px] text-foreground/70 outline-none placeholder:text-muted-foreground';

function TasksPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [viewMode, setViewMode] = useState<ViewMode>((searchParams.get('view') as ViewMode) || 'board');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [projectFilter, setProjectFilter] = useState(searchParams.get('projectId') || '');
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (viewMode !== 'board') sp.set('view', viewMode);
    if (statusFilter) sp.set('status', statusFilter);
    if (priorityFilter) sp.set('priority', priorityFilter);
    if (dateFrom) sp.set('dateFrom', dateFrom);
    if (dateTo) sp.set('dateTo', dateTo);
    if (search) sp.set('search', search);
    if (projectFilter) sp.set('projectId', projectFilter);
    const qs = sp.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [viewMode, statusFilter, priorityFilter, dateFrom, dateTo, search, projectFilter, pathname, router]);

  const queryParams: TaskQueryParams = {
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    projectId: projectFilter || undefined,
    search: search || undefined,
    dueDateFrom: dateFrom || undefined,
    dueDateTo: dateTo || undefined,
    limit: 200,
  };

  const { data, isLoading, error } = useTaskList(queryParams);
  const { data: projectList } = useProjectList({ limit: 100 });

  // 过滤掉已归档的项目
  const projects = (projectList?.data || []).filter(p => p.status !== 'ARCHIVED');

  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const updateStatusMutation = useUpdateTaskStatus();
  const deleteMutation = useDeleteTask();

  const tasks = data?.data || [];
  const taskCount = tasks.length;
  const hasActiveFilters = statusFilter || priorityFilter || dateFrom || dateTo || search || projectFilter;

  function handleCreate(input: CreateTaskInput) {
    createMutation.mutate(input, {
      onSuccess: () => { setShowForm(false); setEditTask(null); },
    });
  }

  function handleUpdate(input: CreateTaskInput) {
    if (!editTask) return;
    updateMutation.mutate(
      { id: editTask.id, data: input },
      { onSuccess: () => { setShowForm(false); setEditTask(null); } },
    );
  }

  function handleEdit(task: Task) {
    setEditTask(task);
    setShowForm(true);
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id);
    setDetailTask(null);
  }

  function handleStatusChange(taskId: string, newStatus: string) {
    updateStatusMutation.mutate({ id: taskId, status: newStatus });
  }

  function handleCardClick(task: Task) {
    setDetailTask(task);
  }

  function clearFilters() {
    setStatusFilter(''); setPriorityFilter(''); setDateFrom(''); setDateTo('');
    setSearch(''); setProjectFilter('');
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 第一行：看板/列表 + 搜索框（长） + 任务数 + 新建 */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-36 shrink-0 items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
          <button onClick={() => setViewMode('board')}
            className={cn('flex h-full items-center gap-1 rounded-md px-3 text-xs font-medium transition-all',
              viewMode === 'board' ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
            <Columns3 className="h-3.5 w-3.5" />看板
          </button>
          <button onClick={() => setViewMode('list')}
            className={cn('flex h-full items-center gap-1 rounded-md px-3 text-xs font-medium transition-all',
              viewMode === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
            <LayoutList className="h-3.5 w-3.5" />列表
          </button>
        </div>

        <div className={filterBoxCls}>
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索任务..." className={cn(filterBoxInner, 'w-72')} />
          {search && (
            <button onClick={() => setSearch('')} className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {!isLoading && !error && (
          <span className="shrink-0 text-xs text-muted-foreground">{taskCount} 个任务</span>
        )}

        <button onClick={() => { setEditTask(null); setShowForm(true); }}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95">
          <Plus className="h-4 w-4" />新建任务
        </button>
      </div>

      {/* 第二行：项目 + 状态 + 优先级 + 日期 + 清除 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className={cn(filterBoxCls, 'w-36')}>
          <FolderKanban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
            className={cn(filterBoxInner, 'pr-1')}>
            <option value="">全部项目</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="flex h-9 items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
          {statusFilters.map((f) => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={cn('flex h-full items-center rounded-md px-2.5 text-[11px] font-medium transition-all',
                statusFilter === f.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex h-9 items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
          {priorityFilters.map((f) => (
            <button key={f.key} onClick={() => setPriorityFilter(f.key)}
              className={cn('flex h-full items-center rounded-md px-2.5 text-[11px] font-medium transition-all',
                priorityFilter === f.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
              {f.label}
            </button>
          ))}
        </div>

        <div className={filterBoxCls}>
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className={cn(filterBoxInner, 'w-[120px] rounded-md border border-transparent px-1.5 py-0.5 hover:border-border hover:bg-accent/50 focus:border-indigo-300 focus:bg-card transition-colors cursor-pointer')} />
          <span className="text-[11px] text-muted-foreground/40">-</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className={cn(filterBoxInner, 'w-[120px] rounded-md border border-transparent px-1.5 py-0.5 hover:border-border hover:bg-accent/50 focus:border-indigo-300 focus:bg-card transition-colors cursor-pointer')} />
        </div>

        {hasActiveFilters && (
          <button onClick={clearFilters}
            className="flex h-9 items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-3 w-3" />清除筛选
          </button>
        )}
      </div>

      {/* 内容区 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24">
          <AlertTriangle className="h-10 w-10 text-red-300" />
          <p className="mt-4 text-sm text-red-500">加载任务失败</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-sm font-medium text-indigo-600 hover:underline">重试</button>
        </div>
      ) : taskCount === 0 && !hasActiveFilters ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card py-24 shadow-sm">
          <CheckSquare className="mb-3 h-12 w-12 text-slate-200" />
          <p className="text-sm font-medium text-muted-foreground">暂无任务</p>
          <button onClick={() => { setEditTask(null); setShowForm(true); }}
            className="mt-4 text-sm font-medium text-indigo-600 hover:underline">创建第一个任务</button>
        </div>
      ) : taskCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card py-20">
          <CheckSquare className="mb-3 h-10 w-10 text-slate-200" />
          <p className="text-sm text-muted-foreground">没有匹配的任务</p>
          <button onClick={clearFilters} className="mt-3 text-sm font-medium text-indigo-600 hover:underline">清除筛选</button>
        </div>
      ) : viewMode === 'board' ? (
        <TaskBoard tasks={tasks} onStatusChange={handleStatusChange} onEdit={handleEdit} onDelete={handleDelete} onClick={handleCardClick} />
      ) : (
        <TaskList tasks={tasks} onEdit={handleEdit} onDelete={handleDelete} onStatusChange={handleStatusChange} />
      )}

      <TaskForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditTask(null); }}
        onSubmit={editTask ? handleUpdate : handleCreate}
        isLoading={createMutation.isPending || updateMutation.isPending}
        editTask={editTask}
        projects={projects}
      />

      <TaskDetailSheet
        task={detailTask}
        open={!!detailTask}
        onClose={() => setDetailTask(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>}>
      <TasksPageContent />
    </Suspense>
  );
}
