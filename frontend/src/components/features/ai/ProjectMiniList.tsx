'use client';

import { cn } from '@/lib/utils';

interface ProjectItem {
  id: string;
  name: string;
  status: string;
  budget?: number;
  startDate?: string;
}

const statusCN: Record<string, string> = {
  ACTIVE: 'bg-blue-50 text-blue-600',
  COMPLETED: 'bg-emerald-50 text-emerald-600',
  ON_HOLD: 'bg-amber-50 text-amber-600',
  CANCELLED: 'bg-muted text-muted-foreground',
};

const statusLabel: Record<string, string> = {
  ACTIVE: '进行中',
  COMPLETED: '已完成',
  ON_HOLD: '暂停',
  CANCELLED: '取消',
};

interface ProjectMiniListProps {
  projects: ProjectItem[];
}

export function ProjectMiniList({ projects }: ProjectMiniListProps) {
  if (projects.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-[11px] text-muted-foreground">暂无活跃项目</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        活跃项目 ({projects.length})
      </p>
      {projects.slice(0, 5).map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-background hover:shadow-sm"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-foreground/80">{p.name}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {p.budget ? `¥${(p.budget / 100).toLocaleString()}` : '-'}
              {p.startDate && <span className="ml-2">{p.startDate.slice(0, 10)}</span>}
            </p>
          </div>
          <span className={cn(
            'ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium',
            statusCN[p.status] || 'bg-muted text-muted-foreground',
          )}>
            {statusLabel[p.status] || p.status}
          </span>
        </div>
      ))}
    </div>
  );
}
