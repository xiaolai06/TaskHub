'use client';

import { cn } from '@/lib/utils';
import { Clock, Play, CheckCircle2, Ban } from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  TODO: {
    label: '待办',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    icon: Clock,
  },
  IN_PROGRESS: {
    label: '进行中',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    icon: Play,
  },
  DONE: {
    label: '已完成',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    icon: CheckCircle2,
  },
  BLOCKED: {
    label: '阻塞',
    color: 'text-red-600',
    bg: 'bg-red-50',
    icon: Ban,
  },
};

interface StatusBadgeProps {
  status: string;
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({ status, showIcon = true, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.TODO;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        config.bg,
        config.color,
        className,
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </span>
  );
}

export { statusConfig };
