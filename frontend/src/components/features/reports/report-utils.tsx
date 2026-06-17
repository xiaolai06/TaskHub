import type { ReactNode } from 'react';
import { FolderOpen, ListChecks, Bell, ArrowRight, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHART_COLORS as TREND_COLORS } from './TrendChart';

// ─── 颜色 ───

export const CHART_COLORS = TREND_COLORS;

// ─── 金额格式化 ───

export function fmtYuan(fen: number): string {
  const y = fen / 100;
  if (y >= 10000) return `¥${(y / 10000).toFixed(1)}w`;
  if (y >= 1000) return `¥${(y / 1000).toFixed(1)}k`;
  return `¥${y.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

export function fmtYuanRaw(fen: number): string {
  return `¥${(fen / 100).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

// ─── 通用 SectionCard ───

export function SectionCard({ title, children, right }: {
  title: string; children: ReactNode; right?: ReactNode;
}) {
  return (
    <Card className="border-border/60 bg-card shadow-sm">
      <CardHeader className="border-b border-border/50 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
          {right}
        </div>
      </CardHeader>
      <CardContent className="px-4 py-4">{children}</CardContent>
    </Card>
  );
}

// ─── 通用空状态 ───

const EMPTY_ICONS = {
  default: Bell,
  check: ArrowRight,
  package: Package,
  tasks: ListChecks,
  folder: FolderOpen,
};

export function EmptyPlaceholder({ text, icon = 'default' }: {
  text: string;
  icon?: keyof typeof EMPTY_ICONS;
}) {
  const Icon = EMPTY_ICONS[icon] ?? Bell;
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <Icon className="h-8 w-8 text-muted-foreground/30" />
      <p className="mt-2 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

// ─── 通用 Skeleton 卡片 ───

export function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-14 animate-pulse rounded bg-muted" />
              <div className="h-6 w-24 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="h-4 w-24 animate-pulse rounded bg-muted mb-4" />
          <div className="h-40 animate-pulse rounded bg-muted/40" />
        </div>
      ))}
    </div>
  );
}

// ─── 通用错误态 ───

import { AlertTriangle } from 'lucide-react';

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <AlertTriangle className="h-10 w-10 text-red-300" />
      <p className="mt-4 text-sm text-red-500">{message}</p>
    </div>
  );
}
