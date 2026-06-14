'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ListTodo, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectTasks, type Task } from '@/hooks/useTasks';

interface ProjectItem {
  id: string;
  name: string;
  status: string;
  budget?: number;
  startDate?: string;
}

const statusCN: Record<string, string> = {
  ACTIVE: 'bg-blue-50 text-blue-600',
  COMPLETED: 'bg-emerald-50 text-emerald-600',
  ON_HOLD: 'bg-amber-50 text-amber-600',
  CANCELLED: 'bg-muted text-muted-foreground',
};

const statusLabel: Record<string, string> = {
  ACTIVE: '进行中',
  COMPLETED: '已完成',
  ON_HOLD: '暂停',
  CANCELLED: '取消',
};

const taskStatusDot: Record<string, string> = {
  TODO: 'bg-slate-400',
  IN_PROGRESS: 'bg-blue-500',
  REVIEW: 'bg-amber-500',
  DONE: 'bg-emerald-500',
  BLOCKED: 'bg-red-500',
};

const taskStatusLabel: Record<string, string> = {
  TODO: '待办',
  IN_PROGRESS: '进行中',
  REVIEW: '审核',
  DONE: '完成',
  BLOCKED: '阻塞',
};

interface ProjectMiniListProps {
  projects: ProjectItem[];
  defaultOpen?: boolean;
  onQuickAction?: (text: string) => void;
}

/** 为项目生成快捷提问 */
function getProjectPrompts(projectName: string): { icon: string; label: string; prompt: string }[] {
  return [
    { icon: '📝', label: '项目总结', prompt: `帮我总结「${projectName}」的整体情况，包括进度、成本、风险和下一步建议。` },
    { icon: '📊', label: '进度分析', prompt: `帮我分析「${projectName}」的项目进度，有哪些风险？` },
    { icon: '📋', label: '任务梳理', prompt: `帮我梳理「${projectName}」的待办任务，按优先级排序。` },
    { icon: '💰', label: '成本检查', prompt: `帮我检查「${projectName}」的成本情况，有没有超预算的风险？` },
  ];
}

/** 单个项目的任务列表 */
function ProjectTaskList({ projectId }: { projectId: string }) {
  const { data: tasks, isLoading } = useProjectTasks(projectId);

  if (isLoading) {
    return (
      <div className="space-y-1 px-1 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-6 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <p className="px-1 py-2 text-2xs-plus text-muted-foreground">暂无任务</p>
    );
  }

  // 只显示顶层任务
  const topTasks = tasks.filter((t) => !t.parentId);

  return (
    <div className="space-y-0.5 px-0.5 py-1">
      {topTasks.slice(0, 8).map((task) => (
        <div
          key={task.id}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-background/60"
        >
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', taskStatusDot[task.status] || 'bg-slate-400')} />
          <span className="min-w-0 flex-1 truncate text-2xs-plus text-foreground/70">{task.title}</span>
          <span className="shrink-0 text-2xs text-muted-foreground/50">
            {taskStatusLabel[task.status] || task.status}
          </span>
        </div>
      ))}
      {topTasks.length > 8 && (
        <p className="px-2 py-1 text-2xs text-muted-foreground/50">还有 {topTasks.length - 8} 个任务...</p>
      )}
    </div>
  );
}

export function ProjectMiniList({ projects, defaultOpen = false, onQuickAction }: ProjectMiniListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (projects.length === 0) {
    return (
      <div>
        <p className="mb-2 px-1 text-xs font-bold text-foreground/80">📂 项目</p>
        <div className="py-4 text-center">
          <p className="text-2xs-plus text-muted-foreground">暂无项目</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-1.5 px-1 text-xs font-bold text-foreground/80">
        📂 项目 <span className="ml-1 text-2xs font-normal text-muted-foreground/60">{projects.length}</span>
      </p>

      <div className="space-y-1">
        {projects.slice(0, 6).map((p) => {
          const expanded = expandedId === p.id;
          const prompts = getProjectPrompts(p.name);

          return (
            <div
              key={p.id}
              className={cn(
                'rounded-xl border transition-all',
                expanded ? 'border-indigo-200/60 bg-indigo-50/20 shadow-sm' : 'border-transparent hover:bg-background hover:shadow-sm',
              )}
            >
              {/* 项目标题行 */}
              <button
                onClick={() => setExpandedId(expanded ? null : p.id)}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground/80">{p.name}</p>
                  <p className="mt-0.5 text-2xs text-muted-foreground">
                    {p.budget ? `¥${(p.budget / 100).toLocaleString()}` : ''}
                    {p.budget && p.startDate ? ' · ' : ''}
                    {p.startDate ? p.startDate.slice(0, 10) : ''}
                  </p>
                </div>
                <span className={cn(
                  'shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-medium',
                  statusCN[p.status] || 'bg-muted text-muted-foreground',
                )}>
                  {statusLabel[p.status] || p.status}
                </span>
                <ChevronDown className={cn(
                  'h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform',
                  expanded && 'rotate-180',
                )} />
              </button>

              {/* 展开：任务列表 + 快捷提问 */}
              {expanded && (
                <div className="border-t border-border/30 px-2.5 pb-2.5 pt-1.5">
                  {/* 任务列表 */}
                  <div className="mb-2">
                    <p className="mb-1 flex items-center gap-1 px-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <ListTodo className="h-3 w-3" />任务
                    </p>
                    <ProjectTaskList projectId={p.id} />
                  </div>

                  {/* 项目快捷提问 */}
                  {onQuickAction && (
                    <div>
                      <p className="mb-1 flex items-center gap-1 px-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <Sparkles className="h-3 w-3" />快捷提问
                      </p>
                      <div className="space-y-0.5">
                        {prompts.map((item) => (
                          <button
                            key={item.label}
                            onClick={(e) => { e.stopPropagation(); onQuickAction(item.prompt); }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-2xs-plus text-foreground/60 transition-colors hover:bg-background hover:text-indigo-600"
                          >
                            <span className="text-xs">{item.icon}</span>
                            <span>{item.label}</span>
                            <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground/30" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
