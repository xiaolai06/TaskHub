'use client';

import { cn } from '@/lib/utils';

const priorityConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  URGENT: {
    label: '紧急',
    color: 'text-red-700',
    bg: 'bg-red-50',
    dot: 'bg-red-500',
  },
  HIGH: {
    label: '高',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    dot: 'bg-orange-500',
  },
  MEDIUM: {
    label: '中',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    dot: 'bg-amber-400',
  },
  LOW: {
    label: '低',
    color: 'text-slate-500',
    bg: 'bg-slate-50',
    dot: 'bg-slate-300',
  },
};

interface PriorityBadgeProps {
  priority: string;
  showDot?: boolean;
  className?: string;
}

export function PriorityBadge({ priority, showDot = true, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority] || priorityConfig.MEDIUM;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        config.bg,
        config.color,
        className,
      )}
    >
      {showDot && <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />}
      {config.label}
    </span>
  );
}

/** 获取优先级左边框颜色（用于看板卡片） */
export function getPriorityBorderColor(priority: string): string {
  const map: Record<string, string> = {
    URGENT: 'border-l-red-500',
    HIGH: 'border-l-orange-500',
    MEDIUM: 'border-l-amber-400',
    LOW: 'border-l-slate-300',
  };
  return map[priority] || map.MEDIUM;
}

export { priorityConfig };
