'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, AlertTriangle, CheckCircle2, Loader2, Target } from 'lucide-react';
import type { GoalOverview as GoalOverviewType, GoalOverviewItem, MetricType } from '@/hooks/useGoals';

interface Props {
  data?: GoalOverviewType;
  isLoading?: boolean;
}

const metricIcon: Record<MetricType, string> = {
  REVENUE: '💰', PROFIT: '📈', NEW_ORDERS: '📦',
  PROJECT_COUNT: '✅', DELIVERY_RATE: '🎯', MILESTONE: '🏁',
};

function formatProgress(goal: GoalOverviewItem): string {
  if (goal.metricType === 'REVENUE' || goal.metricType === 'PROFIT') {
    const v = goal.currentValue;
    return v >= 10000 ? `¥${(v / 10000).toFixed(1)}万` : `¥${v.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
  }
  if (goal.metricType === 'DELIVERY_RATE') return `${Math.round(goal.currentValue)}%`;
  return `${goal.currentValue}${goal.unit || ''}`;
}

export function GoalOverview({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
        <span className="text-xs text-slate-400">加载中...</span>
      </div>
    );
  }

  if (!data || data.goals.length === 0) return null;

  const { summary, goals } = data;

  // 按风险优先排序：落后 > 进行中 > 正常
  const sorted = [...goals].sort((a, b) => {
    if (a.isAtRisk && !b.isAtRisk) return -1;
    if (!a.isAtRisk && b.isAtRisk) return 1;
    return a.daysLeft - b.daysLeft;
  });

  return (
    <div className="space-y-3">
      {/* 汇总条 */}
      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <Target className="h-4 w-4 text-indigo-400 shrink-0" />
        <span className="text-xs font-medium text-slate-600">{summary.total} 个进行中</span>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1 text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />正常 {summary.onTrack}
          </span>
          {summary.atRisk > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />落后 {summary.atRisk}
            </span>
          )}
        </div>
      </div>

      {/* 目标卡片组 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {sorted.slice(0, 4).map(goal => {
          const progress = goal.targetValue
            ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
            : 0;
          const barColor = goal.isAtRisk ? 'bg-red-500' : progress >= 60 ? 'bg-indigo-500' : 'bg-amber-500';

          return (
            <div key={goal.id} className={cn(
              'rounded-xl border bg-white p-4',
              goal.isAtRisk ? 'border-red-200' : 'border-slate-200',
            )}>
              <div className="flex items-center justify-between">
                <span className="text-sm">{metricIcon[goal.metricType] || '🎯'}</span>
                {goal.isAtRisk ? (
                  <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                    <AlertTriangle className="h-2.5 w-2.5" />落后
                  </span>
                ) : goal.actualProgress >= 100 ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                    <CheckCircle2 className="h-2.5 w-2.5" />达标
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                    <TrendingUp className="h-2.5 w-2.5" />进行中
                  </span>
                )}
              </div>
              <p className="mt-2 truncate text-xs font-medium text-slate-600">{goal.title}</p>
              <p className={cn('mt-1 text-lg font-bold', goal.isAtRisk ? 'text-red-600' : 'text-slate-800')}>
                {formatProgress(goal)}
              </p>
              {goal.targetValue != null && (
                <p className="text-[11px] text-slate-400">
                  目标 {goal.targetValue >= 10000 ? `¥${(goal.targetValue / 10000).toFixed(1)}万` : `${goal.targetValue}${goal.unit || ''}`}
                </p>
              )}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className={cn('h-full rounded-full transition-all', barColor)}
                  style={{ width: `${Math.min(100, progress)}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                {goal.daysLeft > 0 ? `剩余 ${goal.daysLeft} 天` : '已到期'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
