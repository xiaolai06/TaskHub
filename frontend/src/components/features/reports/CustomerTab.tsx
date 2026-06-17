'use client';

import { useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Users, Phone, Mail, MessageSquare, Calendar, DollarSign, Crown, Bell } from 'lucide-react';
import { StatCard } from './StatCard';
import { DonutChart } from './DonutChart';
import { HorizontalBars } from './HorizontalBars';
import { buildDateQuery } from './DateFilter';
import { CHART_COLORS, fmtYuan, fmtYuanRaw, SectionCard, EmptyPlaceholder, ErrorState, StatSkeleton, ChartSkeleton } from './report-utils';
import type { DateFilterValue } from './DateFilter';

// ─── Types ───

interface CustomerRankingItem {
  id: string; name: string; contact: string; status: string;
  projectCount: number; totalReceived: number; totalBudget: number;
}
interface CustomerStats {
  statusDist: { status: string; count: number }[];
  totalCount: number; vipCount: number;
}
interface FollowUpItem {
  id: string; type: string; nextFollowAt: string | null;
  summary: string | null; customerName: string; customerId?: string;
  isOverdue: boolean; daysUntil: number;
}
interface FollowUpReminders {
  items: FollowUpItem[]; overdueCount: number; upcomingCount: number;
}

// ─── Helpers ───

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '活跃', VIP: 'VIP', LEAD: '线索', INACTIVE: '不活跃',
};
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#10b981', VIP: '#6366f1', LEAD: '#f59e0b', INACTIVE: '#94a3b8',
};
const COMM_TYPE_ICON: Record<string, typeof Phone> = {
  PHONE: Phone, EMAIL: Mail, MEETING: Calendar, CHAT: MessageSquare,
};

// ─── 客户详情列表（弹窗用） ───

function CustomerListInPopover({ customers, status, maxVisible = 8 }: {
  customers: CustomerRankingItem[];
  status: string;
  maxVisible?: number;
}) {
  const filtered = customers.filter((c) => c.status === status);
  if (filtered.length === 0) return <p className="py-2 text-center text-muted-foreground text-[11px]">暂无客户</p>;
  return (
    <div className="space-y-0.5" style={{ maxHeight: 240, overflowY: 'auto' }}>
      {filtered.slice(0, maxVisible).map((c) => (
        <div key={c.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/40 transition-colors">
          <div className="flex-1 min-w-0">
            <span className="text-[11px] text-foreground/80 truncate block">{c.name}</span>
            <span className="text-[10px] text-muted-foreground">{c.projectCount} 个项目</span>
          </div>
          <span className="shrink-0 ml-2 text-[11px] font-mono font-medium text-foreground/70">{fmtYuanRaw(c.totalReceived)}</span>
        </div>
      ))}
      {filtered.length > maxVisible && <p className="pt-1 text-center text-[10px] text-muted-foreground">还有 {filtered.length - maxVisible} 个客户...</p>}
    </div>
  );
}

// ─── Component ───

interface CustomerTabProps {
  dateFilter: DateFilterValue;
}

export function CustomerTab({ dateFilter }: CustomerTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ranking, setRanking] = useState<CustomerRankingItem[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [reminders, setReminders] = useState<FollowUpReminders | null>(null);

  const qs = buildDateQuery(dateFilter);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<CustomerRankingItem[]>('/reports/customer-ranking'),
      api.get<CustomerStats>('/reports/customer-stats'),
      api.get<FollowUpReminders>('/reports/follow-up-reminders'),
    ]).then(([rk, st, rm]) => {
      setRanking(rk); setStats(st); setReminders(rm);
    }).catch((e) => setError(e instanceof ApiError ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [qs]);

  if (loading) return (
    <div className="space-y-5 animate-in fade-in-0 duration-300">
      <StatSkeleton />
      <ChartSkeleton count={4} />
    </div>
  );
  if (error) return <ErrorState message={error} />;

  const totalRevenue = ranking.reduce((s, r) => s + r.totalReceived, 0);

  return (
    <div className="space-y-5 animate-in fade-in-0 duration-300">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={Bell} label="待跟进" value={String((reminders?.overdueCount ?? 0) + (reminders?.upcomingCount ?? 0))}
          iconBg="bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
          hint={reminders?.overdueCount ? `⚠ 逾期 ${reminders.overdueCount} 笔` : '全部按时'} />
        <StatCard icon={DollarSign} label="累计回款" value={fmtYuan(totalRevenue)}
          iconBg="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" />
        <StatCard icon={Users} label="客户总数" value={String(stats?.totalCount ?? 0)}
          iconBg="bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" />
        <StatCard icon={Crown} label="VIP 客户" value={String(stats?.vipCount ?? 0)}
          iconBg="bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="待跟进客户">
          {!reminders || reminders.items.length === 0 ? (
            <EmptyPlaceholder text="暂无待跟进客户" />
          ) : (
            <div className="space-y-2">
              {reminders.items.slice(0, 6).map((item) => {
                const Icon = COMM_TYPE_ICON[item.type] || Phone;
                return (
                  <div key={item.id} className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors',
                    item.isOverdue ? 'bg-red-50/60 hover:bg-red-50' : 'bg-muted/30 hover:bg-muted/50',
                  )}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{item.customerName}</p>
                        {item.summary && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{item.summary}</p>}
                      </div>
                    </div>
                    <span className={cn('shrink-0 text-[10px] font-medium', item.isOverdue ? 'text-red-500' : 'text-muted-foreground')}>
                      {item.isOverdue ? `逾期 ${item.daysUntil} 天` : item.daysUntil === 0 ? '今天' : `${item.daysUntil} 天后`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="客户价值排行">
          {ranking.length === 0 ? (
            <EmptyPlaceholder text="暂无客户数据" />
          ) : (
            <HorizontalBars
              data={ranking.slice(0, 8).map((r, i) => ({
                label: r.name,
                value: r.totalReceived / 100,
                color: CHART_COLORS[i % CHART_COLORS.length],
                tag: `${r.projectCount} 个项目`,
                detail: (
                  <div className="space-y-0.5 text-[11px]">
                    <p className="font-medium text-foreground border-b border-border/40 pb-1.5 mb-1">{r.name}</p>
                    <div className="flex justify-between"><span className="text-muted-foreground">项目数</span><span className="font-mono">{r.projectCount}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">累计回款</span><span className="font-mono">{fmtYuanRaw(r.totalReceived)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">总预算</span><span className="font-mono">{fmtYuanRaw(r.totalBudget)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">状态</span><span className="font-medium">{STATUS_LABEL[r.status] || r.status}</span></div>
                  </div>
                ),
              }))}
              formatValue={(v) => `¥${Math.round(v).toLocaleString('zh-CN')}`}
            />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="客户状态分布">
          {!stats || stats.statusDist.length === 0 ? (
            <EmptyPlaceholder text="暂无客户" />
          ) : (
            <DonutChart
              data={stats.statusDist.map((s, i) => ({
                label: STATUS_LABEL[s.status] || s.status,
                value: s.count,
                color: STATUS_COLOR[s.status] || CHART_COLORS[i],
                detail: (
                  <div>
                    <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[s.status] || CHART_COLORS[i] }} />
                        <span className="text-[12px] font-semibold text-foreground">{STATUS_LABEL[s.status] || s.status}</span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">{s.count} 个</span>
                    </div>
                    <CustomerListInPopover customers={ranking} status={s.status} />
                  </div>
                ),
              }))}
              centerLabel="总客户"
              centerValue={String(stats.totalCount)}
            />
          )}
        </SectionCard>

        <SectionCard title="客户项目明细">
          {ranking.length === 0 ? (
            <EmptyPlaceholder text="暂无数据" />
          ) : (
            <div className="space-y-2">
              {ranking.slice(0, 6).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground truncate">{r.name}</span>
                      <span className={cn(
                        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        r.status === 'VIP' ? 'bg-indigo-50 text-indigo-700' : r.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600',
                      )}>{STATUS_LABEL[r.status] || r.status}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{r.projectCount} 个项目</p>
                  </div>
                  <span className="text-xs font-mono font-bold tabular-nums text-foreground shrink-0">{fmtYuanRaw(r.totalReceived)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
