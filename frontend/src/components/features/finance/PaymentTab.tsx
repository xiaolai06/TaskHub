'use client';

import { useState } from 'react';
import {
  Plus, Loader2, TrendingUp, AlertCircle,
  ChevronDown, ChevronUp, CreditCard, Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReceivables, useAgingAnalysis, type ReceivablesData } from '@/hooks/usePayments';
import { Button } from '@/components/ui/button';
import { PaymentForm } from './PaymentForm';

function formatYuan(fen: number): string {
  return (fen / 100).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

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

  const cardBg = project.rate >= 100
    ? 'bg-emerald-50/40 dark:bg-emerald-950/10'
    : project.isOverdue
      ? 'bg-red-50/40 dark:bg-red-950/10'
      : 'bg-card';

  return (
    <>
      <div className={cn(
        'group rounded-xl border p-4 shadow-sm transition-all duration-200 hover:shadow-md',
        cardBg,
        project.isOverdue ? 'border-red-200/80 dark:border-red-900/40' : 'border-border/50',
      )}>
        <div
          className="flex cursor-pointer items-start justify-between gap-3"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                project.rate >= 100 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-blue-50 dark:bg-blue-950/30',
              )}>
                <Wallet className={cn('h-4 w-4',
                  project.rate >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400',
                )} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="truncate text-sm font-medium text-foreground/80">{project.name}</h4>
                  {project.isOverdue && (
                    <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-2xs-plus font-medium text-red-600 dark:bg-red-950/50 dark:text-red-400">
                      逾期
                    </span>
                  )}
                  {project.rate >= 100 && (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-2xs-plus font-medium text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                      已结清
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 数据行 */}
            <div className="mt-3 border-t border-border/30 pt-3 grid grid-cols-3 gap-3">
              <div>
                <p className="text-2xs-plus text-muted-foreground">报价</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground/80">¥{formatYuan(project.budget)}</p>
              </div>
              <div>
                <p className="text-2xs-plus text-muted-foreground">已收</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">¥{formatYuan(project.received)}</p>
              </div>
              <div>
                <p className="text-2xs-plus text-muted-foreground">待收</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">¥{formatYuan(project.outstanding)}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', progressColor)}
                  style={{ width: `${Math.min(100, project.rate)}%` }}
                />
              </div>
              <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground/80">{project.rate}%</span>
            </div>
          </div>

          <div className="shrink-0 pt-1">
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {expanded && project.outstanding > 0 && (
          <div className="mt-3 flex justify-end border-t border-border/40 pt-3">
            <Button size="sm" onClick={() => setFormOpen(true)}
              className="gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 active:scale-95">
              <Plus className="h-3.5 w-3.5" />
              录入回款
            </Button>
          </div>
        )}
      </div>

      <PaymentForm open={formOpen} onOpenChange={setFormOpen} projectId={project.id} projectName={project.name} />
    </>
  );
}

function AgingCard({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-2xs-plus text-muted-foreground">{label}</span>
      <div className="flex-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="w-16 shrink-0 text-right font-mono text-2xs-plus tabular-nums text-foreground/80">¥{formatYuan(amount)}</span>
      <span className="w-10 shrink-0 text-right text-2xs-plus text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function PaymentTab() {
  const { data: receivables, isLoading: loadingReceivables } = useReceivables();
  const { data: aging, isLoading: loadingAging } = useAgingAnalysis();

  if (loadingReceivables) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Summary Cards */}
      {receivables && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: '应收总额', value: receivables.totalReceivable, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', icon: Wallet },
            { label: '本月已收', value: receivables.monthlyReceived, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', icon: TrendingUp },
            { label: '逾期未收', value: receivables.overdueAmount, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', icon: AlertCircle },
            { label: '回款率', value: receivables.overallRate, color: 'text-foreground', bg: 'bg-muted/50', icon: CreditCard, suffix: '%', isRate: true },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-xl border border-border/40 bg-card px-4 py-3.5 transition-all duration-200 hover:shadow-md">
                <div className="flex items-center gap-2">
                  <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', item.bg)}>
                    <Icon className={cn('h-3.5 w-3.5', item.color)} />
                  </div>
                  <span className="text-2xs-plus text-muted-foreground">{item.label}</span>
                </div>
                <p className={cn('mt-2 font-mono text-xl font-bold tabular-nums', item.color)}>
                  {item.isRate ? `${item.value}%` : `¥${formatYuan(item.value)}`}
                </p>
                {item.label === '逾期未收' && receivables.overdueCount > 0 && (
                  <p className="mt-0.5 text-2xs-plus text-red-500/70">{receivables.overdueCount} 个项目</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Project List */}
      <div>
        <div className="mb-3 px-1">
          <h3 className="text-sm font-medium text-foreground/80">项目回款</h3>
        </div>
        {!receivables?.projects || receivables.projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border/40 bg-card py-16 text-muted-foreground">
            <CreditCard className="h-10 w-10 opacity-20" />
            <p className="text-sm font-medium">还没有项目数据</p>
          </div>
        ) : (
          <div className="space-y-3">
            {receivables.projects.map((project) => (
              <ReceivableCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {/* Aging Analysis */}
      {aging && aging.totalOutstanding > 0 && (
        <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-foreground/80">账龄分析</h3>
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
