'use client';

import { Suspense, useMemo, useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
  Loader2, AlertTriangle, CheckSquare, Plus, LayoutList, Columns3,
  CalendarDays, X, Search, FolderKanban,
  RefreshCw, WandSparkles, Sparkles, CheckCircle2,
  Clock, ListChecks, CalendarX, Timer, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { api } from '@/lib/api';
import { useTaskList, useCreateTask, useUpdateTask, useUpdateTaskStatus, useDeleteTask } from '@/hooks/useTasks';
import { useProjectList } from '@/hooks/useProjects';
import { useRefreshSchedule, useSchedule } from '@/hooks/useSchedule';
import { TaskBoard } from '@/components/features/tasks/TaskBoard';
import { TaskList } from '@/components/features/tasks/TaskList';
import { TaskForm } from '@/components/features/tasks/TaskForm';
import { TaskDetailSheet } from '@/components/features/tasks/TaskDetailSheet';
import { GanttChart } from '@/components/features/schedule/GanttChart';
import { InsertionDialog } from '@/components/features/schedule/InsertionDialog';
import { formatDate } from '@/lib/task-utils';
import { toast } from 'sonner';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import type { Task, CreateTaskInput, TaskQueryParams } from '@/hooks/useTasks';

// ======================== 常量 ========================

type ViewMode = 'board' | 'list' | 'gantt';

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

const filterBoxCls = 'flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-2.5 text-xs transition-all hover:border-indigo-300';
const filterBoxInner = 'border-none bg-transparent text-2xs-plus text-foreground/70 outline-none placeholder:text-muted-foreground/60';
const toolBtnCls = 'h-9 rounded-lg border border-border/80 bg-card px-3 text-sm text-foreground/80 hover:bg-accent hover:border-indigo-300 transition-all inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed';

// ======================== 主页面 ========================

function TasksPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // 视图 & 筛选状态
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

  // 甘特视图专用状态
  const [dailyHourLimit, setDailyHourLimit] = useState(8);
  const [insertionOpen, setInsertionOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // URL 同步
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

  // 数据
  const queryParams: TaskQueryParams = {
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    projectId: projectFilter || undefined,
    search: search || undefined,
    dueDateFrom: dateFrom || undefined,
    dueDateTo: (dateTo || dateFrom) || undefined,
    limit: 200,
  };
  const { data, isLoading, error } = useTaskList(queryParams);
  const { data: projectList } = useProjectList({ limit: 100 });
  const projects = (projectList?.data || []).filter(p => p.status !== 'ARCHIVED');

  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const updateStatusMutation = useUpdateTaskStatus();
  const deleteMutation = useDeleteTask();

  const tasks = data?.data || [];
  const taskCount = tasks.length;
  const hasActiveFilters = statusFilter || priorityFilter || dateFrom || dateTo || search || projectFilter;

  // ---- 甘特视图数据 ----
  // projectFilter 为空 = 全部项目（后端会查所有任务）
  const selectedProject = useMemo(
    () => projectFilter ? projects.find(p => p.id === projectFilter) : undefined,
    [projects, projectFilter],
  );

  const {
    data: schedule,
    isLoading: scheduleLoading,
    isFetching: scheduleFetching,
    error: scheduleError,
  } = useSchedule(projectFilter, dailyHourLimit);
  const refreshSchedule = useRefreshSchedule(projectFilter);

  const applyMutation = useMutation<void, Error>({
    mutationFn: async () => {
      if (!schedule) return;
      await Promise.all(
        schedule.tasks.map(task =>
          api.put(`/tasks/${task.id}`, {
            startDate: new Date(task.scheduledStart).toISOString(),
            dueDate: new Date(task.scheduledEnd).toISOString(),
          }),
        ),
      );
    },
    onSuccess: () => {
      refreshSchedule();
      toast.success('排期已写入任务日期');
    },
  });

  const hasScheduleData = schedule && schedule.tasks.length > 0;

  async function handleAiSchedule() {
    if (projects.length === 0) return;
    setAiLoading(true);
    try {
      const parts = [`请帮我分析项目「${selectedProject?.name || ''}」的排期：`];
      parts.push(`当前每日工时上限 ${dailyHourLimit}h，${schedule?.summary.totalTasks ?? 0} 个任务共 ${schedule?.summary.totalHours ?? 0}h，延期 ${schedule?.summary.delayedTasks ?? 0} 个，冲突 ${schedule?.summary.conflictDays ?? 0} 天。`);
      if (schedule?.tasks?.length) {
        parts.push('\n\n任务清单：');
        for (const t of schedule.tasks) {
          const desc = t.description ? ` — ${t.description.slice(0, 80)}` : '';
          parts.push(`\n- ${t.title}（${t.effectiveHours}h，${t.priority}，${t.scheduledStart}~${t.scheduledEnd}）${desc}`);
        }
      }
      if (selectedProject?.description) {
        parts.push(`\n项目说明：${selectedProject.description}`);
        parts.push('\n请结合项目说明，分析任务拆分是否合理、工时估算是否准确、有没有遗漏的任务。');
      }
      if (!hasScheduleData) {
        parts.push('\n当前没有已记录实际工时的任务，无法自动排期。请根据项目说明，帮我拆解任务并给出排期建议。');
      }
      parts.push('\n请给出具体的排期优化建议，包括哪些任务应该优先、是否需要调整工时上限、预计完成时间是否合理。');
      await api.post('/llm/chat', { message: parts.join('') });
      toast.success('AI 排期建议已生成');
    } catch {
      toast.error('AI 排期请求失败，请检查 AI 配置');
    } finally {
      setAiLoading(false);
    }
  }

  // ---- 操作 ----
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

  // ======================== 渲染 ========================

  const isGantt = viewMode === 'gantt';

  return (
    <div className="flex flex-col gap-3 page-enter">
      {/* 第一行：视图切换 + 工具栏 + 操作按钮 */}
      <div className="flex items-center gap-3">
        {/* 视图切换 — 加大 */}
        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card p-1">
          <button onClick={() => setViewMode('board')}
            className={cn('flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all',
              viewMode === 'board' ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
            <Columns3 className="h-3.5 w-3.5" />看板
          </button>
          <button onClick={() => setViewMode('list')}
            className={cn('flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all',
              viewMode === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
            <LayoutList className="h-3.5 w-3.5" />列表
          </button>
          <button onClick={() => setViewMode('gantt')}
            className={cn('flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all',
              viewMode === 'gantt' ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
            <CalendarDays className="h-3.5 w-3.5" />甘特
          </button>
        </div>

        {/* 看板/列表：搜索框 + 计数 */}
        {!isGantt && (
          <>
            <div className={filterBoxCls}>
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索任务..." className={cn(filterBoxInner, 'w-64')} />
              {search && (
                <button onClick={() => setSearch('')} className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {!isLoading && !error && (
              <span className="shrink-0 text-xs text-muted-foreground">{taskCount} 个任务</span>
            )}
          </>
        )}

        {/* 甘特：排期工具栏 */}
        {isGantt && (
          <div className="flex items-center gap-2">
            <div className={cn(filterBoxCls, 'w-40 overflow-hidden')}>
              <FolderKanban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Select value={projectFilter || 'all_projects_placeholder'} onValueChange={(v) => setProjectFilter(v === 'all_projects_placeholder' ? '' : (v ?? ''))}>
                <SelectTrigger className={cn(filterBoxInner, 'w-full truncate pr-4')}>
                  <SelectValue placeholder="全部项目" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_projects_placeholder">全部项目</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <label className={cn(toolBtnCls, 'cursor-default')}>
              每日
              <input type="number" min={1} max={24} value={dailyHourLimit}
                onChange={(e) => setDailyHourLimit(Number(e.target.value) || 8)}
                className="w-10 border-none bg-transparent text-center outline-none" />
              h
            </label>

            <button onClick={refreshSchedule} disabled={scheduleFetching} className={toolBtnCls}>
              {scheduleFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              重新计算
            </button>

            <button onClick={() => setInsertionOpen(true)} className={toolBtnCls}>
              <WandSparkles className="h-3.5 w-3.5" />插单模拟
            </button>

            <button onClick={handleAiSchedule} disabled={aiLoading || projects.length === 0 || !hasScheduleData}
              className={cn(toolBtnCls, 'text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 font-medium',
                (projects.length === 0 || !hasScheduleData) && 'opacity-50 cursor-not-allowed')}
              title={!hasScheduleData ? '暂无排期数据，请先在任务中填写实际工时' : ''}>
              {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              智能安排
            </button>

            <InsertionDialog projectId={projectFilter || (projects[0]?.id || '')} open={insertionOpen} onOpenChange={setInsertionOpen} />
          </div>
        )}

        {/* 新建任务（甘特模式隐藏） */}
        {!isGantt && (
          <button onClick={() => { setEditTask(null); setShowForm(true); }}
            className="ml-auto flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95">
            <Plus className="h-4 w-4" />新建任务
          </button>
        )}
      </div>

      {/* 第二行：筛选栏（看板/列表） / 排期关键指标（甘特） */}
      {!isGantt ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className={cn(filterBoxCls, 'w-36 overflow-hidden')}>
            <FolderKanban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Select value={projectFilter || 'all_projects_placeholder'} onValueChange={(v) => setProjectFilter(v === 'all_projects_placeholder' ? '' : (v ?? ''))}>
              <SelectTrigger className={cn(filterBoxInner, 'w-full truncate pr-4')}>
                <SelectValue placeholder="全部项目" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_projects_placeholder">全部项目</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex h-9 items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
            {statusFilters.map((f) => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                  statusFilter === f.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex h-9 items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
            {priorityFilters.map((f) => (
              <button key={f.key} onClick={() => setPriorityFilter(f.key)}
                className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                  priorityFilter === f.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <DatePicker value={dateFrom} onChange={setDateFrom} />
            <DatePicker value={dateTo} onChange={setDateTo} />
          </div>

          {hasActiveFilters && (
            <button onClick={clearFilters}
              className="flex h-9 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="h-3 w-3" />清除筛选
            </button>
          )}
        </div>
      ) : schedule ? (
        <GanttMetricCards schedule={schedule} />
      ) : null}

      {/* 内容区 */}
      {isGantt ? (
        <GanttContent
          schedule={schedule}
          scheduleLoading={scheduleLoading}
          scheduleError={scheduleError}
          selectedProject={selectedProject}
          applyMutation={applyMutation}
          projects={projects}
          projectsLoading={!projectList}
          dailyHourLimit={dailyHourLimit}
        />
      ) : isLoading ? (
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

// ======================== 甘特指标卡片 ========================

function GanttMetricCards({ schedule }: { schedule: NonNullable<ReturnType<typeof useSchedule>['data']> }) {
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

// ======================== 甘特内容区 ========================

function GanttContent({
  schedule,
  scheduleLoading,
  scheduleError,
  selectedProject,
  applyMutation,
  projects,
  projectsLoading,
  dailyHourLimit,
}: {
  schedule: ReturnType<typeof useSchedule>['data'];
  scheduleLoading: boolean;
  scheduleError: Error | null;
  selectedProject: { name?: string | null; description?: string | null } | undefined;
  applyMutation: ReturnType<typeof useMutation<void, Error, void>>;
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
      {/* 甘特图头部 + 应用按钮 */}
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

      {/* 甘特图全宽 */}
      <div className="rounded-xl border border-border bg-card p-4">
        <GanttChart tasks={schedule.tasks} dailyWorkload={schedule.dailyWorkload} dailyLimit={dailyHourLimit} />
      </div>
    </div>
  );
}

// ======================== 导出 ========================

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>}>
      <TasksPageContent />
    </Suspense>
  );
}
