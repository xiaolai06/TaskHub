'use client';

import { useEffect, useRef, useState } from 'react';
import { Archive, Building2, Calendar, DollarSign, Edit3, FolderKanban, MoreVertical, Trash2, TrendingUp } from 'lucide-react';
import type { Project } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: '进行中', color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' },
  COMPLETED: { label: '已完成', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' },
  ARCHIVED: { label: '已归档', color: 'bg-muted text-muted-foreground' },
};

const typeColor: Record<string, string> = {
  开发: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400',
  设计: 'bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400',
  运营: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  咨询: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  维护: 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300',
  其他: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function formatMoney(fen: number | null | undefined): string {
  const value = fen ?? 0;
  const yuan = value / 100;
  if (yuan >= 10000) return `¥${(yuan / 10000).toFixed(1)}w`;
  return `¥${yuan.toLocaleString('zh-CN')}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

interface ProjectCardProps {
  project: Project;
  onEdit?: (project: Project) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
}

export function ProjectCard({ project, onEdit, onDelete, onArchive }: ProjectCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const status = statusConfig[project.status] || statusConfig.ACTIVE;
  const taskCount = project._count?.tasks ?? 0;
  const quote = project.quote ?? project.budget ?? 0;
  const cost = project.actualCost ?? project.usedBudget ?? 0;
  const profit = project.profit ?? (quote - cost);
  const costRatio = quote > 0 ? Math.min(100, Math.round((cost / quote) * 100)) : 0;
  const costRisk = quote > 0 && cost >= quote * 0.8;

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="group relative rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-200 hover:border-border hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/40">
            <FolderKanban className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{project.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', status.color)}>
                {status.label}
              </span>
              {project.type ? (
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                  typeColor[project.type] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                )}>
                  {project.type}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu((value) => !value)}
            className="rounded-md p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-muted hover:text-muted-foreground group-hover:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {showMenu ? (
            <div className="absolute right-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
              <button
                type="button"
                onClick={() => {
                  onEdit?.(project);
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-foreground/70 transition-colors hover:bg-muted"
              >
                <Edit3 className="h-3.5 w-3.5" />
                编辑
              </button>
              {project.status !== 'ARCHIVED' ? (
                <button
                  type="button"
                  onClick={() => {
                    onArchive?.(project.id);
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-amber-600 transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  <Archive className="h-3.5 w-3.5" />
                  归档
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  onDelete?.(project.id);
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {project.description ? (
        <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {project.description}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-muted/50 px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">报价</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{formatMoney(quote)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">成本</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{formatMoney(cost)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">利润</p>
          <p className={cn('mt-1 text-sm font-semibold', profit >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {formatMoney(profit)}
          </p>
        </div>
      </div>

      {quote > 0 ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">成本占报价</span>
            <span className={cn('font-medium', costRisk ? 'text-red-500' : 'text-muted-foreground')}>
              {costRatio}%
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full progress-animate',
                cost >= quote ? 'bg-red-500' : costRisk ? 'bg-amber-400' : 'bg-indigo-400',
              )}
              style={{ width: `${costRatio}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-[12px] text-muted-foreground">
        {project.customer ? (
          <span className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {project.customer.company || project.customer.name}
          </span>
        ) : null}
        <span className="flex items-center gap-1">
          <FolderKanban className="h-3.5 w-3.5" />
          {taskCount} 个任务
        </span>
        <span className="flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5" />
          {profit >= 0 ? '盈利中' : '需控成本'}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(project.startDate)} - {formatDate(project.endDate)}
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="h-3.5 w-3.5" />
          报价 {formatMoney(quote)}
        </span>
      </div>
    </div>
  );
}
