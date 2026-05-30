'use client';

import { cn } from '@/lib/utils';
import { Target, TrendingUp, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { GoalOverview as GoalOverviewType, GoalOverviewItem } from '@/hooks/useGoals';

interface GoalOverviewProps {
  data?: GoalOverviewType;
  isLoading?: boolean;
}

const metricIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  REVENUE: TrendingUp,
  PROJECT_COUNT: Target,
  CLIENT_COUNT: Target,
  HOURS: Target,
  PERCENTAGE: Target,
  MILESTONE: Target,
};

const metricLabel: Record<string, string> = {
  REVENUE: '收入目标',
  PROJECT_COUNT: '项目完成',
  CLIENT_COUNT: '新增客户',
  HOURS: '工时投入',
  PERCENTAGE: '百分比目标',
  MILESTONE: '里程碑目标',
};

export function GoalOverview({ data, isLoading }: GoalOverviewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!data || data.goals.length === 0) {
    return null;
  }

  const { goals, summary } = data;

  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm">
      {/* 标题 + 汇总 */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">活跃目标总览</h2>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-slate-500">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            正常 {summary.onTrack}
          </span>
          {summary.atRisk > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              落后 {summary.atRisk}
            </span>
          )}
          <span className="text-slate-400">共 {summary.total} 个</span>
        </div>
      </div>

      {/* 进度条列表 */}
      <div className="mt-4 space-y-3">
        {goals.map((goal) => (
          <OverviewItem key={goal.id} goal={goal} />
        ))}
      </div>
    </div>
  );
}

function OverviewItem({ goal }: { goal: GoalOverviewItem }) {
  const Icon = metricIcon[goal.metricType] || Target;
  const label = metricLabel[goal.metricType] || goal.title;
  const isComplete = goal.actualProgress >= 100;
  const isAtRisk = goal.isAtRisk;

  return (
    <div className="flex items-center gap-3">
      {/* 图标 */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isComplete
            ? 'bg-emerald-50 text-emerald-600'
            : isAtRisk
              ? 'bg-red-50 text-red-500'
              : 'bg-indigo-50 text-indigo-500',
        )}
      >
        {isComplete ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : isAtRisk ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>

      {/* 信息 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">{label}</span>
          <span className="font-mono text-slate-500">
            {formatProgress(goal)}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                isComplete ? 'bg-emerald-500' : isAtRisk ? 'bg-red-500' : 'bg-indigo-500',
              )}
              style={{ width: `${Math.min(100, goal.actualProgress)}%` }}
            />
          </div>
          <span
            className={cn(
              'w-10 text-right font-mono text-[11px] font-semibold',
              isComplete ? 'text-emerald-600' : isAtRisk ? 'text-red-600' : 'text-indigo-600',
            )}
          >
            {goal.actualProgress}%
          </span>
        </div>
      </div>
    </div>
  );
}

function formatProgress(goal: GoalOverviewItem): string {
  const current = goal.currentValue;
  const target = goal.targetValue ?? 0;
  const unit = goal.unit || '';

  if (unit === '元') {
    const fmt = (v: number) =>
      v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v.toLocaleString();
    return `${fmt(current)} / ${fmt(target)}${unit}`;
  }
  return `${current}${unit} / ${target}${unit}`;
}
