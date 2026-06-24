'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  Plus, Edit3, Trash2, DollarSign, X, CheckSquare,
  ChevronDown, ChevronRight, FileText, FolderKanban, ListTodo, Archive, AlertTriangle,
} from 'lucide-react';
import { CostFormContent } from '@/components/features/costs/CostForm';
import { TaskDetailPanel, Section, InfoChip } from '@/components/features/projects/TaskDetailPanel';
import { LeftSidePanel } from '@/components/ui/left-side-panel';
import { formatCost, PRIORITY_DOT } from '@/lib/task-utils';
import type { Task, CreateTaskInput } from '@/hooks/useTasks';
import type { Project } from '@/hooks/useProjects';
import type { CreateCostInput } from '@/hooks/useCosts';

// ═══ 常量 ═══

type TabKey = 'tasks' | 'info';

const PROJECT_TYPE_LABEL: Record<string, string> = {
  DEVELOPMENT: '开发', DESIGN: '设计', MARKETING: '运营',
  CONSULTING: '咨询', MAINTENANCE: '维护', OTHER: '其他',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '进行中', COMPLETED: '已完成', ARCHIVED: '已归档',
};

// ═══ Props ═══

interface ProjectTaskSheetProps {
  project: Project;
  tasks: Task[];
  open: boolean;
  onClose: () => void;
  onCreateTask: (data: CreateTaskInput) => void;
  onEditTask?: (task: Task) => void;
  onUpdateTask: (id: string, data: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onEditProject: (project: Project) => void;
  onArchiveProject?: (id: string) => void;
  onDeleteProject?: (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
  onCreateCost?: (data: CreateCostInput) => void;
  isLoading?: boolean;
}

// ═══ 主组件 ═══

export function ProjectTaskSheet({
  project, tasks, open, onClose, onCreateTask, onEditTask, onUpdateTask,
  onDeleteTask, onEditProject, onArchiveProject, onDeleteProject,
  onStatusChange, onCreateCost, isLoading,
}: ProjectTaskSheetProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('tasks');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [costTask, setCostTask] = useState<Task | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'archive' | 'delete'; id: string } | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedTaskId(null);
      setActiveTab('tasks');
      setExpandedTasks(new Set());
    }
  }, [project.id, open]);

  if (!open) return null;

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;
  const topLevelTasks = tasks.filter((t) => !t.parentId);
  const totalTasks = topLevelTasks.length;
  const doneTasks = topLevelTasks.filter((t) => t.status === 'DONE').length;

  function toggleExpand(id: string) {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleStatusToggle(task: Task) {
    onStatusChange?.(task.id, task.status === 'DONE' ? 'TODO' : 'DONE');
  }

  function handleCostSave(id: string, data: { cost: number; costNote?: string }) {
    onUpdateTask(id, data);
  }

  return createPortal(
    <>
      {/* 遮罩 */}
      <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet 面板 — 贴边右侧，全视口高度 */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex h-screen w-[1060px] flex-col bg-card shadow-2xl transition-transform duration-300 ease-in-out"
        style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* ── 顶栏 ── */}
        <div className="shrink-0 border-b border-border/60">
          <div className="flex items-center gap-4 px-6 py-3">
            {/* 左：项目信息 */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                <FolderKanban className="h-4 w-4 text-indigo-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground leading-tight">{project.name}</h2>
                <span className="text-2xs text-muted-foreground">
                  {totalTasks} 个任务 · {doneTasks} 已完成
                </span>
              </div>
            </div>

            {/* 中：操作按钮 */}
            <div className="flex items-center gap-1">
              {onArchiveProject && project.status === 'ACTIVE' && (
                <button
                  onClick={() => setConfirmAction({ type: 'archive', id: project.id })}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-amber-50 hover:text-amber-600"
                  title="归档项目"
                >
                  <Archive className="h-3 w-3" />
                  归档
                </button>
              )}
              {onDeleteProject && (
                <button
                  onClick={() => setConfirmAction({ type: 'delete', id: project.id })}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
                  title="删除项目"
                >
                  <Trash2 className="h-3 w-3" />
                  删除
                </button>
              )}
              {activeTab === 'info' && (
                <button
                  onClick={() => onEditProject(project)}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground/70"
                >
                  <Edit3 className="h-3 w-3" />
                  编辑
                </button>
              )}
            </div>

            <div className="flex-1" />

            {/* 右：Tab 切换（蓝色 pill 样式） */}
            <div className="flex h-8 items-center gap-1 rounded-lg border border-border/80 bg-card p-0.5">
              <button
                onClick={() => setActiveTab('tasks')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3.5 py-1 text-xs font-medium transition-all',
                  activeTab === 'tasks'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <ListTodo className="h-3.5 w-3.5" />
                任务
              </button>
              <button
                onClick={() => setActiveTab('info')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3.5 py-1 text-xs font-medium transition-all',
                  activeTab === 'info'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                项目说明
              </button>
            </div>

            {/* 关闭 */}
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground/60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── 内容区 ── */}
        {activeTab === 'tasks' ? (
          <div className="flex flex-1 overflow-hidden">
            {/* 左栏：任务列表 */}
            <div className="flex w-72 shrink-0 flex-col border-r border-border/60 bg-muted/20">
              <div className="shrink-0 px-3 pt-3 pb-2">
                <button
                  onClick={() => {
                    onCreateTask({ title: '__OPEN_FORM__', projectId: project.id } as unknown as CreateTaskInput);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-indigo-300/80 bg-indigo-50/40 px-3 py-1.5 text-xs font-medium text-indigo-600 transition-all hover:border-indigo-400 hover:bg-indigo-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加任务
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-2 pb-3">
                {isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                  </div>
                ) : topLevelTasks.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60">
                      <CheckSquare className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                    <p className="mt-2.5 text-xs font-medium text-muted-foreground/70">暂无任务</p>
                    <p className="mt-0.5 text-2xs text-muted-foreground/40">点击上方按钮添加</p>
                  </div>
                ) : (
                  <div className="space-y-px">
                    {topLevelTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        selected={selectedTaskId === task.id}
                        expanded={expandedTasks.has(task.id)}
                        onSelect={() => setSelectedTaskId(task.id)}
                        onToggleExpand={() => toggleExpand(task.id)}
                        onStatusToggle={() => handleStatusToggle(task)}
                        onEdit={() => onEditTask?.(task)}
                        onCost={() => setCostTask(task)}
                        onDelete={() => setDeleteTaskId(task.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 右栏：任务详情 */}
            <div className="flex-1 overflow-y-auto bg-white">
              {selectedTask ? (
                <TaskDetailPanel task={selectedTask} onStatusChange={onStatusChange} onEditTask={onEditTask} onCostTask={(t) => setCostTask(t)} onDeleteTask={(id) => setDeleteTaskId(id)} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40">
                    <ListTodo className="h-7 w-7 text-muted-foreground/30" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-muted-foreground/60">选择任务查看详情</p>
                  <p className="mt-1 text-xs text-muted-foreground/40">点击左侧任务行即可预览</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <ProjectInfoView project={project} onEdit={() => onEditProject(project)} />
        )}
      </div>

      {/* 记账弹窗 — 左侧面板 */}
      {costTask && (
        <LeftSidePanel
          open={!!costTask}
          onClose={() => setCostTask(null)}
          title="快捷记账"
          subtitle={costTask.title}
          width={380}
        >
          <CostFormContent task={costTask} projectId={project.id} onSave={handleCostSave} onCreateCost={onCreateCost} onClose={() => setCostTask(null)} />
        </LeftSidePanel>
      )}

      {/* 二次确认弹窗 */}
      {confirmAction && (
        <ConfirmDialog
          type={confirmAction.type}
          projectName={project.name}
          onConfirm={() => {
            if (confirmAction.type === 'archive') onArchiveProject?.(confirmAction.id);
            else onDeleteProject?.(confirmAction.id);
            setConfirmAction(null);
            onClose();
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* 任务删除二次确认 */}
      {deleteTaskId && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center" onClick={() => setDeleteTaskId(null)}>
          <div
            className="w-[360px] rounded-xl border border-border bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">删除任务</h3>
                <p className="mt-0.5 text-xs text-muted-foreground truncate max-w-[240px]">
                  {tasks.find(t => t.id === deleteTaskId)?.title || ''}
                </p>
              </div>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-foreground/60">
              确定要删除这个任务吗？关联的子任务和花销记录也会被删除，此操作不可撤销。
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setDeleteTaskId(null)}
                className="h-9 flex-1 rounded-lg border border-border px-4 text-xs font-medium text-foreground/70 transition-colors hover:bg-muted"
              >
                取消
              </button>
              <button
                onClick={() => { onDeleteTask(deleteTaskId); setDeleteTaskId(null); }}
                className="h-9 flex-1 rounded-lg bg-red-500 px-4 text-xs font-medium text-white transition-colors hover:bg-red-600"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

// ═══ 左栏：任务行 ═══

function TaskRow({ task, selected, expanded, onSelect, onToggleExpand, onStatusToggle, onEdit, onCost, onDelete }: {
  task: Task;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onStatusToggle: () => void;
  onEdit: () => void;
  onCost: () => void;
  onDelete: () => void;
}) {
  const children = task.children || [];
  const hasChildren = children.length > 0;
  const doneCount = children.filter((c) => c.status === 'DONE').length;
  const totalCost = (task.cost || 0) + (task.childrenCost || 0);
  const dotColor = PRIORITY_DOT[task.priority] || 'bg-accent';

  return (
    <div>
      <div
        className={cn(
          'group relative flex items-center gap-2 rounded-lg px-2.5 py-[7px] transition-all cursor-pointer',
          selected
            ? 'bg-indigo-50/80 shadow-[inset_2px_0_0_0_theme(colors.indigo.500)]'
            : 'hover:bg-white/80',
        )}
        onClick={onSelect}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            className="shrink-0 text-muted-foreground/50 hover:text-foreground/60"
          >
            {expanded
              ? <ChevronDown className="h-3 w-3" />
              : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        <span className={cn('h-[5px] w-[5px] shrink-0 rounded-full', dotColor)} />

        <span className={cn(
          'flex-1 truncate text-[13px] leading-tight',
          task.status === 'DONE' ? 'text-muted-foreground/60 line-through' : 'text-foreground/80',
        )}>
          {task.title}
        </span>

        <div className="flex shrink-0 items-center gap-1.5">
          {totalCost > 0 && (
            <span className="text-2xs font-medium text-amber-500/80" title={task.costNote || ''}>
              {formatCost(totalCost)}
            </span>
          )}
          {hasChildren && (
            <span className="rounded bg-muted px-1 py-px text-2xs text-muted-foreground/60">
              {doneCount}/{children.length}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-px opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="rounded p-0.5 text-muted-foreground/40 hover:bg-indigo-50 hover:text-indigo-500"
            title="编辑"
          >
            <Edit3 className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCost(); }}
            className="rounded p-0.5 text-muted-foreground/40 hover:bg-amber-50 hover:text-amber-500"
            title="记账"
          >
            <DollarSign className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="rounded p-0.5 text-muted-foreground/40 hover:bg-red-50 hover:text-red-500"
            title="删除"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="ml-5 space-y-px border-l border-border/40 pl-2">
          {children.map((child) => (
            <div
              key={child.id}
              className="group flex items-center gap-1.5 rounded-md px-2 py-[5px] cursor-pointer hover:bg-white/60"
              onClick={onSelect}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onStatusToggle(); }}
                className={cn(
                  'flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border transition-all',
                  child.status === 'DONE'
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-border/60 hover:border-indigo-400',
                )}
              >
                {child.status === 'DONE' && <CheckSquare className="h-2 w-2" />}
              </button>
              <span className={cn(
                'flex-1 truncate text-xs leading-tight',
                child.status === 'DONE' ? 'text-muted-foreground/50 line-through' : 'text-foreground/60',
              )}>
                {child.title}
              </span>
              {child.cost > 0 && (
                <span className="text-2xs text-amber-500/60">{formatCost(child.cost)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══ 项目说明 Tab ═══

function ProjectInfoView({ project, onEdit }: { project: Project; onEdit: () => void }) {
  const quote = project.quote ?? 0;
  const cost = project.actualCost ?? 0;
  const profit = project.profit ?? (quote - cost);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-5 px-8 py-6">
        <Section label="基本信息">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <InfoChip label="类型" value={project.type ? (PROJECT_TYPE_LABEL[project.type] || project.type) : '—'} />
            <InfoChip label="状态" value={STATUS_LABEL[project.status] || project.status} />
            <InfoChip label="客户" value={project.customer?.name || '—'} />
            <InfoChip label="日期" value={`${project.startDate ?? '—'} ~ ${project.endDate ?? '—'}`} />
          </div>
        </Section>

        <Section label="财务概览">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-2.5 text-center">
              <p className="text-2xs font-medium text-indigo-500/80">报价</p>
              <p className="mt-0.5 text-base font-bold text-indigo-700">{formatCost(quote)}</p>
            </div>
            <div className="rounded-lg border border-orange-100 bg-orange-50/40 px-3 py-2.5 text-center">
              <p className="text-2xs font-medium text-orange-500/80">成本</p>
              <p className="mt-0.5 text-base font-bold text-orange-700">{formatCost(cost)}</p>
            </div>
            <div className={cn(
              'rounded-lg border px-3 py-2.5 text-center',
              profit >= 0 ? 'border-emerald-100 bg-emerald-50/40' : 'border-red-100 bg-red-50/40',
            )}>
              <p className={cn('text-2xs font-medium', profit >= 0 ? 'text-emerald-500/80' : 'text-red-500/80')}>利润</p>
              <p className={cn('mt-0.5 text-base font-bold', profit >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                {formatCost(profit)}
              </p>
            </div>
          </div>
        </Section>

        <Section label="项目描述">
          {project.description ? (
            <p className="rounded-lg border border-border/40 bg-muted/20 p-3.5 text-[13px] leading-relaxed text-foreground/65">
              {project.description}
            </p>
          ) : (
            <p className="text-xs italic text-muted-foreground/40">暂无描述</p>
          )}
        </Section>

        {project.expenseNote && (
          <Section label="费用说明">
            <p className="rounded-lg border border-amber-200/50 bg-amber-50/30 p-3.5 text-[13px] leading-relaxed text-foreground/65">
              {project.expenseNote}
            </p>
          </Section>
        )}

        {project.rewardNote && (
          <Section label="奖励说明">
            <p className="rounded-lg border border-emerald-200/50 bg-emerald-50/30 p-3.5 text-[13px] leading-relaxed text-foreground/65">
              {project.rewardNote}
            </p>
          </Section>
        )}

        <div className="flex justify-end pt-1">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground/70"
          >
            <Edit3 className="h-3 w-3" />
            编辑项目信息
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══ 二次确认弹窗 ═══

function ConfirmDialog({ type, projectName, onConfirm, onCancel }: {
  type: 'archive' | 'delete';
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isDelete = type === 'delete';
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center" onClick={onCancel}>
      <div
        className="w-[360px] rounded-xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl',
            isDelete ? 'bg-red-50' : 'bg-amber-50',
          )}>
            <AlertTriangle className={cn('h-5 w-5', isDelete ? 'text-red-500' : 'text-amber-500')} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {isDelete ? '删除项目' : '归档项目'}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{projectName}</p>
          </div>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-foreground/60">
          {isDelete
            ? '确定要删除这个项目吗？关联的所有任务和成本记录也会被永久删除，此操作不可撤销。'
            : '归档后项目将移入"已归档"，可以随时恢复。'}
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="h-9 flex-1 rounded-lg border border-border px-4 text-xs font-medium text-foreground/70 transition-colors hover:bg-muted"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'h-9 flex-1 rounded-lg px-4 text-xs font-medium text-white transition-colors',
              isDelete ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600',
            )}
          >
            {isDelete ? '确认删除' : '确认归档'}
          </button>
        </div>
      </div>
    </div>
  );
}
