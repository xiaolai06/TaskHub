'use client';

import { cn } from '@/lib/utils';
import { Target, TrendingUp, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { GoalOverview as GoalOverviewType } from '@/hooks/useGoals';

interface Props {
  data?: GoalOverviewType;
  isLoading?: boolean;
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

  const { summary } = data;

  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <Target className="h-4 w-4 text-indigo-400 shrink-0" />
      <span className="text-xs font-medium text-slate-600">
        {summary.total} 个目标
      </span>
      <div className="flex items-center gap-2 text-[11px]">
        <span className="flex items-center gap-1 text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          正常 {summary.onTrack}
        </span>
        {summary.atRisk > 0 && (
          <span className="flex items-center gap-1 text-red-500">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            落后 {summary.atRisk}
          </span>
        )}
      </div>
    </div>
  );
}
