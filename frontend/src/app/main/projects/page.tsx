'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle, FolderKanban, Plus, X, Calendar } from 'lucide-react';
import { useProjectList, useCreateProject, useUpdateProject, useDeleteProject, useArchiveProject } from '@/hooks/useProjects';
import { useProjectTasks, useCreateTask, useUpdateTask, useDeleteTask } from '@/hooks/useTasks';
import { ProjectCard } from '@/components/features/projects/ProjectCard';
import { ProjectForm } from '@/components/features/projects/ProjectForm';
import { SubtaskList } from '@/components/features/projects/SubtaskList';
import type { Project, CreateProjectInput, UpdateProjectInput } from '@/hooks/useProjects';
import type { CreateTaskInput } from '@/hooks/useTasks';

export default function ProjectsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  const { data, isLoading, error } = useProjectList({
    status: statusFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();
  const archiveMutation = useArchiveProject();

  const { data: tasks, isLoading: tasksLoading } = useProjectTasks(expandedProjectId || '');
  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();

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
      { id: editProject.id, data: input as UpdateProjectInput },
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

  function toggleExpand(projectId: string) {
    setExpandedProjectId((prev) => (prev === projectId ? null : projectId));
  }

  function handleCreateTask(data: CreateTaskInput) {
    if (!expandedProjectId) return;
    createTaskMutation.mutate({ ...data, projectId: expandedProjectId });
  }

  function handleUpdateTask(id: string, data: Record<string, unknown>) {
    updateTaskMutation.mutate({ id, data: data as never });
  }

  function handleDeleteTask(id: string) {
    deleteTaskMutation.mutate(id);
  }

  const filters = [
    { key: '', label: '全部' },
    { key: 'ACTIVE', label: '进行中' },
    { key: 'COMPLETED', label: '已完成' },
    { key: 'ARCHIVED', label: '已归档' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 状态筛选 */}
        <div className="flex h-10 items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                statusFilter === f.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 日期筛选 */}
        <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5">
          <Calendar className="h-4 w-4 shrink-0 text-slate-500" />
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="w-36 bg-transparent text-sm text-slate-600 outline-none [color-scheme:light]" />
          <span className="text-sm text-slate-300">—</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="w-36 bg-transparent text-sm text-slate-600 outline-none [color-scheme:light]" />
          {(startDate || endDate) && (
            <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-slate-500 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* 新建按钮 */}
        <button
          onClick={() => { setEditProject(null); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          新建项目
        </button>
      </div>

      {/* 内容区 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24">
          <AlertTriangle className="h-10 w-10 text-red-300" />
          <p className="mt-4 text-sm text-red-500">加载项目失败</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-sm font-medium text-indigo-600 hover:underline">重试</button>
        </div>
      ) : !data?.data?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200/60 bg-white py-24 shadow-sm">
          <FolderKanban className="mb-3 h-12 w-12 text-slate-200" />
          <p className="text-sm text-slate-500">
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
            <div key={project.id} className="flex flex-col">
              <div onClick={() => toggleExpand(project.id)} className="cursor-pointer">
                <ProjectCard
                  project={project}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onArchive={handleArchive}
                />
              </div>

              {expandedProjectId === project.id && (
                <div className="mt-2 rounded-xl border border-slate-200/60 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                    <h3 className="text-[13px] font-semibold text-slate-700">任务列表</h3>
                    <button onClick={() => setExpandedProjectId(null)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto p-2">
                    <SubtaskList
                      tasks={tasks || []}
                      projectId={project.id}
                      onCreateSubtask={handleCreateTask}
                      onUpdateTask={handleUpdateTask}
                      onDeleteTask={handleDeleteTask}
                      isLoading={tasksLoading}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 新建/编辑表单 */}
      <ProjectForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditProject(null); }}
        onSubmit={editProject ? handleUpdate : handleCreate}
        isLoading={createMutation.isPending || updateMutation.isPending}
        editProject={editProject}
      />
    </div>
  );
}
