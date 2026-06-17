'use client';

import { cn } from '@/lib/utils';
import type { Goal } from '@/hooks/useGoals';
import { GoalCard } from './GoalCard';

interface GoalBoardProps {
  goals: Goal[];
  onEdit?: (goal: Goal) => void;
  onDelete?: (id: string) => void;
  onCalculate?: (id: string) => void;
}

function daysLeft(end: string) {
  return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400000));
}

export function GoalBoard({ goals, onEdit, onDelete, onCalculate }: GoalBoardProps) {
  const active = goals.filter(g => g.status === 'ACTIVE' && daysLeft(g.endDate) > 7);
  const urgent = goals.filter(g => g.status === 'ACTIVE' && daysLeft(g.endDate) <= 7);
  const atRisk = goals.filter(g => g.status === 'AT_RISK');
  const completed = goals.filter(g => g.status === 'COMPLETED');

  const stats = [
    { label: '全部', value: goals.length, cls: 'text-foreground' },
    { label: '进行中', value: active.length, cls: 'text-blue-600' },
    { label: '即将到期', value: urgent.length, cls: 'text-amber-600' },
    { label: '有风险', value: atRisk.length, cls: 'text-red-600' },
    { label: '已完成', value: completed.length, cls: 'text-emerald-600' },
  ];

  const columns = [
    { key: 'active', label: '📋 进行中', goals: active, color: 'border-blue-200 bg-blue-50/30' },
    { key: 'urgent', label: '⏰ 即将到期', goals: [...urgent, ...atRisk], color: 'border-amber-200 bg-amber-50/30' },
    { key: 'completed', label: '✅ 已完成', goals: completed, color: 'border-emerald-200 bg-emerald-50/30' },
  ];

  return (
    <div className="space-y-4">
      {/* 统计条 */}
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-3">
        {stats.map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className={cn('text-lg font-bold', s.cls)}>{s.value}</span>
            <span className="text-2xs text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      {/* 看板列 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {columns.map(col => (
          <div key={col.key} className="space-y-3">
            <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', col.color)}>
              <span className="text-sm font-semibold">{col.label}</span>
              <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
                {col.goals.length}
              </span>
            </div>
            {col.goals.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground/50">暂无目标</p>
            )}
            {col.goals.map(goal => (
              <GoalCard key={goal.id} goal={goal} onEdit={onEdit} onDelete={onDelete} onCalculate={onCalculate} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
