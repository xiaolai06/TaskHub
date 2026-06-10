'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Calendar, MoreVertical, Edit3, Trash2, AlertTriangle,
  FolderKanban, RefreshCw, CheckCircle2, TrendingUp,
} from 'lucide-react';
import type { Goal, MetricType } from '@/hooks/useGoals';

// ═══ 常量 ═══

const typeLabel: Record<string, string> = { MONTHLY: '月度', QUARTERLY: '季度', YEARLY: '年度' };

const metricConfig: Record<MetricType, { label: string; icon: string; desc: string }> = {
  REVENUE: { label: '收入', icon: '💰', desc: '已完成订单回款' },
  PROFIT: { label: '利润', icon: '📈', desc: '收入减去成本' },
  NEW_ORDERS: { label: '新订单', icon: '📦', desc: '新接订单数量' },
  PROJECT_COUNT: { label: '完成项目', icon: '✅', desc: '按时完成项目数' },
  DELIVERY_RATE: { label: '交付率', icon: '🎯', desc: '按时交付比例' },
  MILESTONE: { label: '里程碑', icon: '🏁', desc: '按节点推进' },
};

const statusConfig: Record<string, { label: string; cls: string; dotCls: string }> = {
  ACTIVE: { label: '进行中', cls: 'bg-blue-50 text-blue-600', dotCls: 'bg-blue-500' },
  COMPLETED: { label: '已完成', cls: 'bg-emerald-50 text-emerald-600', dotCls: 'bg-emerald-500' },
  ABANDONED: { label: '已放弃', cls: 'bg-slate-100 text-slate-400', dotCls: 'bg-slate-400' },
  AT_RISK: { label: '落后', cls: 'bg-red-50 text-red-600', dotCls: 'bg-red-500' },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function daysLeft(end: string) {
  return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400000));
}

function formatValue(value: number, metricType: MetricType, unit?: string | null): string {
  if (metricType === 'REVENUE' || metricType === 'PROFIT') {
    return value >= 10000 ? `¥${(value / 10000).toFixed(1)}万` : `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
  }
  if (metricType === 'DELIVERY_RATE') return `${Math.round(value)}%`;
  return `${value}${unit || ''}`;
}

// ═══ Props ═══

interface GoalCardProps {
  goal: Goal;
  onEdit?: (goal: Goal) => void;
  onDelete?: (id: string) => void;
  onCalculate?: (id: string) => void;
}

// ═══ 组件 ═══

export function GoalCard({ goal, onEdit, onDelete, onCalculate }: GoalCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const status = statusConfig[goal.status] || statusConfig.ACTIVE;
  const metric = metricConfig[goal.metricType] || metricConfig.REVENUE;
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

  // 进度条颜色
  const barColor = isComplete ? 'bg-emerald-500' : isAtRisk ? 'bg-red-500' : progress >= 60 ? 'bg-indigo-500' : 'bg-amber-500';

  useEffect(() => {
    if (!showMenu) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showMenu]);

  async function handleCalculate() {
    if (!onCalculate) return;
    setCalculating(true);
    try { await onCalculate(goal.id); } finally { setCalculating(false); }
  }

  return (
    <div className={cn(
      'group rounded-xl border bg-white px-5 py-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
      isComplete ? 'border-slate-100 opacity-60' : isAtRisk ? 'border-red-200 bg-red-50/30' : 'border-slate-200',
    )}>
      {/* 头部：标题 + 状态 + 菜单 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base">{metric.icon}</span>
            <h3 className={cn('truncate text-sm font-semibold', isComplete ? 'text-slate-400 line-through' : 'text-slate-800')}>
              {goal.title}
            </h3>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', status.cls)}>
              {status.label}
            </span>
            {isAtRisk && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
          </div>

          {/* 元信息 */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
            <span>{metric.label} · {typeLabel[goal.type]}</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />{fmtDate(goal.startDate)} → {fmtDate(goal.endDate)}
            </span>
            {!isComplete && (
              <span className={cn('flex items-center gap-1', remaining <= 3 ? 'text-red-500 font-semibold' : '')}>
                剩余 {remaining} 天
              </span>
            )}
            {goal.project && (
              <span className="flex items-center gap-1">
                <FolderKanban className="h-3 w-3" />{goal.project.name}
              </span>
            )}
          </div>
        </div>

        {/* 菜单 */}
        <div className="relative shrink-0" ref={menuRef}>
          <button onClick={() => setShowMenu(!showMenu)}
            className="rounded-md p-1 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-500">
            <MoreVertical className="h-4 w-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-6 z-20 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-xs">
              {goal.progressMode === 'AUTO' && onCalculate && (
                <button onClick={() => { handleCalculate(); setShowMenu(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-slate-50">
                  <RefreshCw className={cn('h-3 w-3', calculating && 'animate-spin')} />一键计算
                </button>
              )}
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

      {/* 进度区域 */}
      <div className="mt-3">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className={cn('text-lg font-bold', isAtRisk ? 'text-red-600' : isComplete ? 'text-emerald-600' : 'text-slate-800')}>
              {formatValue(goal.currentValue, goal.metricType, goal.unit)}
            </span>
            {goal.targetValue != null && (
              <span className="text-xs text-slate-400">
                / {formatValue(goal.targetValue, goal.metricType, goal.unit)}
              </span>
            )}
          </div>
          <span className={cn('text-sm font-bold', isAtRisk ? 'text-red-600' : isComplete ? 'text-emerald-600' : 'text-indigo-600')}>
            {progress}%
          </span>
        </div>

        {/* 进度条 */}
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={cn('h-full rounded-full progress-animate', barColor)}
            style={{ width: `${Math.min(100, progress)}%` }} />
        </div>

        {/* 里程碑进度 */}
        {isMilestone && milestones.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {milestones.map(m => (
              <span key={m.id} className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                m.completed ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500',
              )}>
                {m.completed ? <CheckCircle2 className="h-2.5 w-2.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
                {m.title}
              </span>
            ))}
          </div>
        )}

        {/* 风险提示 */}
        {isAtRisk && !isComplete && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-[11px] text-red-600">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>进度落后预期，{remaining <= 3 ? '时间紧迫，请优先推进' : '建议检查并调整计划'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
