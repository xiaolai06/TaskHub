'use client';

import { useState } from 'react';
import { RefreshCw, ArrowDownLeft, Wallet } from 'lucide-react';
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
      {/* Tab Switcher */}
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-muted/50 p-1">
          {TABS.map((tab) => {
            const isActive = active === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActive(tab.value)}
                className={cn(
                  'relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-card text-foreground shadow-sm shadow-border/40'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
                )}
              >
                <tab.icon className={cn('h-4 w-4', isActive && 'text-primary')} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {active === 'transactions' && <TransactionTab />}
      {active === 'payments' && <PaymentTab />}
      {active === 'subscriptions' && <SubscriptionTab />}
    </div>
  );
}
