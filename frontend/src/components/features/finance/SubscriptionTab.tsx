'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Pause, Play, Trash2, ExternalLink,
  AlertTriangle, Calendar, CreditCard, Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useSubscriptions, useSubscriptionCostSummary,
  usePauseSubscription, useResumeSubscription, useDeleteSubscription,
  type Subscription,
} from '@/hooks/useSubscriptions';
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
  SOFTWARE: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  CLOUD: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  DOMAIN: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400',
  TOOL: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  MEDIA: 'bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400',
  OTHER: 'bg-stone-100 text-stone-600 dark:bg-stone-950/40 dark:text-stone-400',
};

const CATEGORY_ICON_BG: Record<string, string> = {
  SOFTWARE: 'bg-violet-50 dark:bg-violet-950/30',
  CLOUD: 'bg-blue-50 dark:bg-blue-950/30',
  DOMAIN: 'bg-teal-50 dark:bg-teal-950/30',
  TOOL: 'bg-amber-50 dark:bg-amber-950/30',
  MEDIA: 'bg-pink-50 dark:bg-pink-950/30',
  OTHER: 'bg-stone-100 dark:bg-stone-950/30',
};

const CATEGORY_ICON_COLOR: Record<string, string> = {
  SOFTWARE: 'text-violet-600 dark:text-violet-400',
  CLOUD: 'text-blue-600 dark:text-blue-400',
  DOMAIN: 'text-teal-600 dark:text-teal-400',
  TOOL: 'text-amber-600 dark:text-amber-400',
  MEDIA: 'text-pink-600 dark:text-pink-400',
  OTHER: 'text-stone-600 dark:text-stone-400',
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
        'group rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md',
        dueSoon ? 'border-amber-200 dark:border-amber-900/40' : 'border-border/50',
        isPaused && 'opacity-50',
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                CATEGORY_ICON_BG[sub.category] || CATEGORY_ICON_BG.OTHER,
              )}>
                <Wallet className={cn('h-4 w-4',
                  CATEGORY_ICON_COLOR[sub.category] || CATEGORY_ICON_COLOR.OTHER,
                )} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-medium text-foreground/80">{sub.name}</h4>
                  <span className={cn('rounded-full px-2 py-0.5 text-2xs-plus font-medium',
                    CATEGORY_COLORS[sub.category] || CATEGORY_COLORS.OTHER,
                  )}>
                    {CATEGORY_LABELS[sub.category] || sub.category}
                  </span>
                  {dueSoon && (
                    <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-2xs-plus font-medium text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      即将扣费
                    </span>
                  )}
                  {isPaused && (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-2xs-plus font-medium text-stone-500 dark:bg-stone-900/40">
                      已暂停
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-2.5 border-t border-border/30 pt-2.5 flex flex-wrap items-center gap-4 text-2xs-plus text-muted-foreground">
              <span className="font-mono text-sm font-semibold tabular-nums text-foreground/80">
                ¥{amountYuan}<span className="text-muted-foreground font-normal">/{CYCLE_LABELS[sub.cycle] || sub.cycle}</span>
              </span>
              {cnyAmount && (
                <span>{cnyAmount}/月</span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                下次扣费 {formatDate(sub.nextBillingAt)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            {sub.url && (
              <a href={sub.url} target="_blank" rel="noopener noreferrer"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button onClick={() => setEditOpen(true)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40">
              <CreditCard className="h-3.5 w-3.5" />
            </button>
            {isPaused ? (
              <button onClick={() => resumeSub.mutate(sub.id)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40">
                <Play className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button onClick={() => pauseSub.mutate(sub.id)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/40">
                <Pause className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={() => deleteSub.mutate(sub.id)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <SubscriptionForm open={editOpen} onOpenChange={setEditOpen} subscription={sub} />
    </>
  );
}

export function SubscriptionTab() {
  const [formOpen, setFormOpen] = useState(false);
  const { data: subsData, isLoading: loadingSubs } = useSubscriptions();
  const { data: costSummary, isLoading: loadingCost } = useSubscriptionCostSummary();

  const openForm = useCallback(() => setFormOpen(true), []);
  useEffect(() => {
    document.addEventListener('sub:open-form', openForm);
    return () => document.removeEventListener('sub:open-form', openForm);
  }, [openForm]);

  if (loadingSubs || loadingCost) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const subs = subsData?.data || [];
  const activeSubs = subs.filter((s) => s.status === 'ACTIVE');
  const pausedSubs = subs.filter((s) => s.status === 'PAUSED');
  const dueSoonSubs = activeSubs.filter((s) => isDueSoon(s.nextBillingAt));

  return (
    <div className="flex flex-col gap-5">
      {/* Summary Cards */}
      {costSummary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/40 bg-card px-5 py-4 transition-all duration-200 hover:shadow-md">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/30">
                <CreditCard className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-2xs-plus text-muted-foreground">月度固定成本</span>
            </div>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">
              ¥{costSummary.monthlyTotal.toLocaleString('zh-CN')}
            </p>
            <p className="mt-0.5 text-2xs-plus text-muted-foreground">活跃 {costSummary.activeCount} 项</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card px-5 py-4 transition-all duration-200 hover:shadow-md">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-2xs-plus text-muted-foreground">年度预估</span>
            </div>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">
              ¥{costSummary.yearlyEstimate.toLocaleString('zh-CN')}
            </p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card px-5 py-4 transition-all duration-200 hover:shadow-md">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30">
                <Wallet className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-2xs-plus text-muted-foreground">分类构成</span>
            </div>
            <div className="space-y-2">
              {costSummary.byCategory.slice(0, 3).map((cat) => (
                <div key={cat.category} className="flex items-center gap-2">
                  <span className="w-14 truncate text-2xs-plus text-muted-foreground">{cat.category}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${cat.percent}%` }} />
                  </div>
                  <span className="w-10 text-right font-mono text-2xs-plus tabular-nums text-foreground/70">{cat.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Subscription List */}
      <div>
        {dueSoonSubs.length > 0 && (
          <p className="mb-3 px-1 text-sm text-amber-600 dark:text-amber-400">
            {dueSoonSubs.length} 项即将扣费
          </p>
        )}
        {subs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border/40 bg-card py-16 text-muted-foreground">
            <Calendar className="h-10 w-10 opacity-20" />
            <p className="text-sm font-medium">还没有订阅</p>
            <p className="text-xs text-muted-foreground/60">添加你的第一个软件订阅</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dueSoonSubs.map((sub) => <SubscriptionCard key={sub.id} sub={sub} />)}
            {activeSubs.filter((s) => !isDueSoon(s.nextBillingAt)).map((sub) => (
              <SubscriptionCard key={sub.id} sub={sub} />
            ))}
            {pausedSubs.length > 0 && (
              <>
                <div className="pt-2 pb-1 px-1">
                  <span className="text-2xs-plus font-medium text-muted-foreground">已暂停</span>
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
