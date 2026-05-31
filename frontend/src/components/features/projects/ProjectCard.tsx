'use client';

import { cn } from '@/lib/utils';
import { FolderKanban, Calendar, DollarSign, MoreVertical, Trash2, Edit3, Archive, Building2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { Project } from '@/hooks/useProjects';

const statusConfig: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: '进行中', color: 'bg-blue-50 text-blue-600' },
  COMPLETED: { label: '已完成', color: 'bg-emerald-50 text-emerald-600' },
  ARCHIVED: { label: '已归档', color: 'bg-slate-100 text-slate-500' },
};

const typeColor: Record<string, string> = {
  '开发': 'bg-indigo-50 text-indigo-600',
  '设计': 'bg-pink-50 text-pink-600',
  '运营': 'bg-emerald-50 text-emerald-600',
  '咨询': 'bg-amber-50 text-amber-600',
  '维护': 'bg-slate-100 text-slate-600',
  '其他': 'bg-gray-100 text-gray-600',
};

function formatBudget(fen: number | null | undefined): string {
  if (!fen) return '¥0';
  const yuan = fen / 100;
  return yuan >= 10000 ? `¥${(yuan / 10000).toFixed(1)}w` : `¥${yuan.toLocaleString()}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
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
  const budgetPercent = project.budget && project.budget > 0
    ? Math.min(100, Math.round((project.usedBudget / project.budget) * 100))
    : 0;
  const isOverBudget = project.budget && project.usedBudget > project.budget;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="group relative rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
            <FolderKanban className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{project.name}</h3>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', status.color)}>
                {status.label}
              </span>
              {project.type && (
                <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', typeColor[project.type] || 'bg-gray-100 text-gray-600')}>
                  {project.type}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 操作菜单 */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="rounded-md p-1 text-slate-300 opacity-0 transition-all hover:bg-slate-100 hover:text-slate-500 group-hover:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
              <button
                onClick={() => { onEdit?.(project); setShowMenu(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-slate-600 transition-colors hover:bg-slate-50"
              >
                <Edit3 className="h-3.5 w-3.5" />编辑
              </button>
              {project.status !== 'ARCHIVED' && (
                <button
                  onClick={() => { onArchive?.(project.id); setShowMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-amber-600 transition-colors hover:bg-amber-50"
                >
                  <Archive className="h-3.5 w-3.5" />归档
                </button>
              )}
              <button
                onClick={() => { onDelete?.(project.id); setShowMenu(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-red-500 transition-colors hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />删除
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 描述 */}
      {project.description && (
        <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-slate-500">
          {project.description}
        </p>
      )}

      {/* 预算进度条 */}
      {project.budget && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">预算使用</span>
            <span className={cn('font-medium', isOverBudget ? 'text-red-500' : 'text-slate-500')}>
              {formatBudget(project.usedBudget)} / {formatBudget(project.budget)}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn('h-full rounded-full transition-all', isOverBudget ? 'bg-red-400' : budgetPercent >= 80 ? 'bg-amber-400' : 'bg-indigo-400')}
              style={{ width: `${budgetPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* 底部信息 */}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-[12px] text-slate-400">
        {project.customer && (
          <span className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {project.customer.company || project.customer.name}
          </span>
        )}
        <span className="flex items-center gap-1">
          <FolderKanban className="h-3.5 w-3.5" />
          {taskCount} 任务
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="h-3.5 w-3.5" />
          {formatBudget(project.usedBudget)} 已用
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(project.startDate)} — {formatDate(project.endDate)}
        </span>
      </div>
    </div>
  );
}
