'use client';

import { use, useState } from 'react';
import { Loader2, AlertTriangle, FolderKanban, Plus, CalendarDays, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useProject, useUpdateProject } from '@/hooks/useProjects';
import { useCosts, useCostSummary, useCreateCost, useDeleteCost } from '@/hooks/useCosts';
import { CostForm } from '@/components/features/costs/CostForm';
import { CostList } from '@/components/features/costs/CostList';
import { CostSummary } from '@/components/features/costs/CostSummary';
import { useProjectTasks, useCreateTask, useUpdateTask, useDeleteTask } from '@/hooks/useTasks';
import type { Task, CreateTaskInput } from '@/hooks/useTasks';
import { TaskForm } from '@/components/features/tasks/TaskForm';

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'TODO', label: '待办' },
  { value: 'IN_PROGRESS', label: '进行中' },
  { value: 'DONE', label: '已完成' },
  { value: 'BLOCKED', label: '阻塞' },
];

const priorityLabels: Record<string, string> = {
  URGENT: '紧急', HIGH: '高', MEDIUM: '中', LOW: '低',
};

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);

  const { data: project, isLoading, error } = useProject(projectId);
  const { data: tasks, isLoading: tasksLoading } = useProjectTasks(projectId);
  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();
  const updateProjectMutation = useUpdateProject();
  const { data: costData, isLoading: costsLoading } = useCosts(projectId);
  const { data: costSummary } = useCostSummary(projectId);
  const createCostMutation = useCreateCost(projectId);
  const deleteCostMutation = useDeleteCost(projectId);

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const taskList = tasks || [];
  const filteredTasks = statusFilter
    ? taskList.filter((t) => t.status === statusFilter)
    : taskList;

  function handleCreateTask(input: CreateTaskInput) {
    createTaskMutation.mutate(input, {
      onSuccess: () => { setShowTaskForm(false); toast.success('任务创建成功'); },
      onError: () => toast.error('创建失败'),
    });
  }

  function handleUpdateTask(input: CreateTaskInput) {
    if (!editTask) return;
    updateTaskMutation.mutate(
      { id: editTask.id, data: input },
      {
        onSuccess: () => { setShowTaskForm(false); setEditTask(null); toast.success('任务更新成功'); },
        onError: () => toast.error('更新失败'),
      },
    );
  }

  function handleDeleteTask(id: string) {
    if (confirm('确定要删除这个任务吗？')) {
      deleteTaskMutation.mutate(id, {
        onSuccess: () => toast.success('任务已删除'),
        onError: () => toast.error('删除失败'),
      });
    }
  }

  function handleEditTask(task: Task) {
    setEditTask(task);
    setShowTaskForm(true);
  }

  function handleCloseTaskForm() {
    setShowTaskForm(false);
    setEditTask(null);
  }

  function handleArchiveProject() {
    if (!project) return;
    if (confirm('确定要归档这个项目吗？')) {
      updateProjectMutation.mutate(
        { id: project.id, data: { status: 'ARCHIVED' } as any },
        { onSuccess: () => toast.success('项目已归档'), onError: () => toast.error('归档失败') },
      );
    }
  }

  // ========== 加载态 ==========
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // ========== 错误态 ==========
  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <AlertTriangle className="h-10 w-10 text-red-300" />
        <p className="mt-4 text-sm text-red-500">
          {error instanceof Error ? error.message : '项目不存在或无权访问'}
        </p>
        <Link href="/main/projects">
          <Button variant="outline" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" />返回项目列表</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/main/projects">
            <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />返回</Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">{project.name}</h1>
            <p className="text-sm text-slate-500">{project.description || '暂无描述'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {project.status === 'ACTIVE' && (
            <Button variant="outline" size="sm" onClick={handleArchiveProject}>归档项目</Button>
          )}
          <Link href={`/main/schedule?projectId=${projectId}`}>
            <Button variant="outline" size="sm" className="gap-1">
              <CalendarDays className="h-4 w-4" />排期视图
            </Button>
          </Link>
        </div>
      </div>

      <Separator />

      {/* 项目信息卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatItem label="状态" value={
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            project.status === 'ACTIVE' ? 'bg-blue-50 text-blue-600' :
            project.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
          }`}>
            {project.status === 'ACTIVE' ? '进行中' : project.status === 'COMPLETED' ? '已完成' : '已归档'}
          </span>
        } />
        <StatItem label="日期" value={
          <span className="text-sm text-slate-600">
            {project.startDate ? new Date(project.startDate).toLocaleDateString('zh-CN') : '-'}
            {project.endDate ? ` ~ ${new Date(project.endDate).toLocaleDateString('zh-CN')}` : ''}
          </span>
        } />
        <StatItem label="报价" value={
          <span className="text-sm font-mono text-slate-700">
            {project.budget != null ? `¥${(project.budget / 100).toLocaleString()}` : '-'}
          </span>
        } />
        <StatItem label="任务数" value={
          <span className="text-sm font-mono text-slate-700">{taskList.length} 个</span>
        } />
      </div>


      {/* 订单利润与成本记录 */}
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <CostSummary summary={costSummary} quote={project.budget} />
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-700">成本记录</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CostForm
              isLoading={createCostMutation.isPending}
              onSubmit={(data) => createCostMutation.mutate(data, { onSuccess: () => toast.success('成本已记录'), onError: () => toast.error('记录失败') })}
            />
            <CostList
              records={costData?.data || []}
              isLoading={costsLoading}
              onDelete={(id) => deleteCostMutation.mutate(id, { onSuccess: () => toast.success('成本已删除'), onError: () => toast.error('删除失败') })}
            />
          </CardContent>
        </Card>
      </div>
      {/* 任务列表 */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-700">任务列表</CardTitle>
          <Button size="sm" onClick={() => { setEditTask(null); setShowTaskForm(true); }} className="gap-1">
            <Plus className="h-4 w-4" />新建任务
          </Button>
        </CardHeader>
        <div className="px-6 pb-3 flex items-center gap-1">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === opt.value ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <CardContent className="pt-0">
          {tasksLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <FolderKanban className="h-10 w-10 text-slate-200" />
              <p className="mt-3 text-sm text-slate-500">{statusFilter ? '没有符合筛选条件的任务' : '暂无任务'}</p>
              <p className="mt-1 text-xs text-slate-400">点击上方按钮创建第一个任务</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-slate-50">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <StatusBadge status={task.status} />
                    <span className={`text-sm truncate ${task.status === 'DONE' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                      {task.title}
                    </span>
                    <span className="text-[10px] text-slate-400">{priorityLabels[task.priority] || task.priority}</span>
                    <span className="text-[10px] text-slate-400">{task.estimatedHours}h</span>
                    {task.dueDate && (
                      <span className="text-[10px] text-slate-400">
                        截止 {new Date(task.dueDate).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button onClick={() => handleEditTask(task)}
                      className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600">编辑</button>
                    <button onClick={() => handleDeleteTask(task.id)}
                      className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-500">删除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TaskForm
        open={showTaskForm}
        onClose={handleCloseTaskForm}
        onSubmit={editTask ? handleUpdateTask : handleCreateTask}
        isLoading={createTaskMutation.isPending || updateTaskMutation.isPending}
        editTask={editTask || null}
        projects={project ? [{ id: project.id, name: project.name, status: project.status } as any] : []}
        defaultProjectId={projectId}
      />
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <div className="mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    TODO: { label: '待办', color: 'text-slate-600', bg: 'bg-slate-100' },
    IN_PROGRESS: { label: '进行中', color: 'text-blue-600', bg: 'bg-blue-50' },
    DONE: { label: '已完成', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    BLOCKED: { label: '阻塞', color: 'text-red-600', bg: 'bg-red-50' },
  };
  const c = config[status] || config.TODO;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${c.bg} ${c.color}`}>{c.label}</span>;
}
