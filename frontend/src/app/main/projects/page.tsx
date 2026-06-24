'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle, FolderKanban, Plus } from 'lucide-react';
import { CustomSelect } from '@/components/ui/custom-select';
import { DatePicker } from '@/components/ui/date-picker';
import { useProjectList, useCreateProject, useUpdateProject, useDeleteProject, useArchiveProject } from '@/hooks/useProjects';
import { useProjectTasks, useCreateTask, useUpdateTask, useUpdateTaskStatus, useDeleteTask } from '@/hooks/useTasks';
import { useCreateCost } from '@/hooks/useCosts';
import { ProjectCard } from '@/components/features/projects/ProjectCard';
import { ProjectListSkeleton } from '@/components/features/projects/ProjectListSkeleton';
import { ProjectFormContent } from '@/components/features/projects/ProjectForm';
import { ProjectTaskSheet } from '@/components/features/projects/ProjectTaskSheet';
import { TaskFormContent } from '@/components/features/tasks/TaskForm';
import { LeftSidePanel } from '@/components/ui/left-side-panel';
import type { Project, CreateProjectInput, UpdateProjectInput } from '@/hooks/useProjects';
import type { Task, CreateTaskInput } from '@/hooks/useTasks';

export default function ProjectsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState('');
  const [sheetProject, setSheetProject] = useState<Project | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);

  const { data, isLoading, error } = useProjectList({
    status: statusFilter || undefined,
    startDate: startDate || undefined,
    endDate: (endDate || startDate) || undefined,
  });
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();
  const archiveMutation = useArchiveProject();

  const { data: tasks, isLoading: tasksLoading } = useProjectTasks(sheetProject?.id || '');
  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const updateStatusMutation = useUpdateTaskStatus();
  const deleteTaskMutation = useDeleteTask();
  const createCostMutation = useCreateCost(sheetProject?.id || '');

  function handleCreate(input: CreateProjectInput) {
    createMutation.mutate(input, { onSuccess: () => setShowForm(false) });
  }

  function handleEdit(project: Project) {
    setEditProject(project);
    setShowForm(true);
  }

  function handleUpdate(input: CreateProjectInput) {
    if (!editProject) return;
    updateMutation.mutate(
      { id: editProject.id, data: input as Partial<CreateProjectInput> },
      { onSuccess: () => { setShowForm(false); setEditProject(null); } },
    );
  }

  function handleDelete(id: string) {
    if (confirm('确定要删除这个项目吗？关联的任务和成本记录也会被删除。')) {
      deleteMutation.mutate(id);
    }
  }

  function handleArchive(id: string) {
    if (confirm('确定要归档这个项目吗？')) {
      archiveMutation.mutate(id);
    }
  }

  function handleOpenSheet(project: Project) {
    setSheetProject(project);
  }

  function handleStatusChange(taskId: string, newStatus: string) {
    updateStatusMutation.mutate({ id: taskId, status: newStatus });
  }

  function handleUpdateTask(id: string, data: Record<string, unknown>) {
    updateTaskMutation.mutate({ id, data: data as never });
  }

  function handleDeleteTask(id: string) {
    deleteTaskMutation.mutate(id);
  }

  function handleEditTask(task: Task) {
    setEditTask(task);
    setShowTaskForm(true);
  }

  function handleUpdateTaskFromForm(data: CreateTaskInput) {
    if (!editTask) return;
    updateTaskMutation.mutate(
      { id: editTask.id, data },
      { onSuccess: () => { setShowTaskForm(false); setEditTask(null); } },
    );
  }

  const filters = [
    { key: '', label: '全部' },
    { key: 'ACTIVE', label: '进行中' },
    { key: 'COMPLETED', label: '已完成' },
    { key: 'ARCHIVED', label: '已归档' },
  ];

  return (
    <div className="flex flex-col gap-4 page-enter">
      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 状态筛选 */}
        <div className="flex h-9 items-center gap-1 rounded-lg border border-border/80 bg-card p-1 transition-all hover:border-indigo-300">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none ${
                statusFilter === f.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 日期筛选 */}
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
              if (v === '') { setStartDate(''); setEndDate(''); }
              else if (v === 'today') { const t = toISO(now); setStartDate(t); setEndDate(t); }
              else if (v === 'week') {
                const day = now.getDay() || 7;
                const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
                const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                setStartDate(toISO(mon)); setEndDate(toISO(sun));
              } else if (v === 'month') {
                const first = new Date(now.getFullYear(), now.getMonth(), 1);
                const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                setStartDate(toISO(first)); setEndDate(toISO(last));
              } else if (v === 'year') {
                setStartDate(`${now.getFullYear()}-01-01`); setEndDate(`${now.getFullYear()}-12-31`);
              }
            }}
            className="w-[110px]"
          />
          {datePreset === 'custom' && (
            <>
              <DatePicker value={startDate} onChange={setStartDate} />
              <DatePicker value={endDate} onChange={setEndDate} />
            </>
          )}
        </div>

        <div className="flex-1" />

        {/* 新建按钮 */}
        <button
          onClick={() => { setEditProject(null); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95 md:px-4"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">新建项目</span>
        </button>
      </div>

      {/* 内容区 */}
      {isLoading ? (
        <ProjectListSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24">
          <AlertTriangle className="h-10 w-10 text-red-300" />
          <p className="mt-4 text-sm text-red-500">加载项目失败</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-sm font-medium text-indigo-600 hover:underline">重试</button>
        </div>
      ) : !data?.data?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card py-24 shadow-sm">
          <FolderKanban className="mb-3 h-12 w-12 text-slate-200" />
          <p className="text-sm text-muted-foreground">
            {statusFilter || startDate || endDate ? '没有符合条件的项目' : '暂无项目'}
          </p>
          {!statusFilter && !startDate && !endDate && (
            <button onClick={() => { setEditProject(null); setShowForm(true); }} className="mt-4 text-sm font-medium text-indigo-600 hover:underline">
              创建第一个项目
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.data.map((project) => (
            <div key={project.id} className="cursor-pointer" onClick={() => handleOpenSheet(project)}>
              <ProjectCard
                project={project}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onArchive={handleArchive}
              />
            </div>
          ))}
        </div>
      )}

      {/* 任务 Sheet 面板 */}
      {sheetProject && (
        <ProjectTaskSheet
          project={sheetProject}
          tasks={tasks || []}
          open={!!sheetProject}
          onClose={() => setSheetProject(null)}
          onCreateTask={(data) => {
            if (data.title === '__OPEN_FORM__') {
              setEditProject(null);
              setShowForm(true);
            } else {
              createTaskMutation.mutate(data);
            }
          }}
          onEditTask={handleEditTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
          onEditProject={(p) => { setEditProject(p); setShowForm(true); }}
          onArchiveProject={handleArchive}
          onDeleteProject={handleDelete}
          onStatusChange={handleStatusChange}
          onCreateCost={(data) => createCostMutation.mutate(data)}
          isLoading={tasksLoading}
        />
      )}

      {/* 新建/编辑订单 — 左侧滑入面板 */}
      <LeftSidePanel
        open={showForm}
        onClose={() => { setShowForm(false); setEditProject(null); }}
        title={editProject ? '编辑订单' : '新建订单'}
        subtitle={editProject ? '修改项目信息后将实时更新' : '填写项目信息后创建'}
      >
        <ProjectFormContent
          onSubmit={editProject ? handleUpdate : handleCreate}
          onCancel={() => { setShowForm(false); setEditProject(null); }}
          isLoading={createMutation.isPending || updateMutation.isPending}
          editProject={editProject}
        />
      </LeftSidePanel>

      {/* 编辑任务 — 左侧滑入面板 */}
      <LeftSidePanel
        open={showTaskForm}
        onClose={() => { setShowTaskForm(false); setEditTask(null); }}
        title="编辑任务"
        subtitle={editTask?.title || '修改任务信息'}
      >
        <TaskFormContent
          onSubmit={handleUpdateTaskFromForm}
          onCancel={() => { setShowTaskForm(false); setEditTask(null); }}
          isLoading={updateTaskMutation.isPending}
          editTask={editTask}
          projects={[]}
        />
      </LeftSidePanel>
    </div>
  );
}
