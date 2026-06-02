'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Calendar, MoreVertical, Edit3, Trash2, AlertTriangle,
  FolderKanban, Users, Clock,
} from 'lucide-react';
import { GoalProgress } from './GoalProgress';
import type { Goal } from '@/hooks/useGoals';

// ═══ 常量 ═══

const typeLabel: Record<string, string> = { MONTHLY: '月度', QUARTERLY: '季度', YEARLY: '年度' };

const metricLabel: Record<string, string> = {
  REVENUE: '收入', PROJECT_COUNT: '项目数', CLIENT_COUNT: '客户数',
  HOURS: '工时', PERCENTAGE: '百分比', MILESTONE: '里程碑',
};

const statusConfig: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: '进行中', cls: 'bg-blue-50 text-blue-600' },
  COMPLETED: { label: '已完成', cls: 'bg-emerald-50 text-emerald-500' },
  ABANDONED: { label: '已放弃', cls: 'bg-slate-50 text-slate-400' },
  AT_RISK: { label: '落后', cls: 'bg-red-50 text-red-600' },
};

function fmtDate(d: string) { return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }); }
function daysLeft(end: string) { return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400000)); }

// ═══ Props ═══

interface GoalCardProps {
  goal: Goal;
  onEdit?: (goal: Goal) => void;
  onDelete?: (id: string) => void;
}

// ═══ 组件 ═══

export function GoalCard({ goal, onEdit, onDelete }: GoalCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const status = statusConfig[goal.status] || statusConfig.ACTIVE;
  const isComplete = goal.status === 'COMPLETED';
  const isAtRisk = goal.status === 'AT_RISK';
  const remaining = daysLeft(goal.endDate);
  const isMilestone = goal.metricType === 'MILESTONE';
  const milestones = goal.milestones || [];
  const doneMs = milestones.filter(m => m.completed).length;

  const progress = isMilestone
    ? (milestones.length > 0 ? Math.round(doneMs / milestones.length * 100) : 0)
    : goal.targetValue != null && goal.targetValue > 0
      ? Math.min(100, Math.round(goal.currentValue / goal.targetValue * 100))
      : 0;

  useEffect(() => {
    if (!showMenu) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showMenu]);

  return (
    <div className={cn(
      'group flex items-center gap-4 rounded-xl border bg-white px-4 py-3.5 transition-all hover:shadow-sm',
      isComplete ? 'border-slate-100 opacity-60' : isAtRisk ? 'border-red-200' : 'border-slate-200',
    )}>
      {/* 进度环 */}
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
        <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke="#f1f5f9" strokeWidth="5" />
          <circle cx="24" cy="24" r="20" fill="none"
            stroke={isComplete ? '#10b981' : isAtRisk ? '#ef4444' : '#6366f1'}
            strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${progress * 1.256} 125.6`}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <span className={cn('absolute text-[11px] font-bold',
          isComplete ? 'text-emerald-600' : isAtRisk ? 'text-red-600' : 'text-slate-700')}>
          {progress}%
        </span>
      </div>

      {/* 信息 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className={cn('text-sm font-semibold truncate', isComplete && 'text-slate-400 line-through')}>
            {goal.title}
          </h3>
          <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium', status.cls)}>
            {status.label}
          </span>
          {isAtRisk && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
        </div>

        <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
          <span>{metricLabel[goal.metricType] || '自定义'} · {typeLabel[goal.type]}</span>
          <span className="text-slate-300">·</span>
          <Calendar className="h-3 w-3" />
          <span>{fmtDate(goal.startDate)} → {fmtDate(goal.endDate)}</span>
          {!isComplete && (
            <>
              <span className="text-slate-300">·</span>
              <Clock className="h-3 w-3" />
              <span className={cn(remaining <= 3 && 'text-red-500 font-semibold')}>{remaining} 天</span>
            </>
          )}
          {goal.project && (
            <>
              <span className="text-slate-300">·</span>
              <FolderKanban className="h-3 w-3" />
              <span className="truncate max-w-[100px]">{goal.project.name}</span>
            </>
          )}
        </div>

        {/* 描述：仅非完成态且不拥挤时显示 */}
        {goal.description && !isComplete && (
          <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">{goal.description}</p>
        )}
      </div>

      {/* 菜单 */}
      <div className="relative shrink-0" ref={menuRef}>
        <button onClick={() => setShowMenu(!showMenu)}
          className="rounded-md p-1 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-500">
          <MoreVertical className="h-4 w-4" />
        </button>
        {showMenu && (
          <div className="absolute right-0 top-6 z-20 w-32 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-xs">
            {onEdit && (
              <button onClick={() => { onEdit(goal); setShowMenu(false); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-slate-50">
                <Edit3 className="h-3 w-3" />编辑
              </button>
            )}
            {onDelete && (
              <button onClick={() => { onDelete(goal.id); setShowMenu(false); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-red-500 hover:bg-red-50">
                <Trash2 className="h-3 w-3" />删除
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
