'use client';

import { useState } from 'react';
import {
  Plus, Loader2, AlertCircle, TrendingUp,
  ChevronDown, ChevronUp, Calendar, CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReceivables, useAgingAnalysis, type ReceivablesData } from '@/hooks/usePayments';
import { Button } from '@/components/ui/button';
import { PaymentForm } from './PaymentForm';

function formatYuan(fen: number): string {
  return (fen / 100).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  DOWN_PAYMENT: '预付款',
  PROGRESS: '进度款',
  FINAL: '尾款',
  ADJUSTMENT: '调整项',
  OTHER: '其他',
};

function ReceivableCard({ project }: { project: ReceivablesData['projects'][0] }) {
  const [expanded, setExpanded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const progressColor = project.rate >= 100
    ? 'bg-emerald-500'
    : project.rate >= 50
      ? 'bg-blue-500'
      : project.isOverdue
        ? 'bg-red-500'
        : 'bg-amber-500';

  return (
    <>
      <div className={cn(
        'rounded-xl border bg-card p-4 shadow-sm transition-colors',
        project.isOverdue ? 'border-red-200 dark:border-red-900/50' : 'border-border/60',
      )}>
        <div
          className="flex cursor-pointer items-start justify-between gap-3"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="truncate text-sm font-medium text-foreground">{project.name}</h4>
              {project.isOverdue && (
                <span className="shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-950/50 dark:text-red-400">
                  逾期
                </span>
              )}
              {project.rate >= 100 && (
                <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                  已结清
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span>报价 <span className="font-mono text-foreground">¥{formatYuan(project.budget)}</span></span>
              <span>已收 <span className="font-mono text-emerald-600">¥{formatYuan(project.received)}</span></span>
              <span>待收 <span className="font-mono text-amber-600">¥{formatYuan(project.outstanding)}</span></span>
            </div>
            {/* Progress Bar */}
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full transition-all duration-500', progressColor)}
                style={{ width: `${Math.min(100, project.rate)}%` }}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="font-mono text-lg font-bold text-foreground">{project.rate}%</span>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {expanded && project.outstanding > 0 && (
          <div className="mt-3 flex justify-end border-t border-border/40 pt-3">
            <Button size="sm" onClick={() => setFormOpen(true)} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
              <Plus className="h-3.5 w-3.5" />
              录入回款
            </Button>
          </div>
        )}
      </div>

      <PaymentForm
        open={formOpen}
        onOpenChange={setFormOpen}
        projectId={project.id}
        projectName={project.name}
      />
    </>
  );
}

function AgingCard({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums text-foreground">¥{formatYuan(amount)}</span>
    </div>
  );
}

export function PaymentTab() {
  const { data: receivables, isLoading: loadingReceivables } = useReceivables();
  const { data: aging, isLoading: loadingAging } = useAgingAnalysis();

  if (loadingReceivables) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary Cards */}
      {receivables && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
            <p className="text-xs text-muted-foreground">应收总额</p>
            <p className="mt-1 font-mono text-xl font-bold text-amber-600 dark:text-amber-400">
              ¥{formatYuan(receivables.totalReceivable)}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
            <p className="text-xs text-muted-foreground">本月已收</p>
            <p className="mt-1 font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">
              ¥{formatYuan(receivables.monthlyReceived)}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
            <p className="text-xs text-muted-foreground">逾期未收</p>
            <p className="mt-1 font-mono text-xl font-bold text-red-600 dark:text-red-400">
              ¥{formatYuan(receivables.overdueAmount)}
            </p>
            {receivables.overdueCount > 0 && (
              <p className="mt-0.5 text-[11px] text-red-500/70">{receivables.overdueCount} 个项目</p>
            )}
          </div>
          <div className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
            <p className="text-xs text-muted-foreground">整体回款率</p>
            <p className="mt-1 font-mono text-xl font-bold text-foreground">
              {receivables.overallRate}%
            </p>
          </div>
        </div>
      )}

      {/* Project List */}
      <div className="rounded-xl border border-border/60 bg-card">
        <div className="border-b border-border/40 px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">项目回款</h3>
        </div>
        {!receivables?.projects || receivables.projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <CreditCard className="h-10 w-10 opacity-30" />
            <p className="text-sm">还没有项目数据</p>
          </div>
        ) : (
          <div className="space-y-2 p-3">
            {receivables.projects.map((project) => (
              <ReceivableCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {/* Aging Analysis */}
      {aging && aging.totalOutstanding > 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">账龄分析</h3>
          <div className="space-y-2.5">
            <AgingCard label="0-30天" amount={aging.buckets['0-30']} total={aging.totalOutstanding} color="bg-emerald-500" />
            <AgingCard label="31-60天" amount={aging.buckets['31-60']} total={aging.totalOutstanding} color="bg-blue-500" />
            <AgingCard label="61-90天" amount={aging.buckets['61-90']} total={aging.totalOutstanding} color="bg-amber-500" />
            <AgingCard label="90天+" amount={aging.buckets['90+']} total={aging.totalOutstanding} color="bg-red-500" />
          </div>
        </div>
      )}
    </div>
  );
}
