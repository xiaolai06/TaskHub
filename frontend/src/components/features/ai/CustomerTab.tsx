'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface CustomerItem {
  id: string;
  name: string;
  company?: string;
  email?: string;
  status: string;
  lastContactAt?: string | null;
  nextFollowAt?: string | null;
  projectCount?: number;
}

const statusCN: Record<string, string> = {
  VIP: 'bg-purple-50 text-purple-600',
  ACTIVE: 'bg-emerald-50 text-emerald-600',
  INACTIVE: 'bg-slate-100 text-slate-500',
  LEAD: 'bg-blue-50 text-blue-600',
};

const statusLabel: Record<string, string> = {
  VIP: 'VIP',
  ACTIVE: '活跃',
  INACTIVE: '不活跃',
  LEAD: '线索',
};

interface CustomerTabProps {
  onCustomerClick: (customerName: string) => void;
  open: boolean;
}

/** 计算距今天数 */
function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / 86400000);
}

export function CustomerTab({ onCustomerClick, open }: CustomerTabProps) {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get<{ data: CustomerItem[] }>('/customers?limit=100')
      .then((res) => {
        // API 返回 { data: [...], total, page, limit }，api.get 解包外层 data
        const list = Array.isArray(res) ? res : (res as any)?.data || [];
        setCustomers(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  // 按跟进紧急度排序
  const sorted = [...customers].sort((a, b) => {
    const daysA = daysSince(a.lastContactAt) ?? -1;
    const daysB = daysSince(b.lastContactAt) ?? -1;
    return daysB - daysA; // 越久远越靠前
  });

  const needsFollowUp = sorted.filter(c => {
    const d = daysSince(c.lastContactAt);
    return d !== null && d > 7;
  });

  if (loading) {
    return (
      <div className="animate-pulse space-y-2 p-3">
        <div className="h-3 w-16 rounded bg-slate-200" />
        <div className="h-12 w-full rounded-lg bg-slate-100" />
        <div className="h-12 w-full rounded-lg bg-slate-100" />
        <div className="h-12 w-full rounded-lg bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 需跟进客户 */}
      {needsFollowUp.length > 0 && (
        <div className="space-y-1">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-amber-500">
            ⚠️ 需跟进 ({needsFollowUp.length})
          </p>
          <div className="space-y-0.5">
            {needsFollowUp.map((c) => {
              const d = daysSince(c.lastContactAt);
              return (
                <button
                  key={c.id}
                  onClick={() => onCustomerClick(c.name)}
                  className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-background hover:shadow-sm"
                >
                  <span className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    d && d > 14 ? 'bg-red-500' : 'bg-amber-500',
                  )} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-slate-700">{c.name}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {d ? `${d} 天未联系` : '无联系记录'}
                      {c.company && ` · ${c.company}`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 全部客户 */}
      <div className="space-y-1">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          全部客户 ({sorted.length})
        </p>
        <div className="space-y-0.5">
          {sorted.map((c) => {
            const d = daysSince(c.lastContactAt);
            return (
              <button
                key={c.id}
                onClick={() => onCustomerClick(c.name)}
                className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-background hover:shadow-sm"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-medium text-slate-600">
                  {c.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-slate-700">{c.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {c.company || (d !== null ? `${d} 天前联系` : '暂无联系')}
                  </p>
                </div>
                <span className={cn(
                  'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium',
                  statusCN[c.status] || 'bg-slate-50 text-slate-500',
                )}>
                  {statusLabel[c.status] || c.status}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {sorted.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-[12px] text-slate-500">暂无客户</p>
          <p className="mt-1 text-[11px] text-slate-300">在客户管理页面添加</p>
        </div>
      )}
    </div>
  );
}
