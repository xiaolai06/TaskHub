'use client';

import { useState } from 'react';
import { RefreshCw, ArrowDownLeft, Wallet, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TransactionTab } from '@/components/features/finance/TransactionTab';
import { PaymentTab } from '@/components/features/finance/PaymentTab';
import { SubscriptionTab } from '@/components/features/finance/SubscriptionTab';

const TABS = [
  { value: 'transactions', label: '流水', icon: RefreshCw },
  { value: 'payments', label: '回款', icon: ArrowDownLeft },
  { value: 'subscriptions', label: '订阅', icon: Wallet },
] as const;

export default function FinancePage() {
  const [active, setActive] = useState<string>('transactions');

  return (
    <div className="flex flex-col gap-5 page-enter">
      {/* 顶部栏：Tab + 操作按钮 */}
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {TABS.map((tab) => {
            const isActive = active === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActive(tab.value)}
                className={cn(
                  'relative flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 流水 Tab 时显示记账按钮 */}
        {active === 'transactions' && (
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => document.dispatchEvent(new CustomEvent('tx:open-form', { detail: 'INCOME' }))}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-emerald-700 active:scale-95 shadow-sm">
              <Plus className="h-4 w-4" />记收入
            </button>
            <button onClick={() => document.dispatchEvent(new CustomEvent('tx:open-form', { detail: 'EXPENSE' }))}
              className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground/70 transition-all duration-200 hover:bg-muted hover:text-foreground active:scale-95">
              <Plus className="h-4 w-4" />记支出
            </button>
          </div>
        )}

        {/* 订阅 Tab 时显示添加按钮 */}
        {active === 'subscriptions' && (
          <div className="ml-auto">
            <button onClick={() => document.dispatchEvent(new CustomEvent('sub:open-form'))}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-indigo-700 active:scale-95 shadow-sm">
              <Plus className="h-4 w-4" />添加订阅
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {active === 'transactions' && <TransactionTab />}
      {active === 'payments' && <PaymentTab />}
      {active === 'subscriptions' && <SubscriptionTab />}
    </div>
  );
}
