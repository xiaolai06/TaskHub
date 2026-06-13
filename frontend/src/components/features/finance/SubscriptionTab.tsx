'use client';

import { useState } from 'react';
import {
  Plus, Loader2, Pause, Play, Trash2, ExternalLink,
  AlertTriangle, Calendar, CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useSubscriptions, useSubscriptionCostSummary,
  usePauseSubscription, useResumeSubscription, useDeleteSubscription,
  type Subscription,
} from '@/hooks/useSubscriptions';
import { Button } from '@/components/ui/button';
import { SubscriptionForm } from './SubscriptionForm';

function formatYuan(fen: number): string {
  return (fen / 100).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

const CATEGORY_LABELS: Record<string, string> = {
  SOFTWARE: 'AI/软件',
  CLOUD: '云服务',
  DOMAIN: '域名/托管',
  TOOL: '效率工具',
  MEDIA: '素材库',
  OTHER: '其他',
};

const CATEGORY_COLORS: Record<string, string> = {
  SOFTWARE: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400',
  CLOUD: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
  DOMAIN: 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400',
  TOOL: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  MEDIA: 'bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-400',
  OTHER: 'bg-stone-50 text-stone-700 dark:bg-stone-950/50 dark:text-stone-400',
};

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: '月',
  QUARTERLY: '季',
  YEARLY: '年',
};

function isDueSoon(nextBillingAt: string): boolean {
  const now = new Date();
  const billing = new Date(nextBillingAt);
  const diffDays = Math.ceil((billing.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 3 && diffDays >= 0;
}

function SubscriptionCard({ sub }: { sub: Subscription }) {
  const [editOpen, setEditOpen] = useState(false);
  const pauseSub = usePauseSubscription();
  const resumeSub = useResumeSubscription();
  const deleteSub = useDeleteSubscription();

  const isPaused = sub.status === 'PAUSED';
  const isCancelled = sub.status === 'CANCELLED';
  const dueSoon = sub.status === 'ACTIVE' && isDueSoon(sub.nextBillingAt);

  const amountYuan = sub.currency === 'CNY'
    ? formatYuan(sub.amount)
    : `${sub.currency} ${(sub.amount / 100).toFixed(2)}`;

  const cnyAmount = sub.currency !== 'CNY'
    ? `≈ ¥${formatYuan(Math.round(sub.amount * sub.exchangeRate))}`
    : '';

  return (
    <>
      <div className={cn(
        'rounded-xl border bg-card p-4 shadow-sm transition-colors',
        dueSoon ? 'border-amber-200 dark:border-amber-900/50' : 'border-border/60',
        isPaused && 'opacity-60',
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-foreground">{sub.name}</h4>
              <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                CATEGORY_COLORS[sub.category] || CATEGORY_COLORS.OTHER,
              )}>
                {CATEGORY_LABELS[sub.category] || sub.category}
              </span>
              {dueSoon && (
                <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  即将扣费
                </span>
              )}
              {isPaused && (
                <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500 dark:bg-stone-900/50">
                  已暂停
                </span>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="font-mono text-sm font-semibold text-foreground">
                {amountYuan}<span className="text-muted-foreground">/{CYCLE_LABELS[sub.cycle] || sub.cycle}</span>
              </span>
              {cnyAmount && (
                <span className="text-muted-foreground">{cnyAmount}/月</span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                下次扣费 {formatDate(sub.nextBillingAt)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            {sub.url && (
              <a
                href={sub.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              onClick={() => setEditOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CreditCard className="h-3.5 w-3.5" />
            </button>
            {isPaused ? (
              <button
                onClick={() => resumeSub.mutate(sub.id)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/50"
              >
                <Play className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={() => pauseSub.mutate(sub.id)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/50"
              >
                <Pause className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => deleteSub.mutate(sub.id)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <SubscriptionForm
        open={editOpen}
        onOpenChange={setEditOpen}
        subscription={sub}
      />
    </>
  );
}

export function SubscriptionTab() {
  const [formOpen, setFormOpen] = useState(false);
  const { data: subsData, isLoading: loadingSubs } = useSubscriptions();
  const { data: costSummary, isLoading: loadingCost } = useSubscriptionCostSummary();

  if (loadingSubs || loadingCost) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const subs = subsData?.data || [];
  const activeSubs = subs.filter((s) => s.status === 'ACTIVE');
  const pausedSubs = subs.filter((s) => s.status === 'PAUSED');
  const dueSoonSubs = activeSubs.filter((s) => isDueSoon(s.nextBillingAt));

  return (
    <div className="flex flex-col gap-4">
      {/* Summary Cards */}
      {costSummary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-card px-5 py-4 shadow-sm">
            <p className="text-xs text-muted-foreground">月度固定成本</p>
            <p className="mt-1.5 font-mono text-2xl font-bold text-foreground">
              ¥{costSummary.monthlyTotal.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">活跃 {costSummary.activeCount} 项</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card px-5 py-4 shadow-sm">
            <p className="text-xs text-muted-foreground">年度预估</p>
            <p className="mt-1.5 font-mono text-2xl font-bold text-foreground">
              ¥{costSummary.yearlyEstimate.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card px-5 py-4 shadow-sm">
            <p className="text-xs text-muted-foreground">分类构成</p>
            <div className="mt-2 space-y-1.5">
              {costSummary.byCategory.slice(0, 3).map((cat) => (
                <div key={cat.category} className="flex items-center gap-2">
                  <span className="w-16 truncate text-xs text-muted-foreground">{cat.category}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${cat.percent}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-mono text-[11px] text-foreground">{cat.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {dueSoonSubs.length > 0 && (
            <span className="text-amber-600 dark:text-amber-400">
              {dueSoonSubs.length} 项即将扣费
            </span>
          )}
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          添加订阅
        </Button>
      </div>

      {/* Subscription List */}
      <div className="rounded-xl border border-border/60 bg-card">
        {subs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <Calendar className="h-10 w-10 opacity-30" />
            <p className="text-sm">还没有订阅</p>
            <p className="text-xs">添加你的第一个软件订阅</p>
          </div>
        ) : (
          <div className="space-y-2 p-3">
            {/* Due soon first */}
            {dueSoonSubs.map((sub) => <SubscriptionCard key={sub.id} sub={sub} />)}
            {/* Active (not due soon) */}
            {activeSubs.filter((s) => !isDueSoon(s.nextBillingAt)).map((sub) => (
              <SubscriptionCard key={sub.id} sub={sub} />
            ))}
            {/* Paused */}
            {pausedSubs.length > 0 && (
              <>
                <div className="py-1">
                  <span className="text-[11px] font-medium text-muted-foreground">已暂停</span>
                </div>
                {pausedSubs.map((sub) => <SubscriptionCard key={sub.id} sub={sub} />)}
              </>
            )}
          </div>
        )}
      </div>

      <SubscriptionForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
