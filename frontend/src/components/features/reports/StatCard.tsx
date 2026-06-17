'use client';

import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  /** 图标背景色（含 text-xxx 的 Tailwind 类） */
  iconBg: string;
  hint?: string;
  className?: string;
}

export function StatCard({ icon: Icon, label, value, iconBg, hint, className }: StatCardProps) {
  return (
    <div className={cn(
      'rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm transition-all duration-200 hover:shadow-md',
      className,
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
          {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn('rounded-lg p-2', iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
