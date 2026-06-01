'use client';

import { useEffect, useRef, useState } from 'react';
import { Archive, Building2, Calendar, DollarSign, Edit3, FolderKanban, MoreVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Project } from '@/hooks/useProjects';

const statusConfig: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: '进行中', color: 'bg-blue-50 text-blue-600' },
  COMPLETED: { label: '已完成', color: 'bg-emerald-50 text-emerald-600' },
  ARCHIVED: { label: '已归档', color: 'bg-slate-100 text-slate-500' },
};

const typeColor: Record<string, string> = {
  开发: 'bg-indigo-50 text-indigo-600',
  设计: 'bg-pink-50 text-pink-600',
  运营: 'bg-emerald-50 text-emerald-600',
  咨询: 'bg-amber-50 text-amber-600',
  维护: 'bg-slate-100 text-slate-600',
  其他: 'bg-gray-100 text-gray-600',
};

function formatMoney(fen: number | null | undefined): string {
  const yuan = (fen ?? 0) / 100;
  return yuan >= 10000 ? `¥${(yuan / 10000).toFixed(1)}w` : `¥${yuan.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
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
  const costCount = project._count?.costRecords ?? 0;
  const quote = project.quote ?? project.budget ?? 0;
  const actualCost = project.actualCost ?? project.usedBudget ?? 0;
  const profit = project.profit ?? quote - actualCost;
  const costPercent = quote > 0 ? Math.min(100, Math.round((actualCost / quote) * 100)) : 0;
  const isCostRisk = quote > 0 && actualCost / quote >= 0.8;
  const isLoss = quote > 0 && actualCost > quote;

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setShowMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="group relative rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
            <FolderKanban className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-800">{project.name}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', status.color)}>{status.label}</span>
              {project.type && (
                <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', typeColor[project.type] || 'bg-gray-100 text-gray-600')}>
                  {project.type}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="rounded-md p-1 text-slate-300 opacity-0 transition-all hover:bg-slate-100 hover:text-slate-500 group-hover:opacity-100"
            aria-label="项目操作"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
              <button type="button" onClick={() => { onEdit?.(project); setShowMenu(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-slate-600 transition-colors hover:bg-slate-50">
                <Edit3 className="h-3.5 w-3.5" />编辑
              </button>
              {project.status !== 'ARCHIVED' && (
                <button type="button" onClick={() => { onArchive?.(project.id); setShowMenu(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-amber-600 transition-colors hover:bg-amber-50">
                  <Archive className="h-3.5 w-3.5" />归档
                </button>
              )}
              <button type="button" onClick={() => { onDelete?.(project.id); setShowMenu(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-red-500 transition-colors hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" />删除
              </button>
            </div>
          )}
        </div>
      </div>

      {project.description && <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-slate-500">{project.description}</p>}

      <div className="mt-3 rounded-lg bg-slate-50 p-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-slate-400">报价</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-700">{formatMoney(quote)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">成本</p>
            <p className={cn('mt-0.5 text-xs font-semibold', isLoss ? 'text-red-600' : 'text-slate-700')}>{formatMoney(actualCost)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">利润</p>
            <p className={cn('mt-0.5 text-xs font-semibold', profit >= 0 ? 'text-emerald-600' : 'text-red-600')}>{formatMoney(profit)}</p>
          </div>
        </div>
        {quote > 0 && (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-white">
              <div className={cn('h-full rounded-full transition-all', isLoss ? 'bg-red-500' : isCostRisk ? 'bg-amber-400' : 'bg-indigo-500')} style={{ width: `${costPercent}%` }} />
            </div>
            <p className="mt-1 text-right text-[10px] text-slate-400">成本占报价 {costPercent}%</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-[12px] text-slate-400">
        {project.customer && (
          <span className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />{project.customer.company || project.customer.name}
          </span>
        )}
        <span className="flex items-center gap-1"><FolderKanban className="h-3.5 w-3.5" />{taskCount} 任务</span>
        <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{costCount} 成本记录</span>
        <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(project.startDate)} - {formatDate(project.endDate)}</span>
      </div>
    </div>
  );
}