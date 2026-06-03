'use client';

import { cn } from '@/lib/utils';
import type { MetricType } from '@/hooks/useGoals';

interface GoalProgressProps {
  current: number;
  target: number;
  metricType?: MetricType;
  unit?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function GoalProgress({
  current,
  target,
  metricType,
  unit,
  showLabel = true,
  size = 'md',
  className,
}: GoalProgressProps) {
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const isComplete = percent >= 100;
  const barHeight = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-mono font-semibold text-foreground/80">
            {formatValue(current, metricType, unit)}{' '}
            <span className="font-normal text-muted-foreground">/ {formatValue(target, metricType, unit)}</span>
          </span>
          <span
            className={cn(
              'font-mono font-semibold',
              isComplete ? 'text-emerald-600' : percent >= 60 ? 'text-indigo-600' : 'text-amber-600',
            )}
          >
            {percent}%
          </span>
        </div>
      )}

      <div className={cn('w-full overflow-hidden rounded-full bg-muted', barHeight)}>
        <div
          className={cn(
            'rounded-full transition-all duration-500',
            barHeight,
            isComplete ? 'bg-emerald-500' : percent >= 60 ? 'bg-indigo-500' : 'bg-amber-500',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function formatValue(value: number, metricType?: MetricType, unit?: string): string {
  if (metricType === 'REVENUE' || metricType === 'PROFIT' || unit === '元') {
    return value >= 10000
      ? `¥${(value / 10000).toFixed(1)}万`
      : `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
  }

  if (metricType === 'DELIVERY_RATE') {
    return `${Math.round(value)}%`;
  }

  if (unit === '小时') {
    return `${value.toFixed(1)}h`;
  }

  return `${value}${unit || ''}`;
}
