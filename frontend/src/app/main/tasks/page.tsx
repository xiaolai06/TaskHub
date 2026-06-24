'use client';

import { Suspense, useMemo, useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
  Loader2, AlertTriangle, CheckSquare, Plus, LayoutList, Columns3,
  CalendarDays, X, Search,
  RefreshCw, WandSparkles, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { CustomSelect } from '@/components/ui/custom-select';
import { DatePicker } from '@/components/ui/date-picker';
import { useTaskList, useCreateTask, useUpdateTask, useUpdateTaskStatus, useDeleteTask } from '@/hooks/useTasks';
import { useProjectList } from '@/hooks/useProjects';
import { useCreateCost } from '@/hooks/useCosts';
import { useRefreshSchedule, useSchedule } from '@/hooks/useSchedule';
import { TaskBoard } from '@/components/features/tasks/TaskBoard';
import { TaskList } from '@/components/features/tasks/TaskList';
import { TaskListSkeleton } from '@/components/features/tasks/TaskListSkeleton';
import { TaskFormContent } from '@/components/features/tasks/TaskForm';
import { TaskDetailSheet } from '@/components/features/tasks/TaskDetailSheet';
import { LeftSidePanel } from '@/components/ui/left-side-panel';
import { CostFormContent } from '@/components/features/costs/CostForm';
import { InsertionDialog } from '@/components/features/schedule/InsertionDialog';
import { GanttMetricCards } from '@/components/features/tasks/GanttMetricCards';
import { GanttContent } from '@/components/features/tasks/GanttContent';
import { toast } from 'sonner';
import type { Task, CreateTaskInput, TaskQueryParams } from '@/hooks/useTasks';
import type { CreateCostInput } from '@/hooks/useCosts';

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

  const [viewMode, setViewMode] = useState<ViewMode>((searchParams.get('view') as ViewMode) || 'board');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  const [datePreset, setDatePreset] = useState('');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [projectFilter, setProjectFilter] = useState(searchParams.get('projectId') || '');
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [costTask, setCostTask] = useState<Task | null>(null);

  const [dailyHourLimit, setDailyHourLimit] = useState(8);
  const [insertionOpen, setInsertionOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

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

  function handleCost(task: Task) {
    setCostTask(task);
  }

  function handleCostSave(id: string, data: { cost: number; costNote?: string }) {
    updateMutation.mutate({ id, data });
  }

  function handleCreateCost(projectId: string, data: CreateCostInput) {
    api.post(`/costs/project/${projectId}`, data).then(() => {
      toast.success('已同步到记账中心');
    }).catch(() => {
      toast.error('同步记账中心失败');
    });
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
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
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

        {!isGantt && (
          <>
            <div className={filterBoxCls}>
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索任务..." className={cn(filterBoxInner, 'w-32 sm:w-64')} />
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

        {isGantt && (
          <div className="flex items-center gap-2">
            <CustomSelect
              value={projectFilter}
              options={[{ value: '', label: '全部项目' }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
              onChange={setProjectFilter}
            />

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

        {!isGantt && (
          <button onClick={() => { setEditTask(null); setShowForm(true); }}
            className="ml-auto flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95 md:px-4">
            <Plus className="h-4 w-4" /><span className="hidden sm:inline">新建任务</span>
          </button>
        )}
      </div>

      {/* 第二行：筛选栏 / 排期关键指标 */}
      {!isGantt ? (
        <div className="flex flex-wrap items-center gap-2">
          <CustomSelect
            value={projectFilter}
            options={[{ value: '', label: '全部项目' }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
            onChange={setProjectFilter}
          />

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

          <div className="flex items-center gap-2">
            <CustomSelect
              value={datePreset}
              options={[
                { value: '', label: '全部日期' },
                { value: 'today', label: '今日' },
                { value: 'week', label: '本周' },
                { value: 'month', label: '本月' },
                { value: 'year', label: '本年' },
                { value: 'custom', label: '自定义' },
              ]}
              onChange={(v) => {
                if (v === 'custom') { setDatePreset('custom'); return; }
                setDatePreset(v);
                const now = new Date();
                const toISO = (d: Date) => d.toISOString().slice(0, 10);
                if (v === '') { setDateFrom(''); setDateTo(''); }
                else if (v === 'today') { const t = toISO(now); setDateFrom(t); setDateTo(t); }
                else if (v === 'week') {
                  const day = now.getDay() || 7;
                  const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
                  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                  setDateFrom(toISO(mon)); setDateTo(toISO(sun));
                } else if (v === 'month') {
                  const first = new Date(now.getFullYear(), now.getMonth(), 1);
                  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                  setDateFrom(toISO(first)); setDateTo(toISO(last));
                } else if (v === 'year') {
                  setDateFrom(`${now.getFullYear()}-01-01`); setDateTo(`${now.getFullYear()}-12-31`);
                }
              }}
              className="w-[110px]"
            />
            {datePreset === 'custom' && (
              <>
                <DatePicker value={dateFrom} onChange={setDateFrom} />
                <DatePicker value={dateTo} onChange={setDateTo} />
              </>
            )}
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
        <TaskListSkeleton />
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

      <LeftSidePanel
        open={showForm}
        onClose={() => { setShowForm(false); setEditTask(null); }}
        title={editTask ? '编辑任务' : '新建任务'}
        subtitle={editTask ? '修改任务信息后将实时更新' : '填写任务信息后创建'}
      >
        <TaskFormContent
          onSubmit={editTask ? handleUpdate : handleCreate}
          onCancel={() => { setShowForm(false); setEditTask(null); }}
          isLoading={createMutation.isPending || updateMutation.isPending}
          editTask={editTask}
          projects={projects}
        />
      </LeftSidePanel>

      <TaskDetailSheet
        task={detailTask}
        open={!!detailTask}
        onClose={() => setDetailTask(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
        onCost={handleCost}
      />

      <LeftSidePanel
        open={!!costTask}
        onClose={() => setCostTask(null)}
        title="快捷记账"
        subtitle={costTask?.title || ''}
        width={380}
      >
        {costTask && (
          <CostFormContent
            task={costTask}
            projectId={costTask.projectId}
            onSave={handleCostSave}
            onCreateCost={(data) => handleCreateCost(costTask.projectId, data)}
            onClose={() => setCostTask(null)}
          />
        )}
      </LeftSidePanel>
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
