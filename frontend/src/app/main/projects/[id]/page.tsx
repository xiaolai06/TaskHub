'use client';

import { use, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  FolderKanban,
  Loader2,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CostForm } from '@/components/features/costs/CostForm';
import { CostList } from '@/components/features/costs/CostList';
import { CostSummary } from '@/components/features/costs/CostSummary';
import { TaskForm } from '@/components/features/tasks/TaskForm';
import { useCostSummary, useCosts, useCreateCost, useDeleteCost } from '@/hooks/useCosts';
import { useProject, useArchiveProject } from '@/hooks/useProjects';
import { useCreateTask, useDeleteTask, useProjectTasks, useUpdateTask } from '@/hooks/useTasks';
import type { CreateTaskInput, Task } from '@/hooks/useTasks';

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'TODO', label: '待办' },
  { value: 'IN_PROGRESS', label: '进行中' },
  { value: 'DONE', label: '已完成' },
  { value: 'BLOCKED', label: '阻塞' },
];

const priorityLabels: Record<string, string> = {
  URGENT: '紧急',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

function formatMoney(fen: number | null | undefined): string {
  if (fen == null) return '-';
  return `¥${(fen / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
  const start = startDate ? new Date(startDate).toLocaleDateString('zh-CN') : '-';
  const end = endDate ? new Date(endDate).toLocaleDateString('zh-CN') : '';
  return end ? `${start} ~ ${end}` : start;
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);

  const { data: project, isLoading, error } = useProject(projectId);
  const { data: tasks, isLoading: tasksLoading } = useProjectTasks(projectId);
  const { data: costData, isLoading: costsLoading } = useCosts(projectId);
  const { data: costSummary } = useCostSummary(projectId);

  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();
  const archiveProjectMutation = useArchiveProject();
  const createCostMutation = useCreateCost(projectId);
  const deleteCostMutation = useDeleteCost(projectId);

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const taskList = tasks || [];
  const filteredTasks = statusFilter
    ? taskList.filter((task) => task.status === statusFilter)
    : taskList;

  function handleCreateTask(input: CreateTaskInput) {
    createTaskMutation.mutate(input, {
      onSuccess: () => {
        setShowTaskForm(false);
        toast.success('任务创建成功');
      },
      onError: () => toast.error('任务创建失败'),
    });
  }

  function handleUpdateTask(input: CreateTaskInput) {
    if (!editTask) return;

    updateTaskMutation.mutate(
      { id: editTask.id, data: input },
      {
        onSuccess: () => {
          setShowTaskForm(false);
          setEditTask(null);
          toast.success('任务更新成功');
        },
        onError: () => toast.error('任务更新失败'),
      },
    );
  }

  function handleDeleteTask(id: string) {
    if (!confirm('确定要删除这个任务吗？')) return;

    deleteTaskMutation.mutate(id, {
      onSuccess: () => toast.success('任务已删除'),
      onError: () => toast.error('任务删除失败'),
    });
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
    if (!confirm('确定要归档这个项目吗？归档后不会删除数据。')) return;

    archiveProjectMutation.mutate(project.id, {
      onSuccess: () => toast.success('项目已归档'),
      onError: () => toast.error('项目归档失败'),
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <AlertTriangle className="h-10 w-10 text-red-300" />
        <p className="mt-4 text-sm text-red-500">
          {error instanceof Error ? error.message : '项目不存在或无权访问'}
        </p>
        <Link href="/main/projects">
          <Button variant="outline" className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" />
            返回项目列表
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/main/projects">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-foreground">{project.name}</h1>
            <p className="text-sm text-muted-foreground">{project.description || '暂无项目说明'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {project.status === 'ACTIVE' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleArchiveProject}
              disabled={archiveProjectMutation.isPending}
            >
              归档项目
            </Button>
          )}
          <Link href={`/main/schedule?projectId=${projectId}`}>
            <Button variant="outline" size="sm" className="gap-1">
              <CalendarDays className="h-4 w-4" />
              排期视图
            </Button>
          </Link>
        </div>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-4">
        <StatItem
          label="状态"
          value={
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                project.status === 'ACTIVE'
                  ? 'bg-blue-50 text-blue-600'
                  : project.status === 'COMPLETED'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {project.status === 'ACTIVE'
                ? '进行中'
                : project.status === 'COMPLETED'
                  ? '已完成'
                  : '已归档'}
            </span>
          }
        />
        <StatItem label="日期" value={<span className="text-sm text-foreground/80">{formatDateRange(project.startDate, project.endDate)}</span>} />
        <StatItem label="报价" value={<span className="text-sm font-mono text-foreground/80">{formatMoney(project.budget)}</span>} />
        <StatItem label="任务数" value={<span className="text-sm font-mono text-foreground/80">{taskList.length} 项</span>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <CostSummary summary={costSummary} quote={project.budget} />

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground">成本记录</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CostForm
              isLoading={createCostMutation.isPending}
              onSubmit={(data) =>
                createCostMutation.mutate(data, {
                  onSuccess: () => toast.success('成本已记录'),
                  onError: () => toast.error('成本记录失败'),
                })
              }
            />
            <CostList
              records={costData?.data || []}
              isLoading={costsLoading}
              onDelete={(id) =>
                deleteCostMutation.mutate(id, {
                  onSuccess: () => toast.success('成本已删除'),
                  onError: () => toast.error('删除失败'),
                })
              }
            />
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold text-foreground">任务列表</CardTitle>
          <Button
            size="sm"
            className="gap-1"
            onClick={() => {
              setEditTask(null);
              setShowTaskForm(true);
            }}
          >
            <Plus className="h-4 w-4" />
            新建任务
          </Button>
        </CardHeader>

        <div className="flex flex-wrap items-center gap-1 px-6 pb-3">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setStatusFilter(option.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === option.value
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <CardContent className="pt-0">
          {tasksLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <FolderKanban className="h-10 w-10 text-slate-200" />
              <p className="mt-3 text-sm text-muted-foreground">
                {statusFilter ? '没有符合筛选条件的任务' : '当前项目还没有任务'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">先建立任务，再进入排期与执行闭环</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-accent"
                >
                  <div className="min-w-0 flex flex-1 items-center gap-3">
                    <StatusBadge status={task.status} />
                    <span
                      className={`truncate text-sm ${
                        task.status === 'DONE' ? 'line-through text-muted-foreground' : 'text-foreground/80'
                      }`}
                    >
                      {task.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {priorityLabels[task.priority] || task.priority}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{task.estimatedHours}h</span>
                    {task.dueDate && (
                      <span className="text-[10px] text-muted-foreground">
                        截止 {new Date(task.dueDate).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                  </div>

                  <div className="ml-2 flex items-center gap-1">
                    <button
                      onClick={() => handleEditTask(task)}
                      className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-red-50 hover:text-red-500"
                    >
                      删除
                    </button>
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
        editTask={editTask}
        projects={project ? ([project] as never) : []}
        defaultProjectId={projectId}
      />
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    TODO: { label: '待办', color: 'text-foreground/70', bg: 'bg-muted' },
    IN_PROGRESS: { label: '进行中', color: 'text-blue-600', bg: 'bg-blue-50' },
    DONE: { label: '已完成', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    BLOCKED: { label: '阻塞', color: 'text-red-600', bg: 'bg-red-50' },
  };

  const current = config[status] || config.TODO;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${current.bg} ${current.color}`}
    >
      {current.label}
    </span>
  );
}
