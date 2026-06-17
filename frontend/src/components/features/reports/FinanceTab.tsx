'use client';

import { useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api';
import { TrendingUp, TrendingDown, DollarSign, Receipt } from 'lucide-react';
import { StatCard } from './StatCard';
import { DonutChart } from './DonutChart';
import { TrendChart } from './TrendChart';
import { buildDateQuery } from './DateFilter';
import { CHART_COLORS, fmtYuan, fmtYuanRaw, SectionCard, EmptyPlaceholder, ErrorState, StatSkeleton, ChartSkeleton } from './report-utils';
import type { DateFilterValue } from './DateFilter';

// ─── Types ───

interface Overview {
  income: number; expense: number; profit: number; margin: number;
  quoteTotal: number; receivables: number;
  incomeBreakdown: { projectPayments: number; otherIncome: number };
  expenseBreakdown: { projectCosts: number; operatingCosts: number; subscriptionCosts: number };
}
interface TrendItem { month: string; income: number; expense: number; profit: number }
interface CostStructure { category: string; amount: number; percent: number }
interface CostDetail { id: string; name: string; amount: number; projectName: string }
type CostDetails = Record<string, CostDetail[]>;
interface ReceivableItem {
  projectId: string; name: string; budget: number;
  received: number; outstanding: number; receiveRate: number; status: string;
}
interface Receivables { items: ReceivableItem[]; total: number; count: number }
interface SubItem {
  id: string; name: string; amount: number; cycle: string;
  category: string; status: string; monthlyAmount: number;
}
interface SubSummary { items: SubItem[]; monthlyTotal: number; yearlyTotal: number }
interface FinanceSummary { receivables: number }

// ─── Helpers ───

const COST_LABEL: Record<string, string> = {
  LABOR: '人工', MATERIAL: '材料', OVERHEAD: '运营', OTHER: '其他',
};
const CYCLE_LABEL: Record<string, string> = {
  MONTHLY: '月', QUARTERLY: '季', YEARLY: '年',
};

// ─── 支出明细列表（弹窗用） ───

function CostListInPopover({ items, maxVisible = 8 }: {
  items: CostDetail[];
  maxVisible?: number;
}) {
  if (items.length === 0) return <p className="py-2 text-center text-muted-foreground text-[11px]">暂无明细</p>;
  return (
    <div className="space-y-0.5" style={{ maxHeight: 240, overflowY: 'auto' }}>
      {items.slice(0, maxVisible).map((item) => (
        <div key={item.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/40 transition-colors">
          <div className="flex-1 min-w-0">
            <span className="text-[11px] text-foreground/80 truncate block">{item.name}</span>
            <span className="text-[10px] text-muted-foreground">{item.projectName}</span>
          </div>
          <span className="shrink-0 ml-2 text-[11px] font-mono font-medium text-foreground/70">{fmtYuanRaw(item.amount)}</span>
        </div>
      ))}
      {items.length > maxVisible && <p className="pt-1 text-center text-[10px] text-muted-foreground">还有 {items.length - maxVisible} 条...</p>}
    </div>
  );
}

// ─── Component ───

interface FinanceTabProps {
  dateFilter: DateFilterValue;
}

export function FinanceTab({ dateFilter }: FinanceTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [costStructure, setCostStructure] = useState<CostStructure[]>([]);
  const [costDetails, setCostDetails] = useState<CostDetails>({});
  const [receivables, setReceivables] = useState<Receivables | null>(null);
  const [subSummary, setSubSummary] = useState<SubSummary | null>(null);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);

  const qs = buildDateQuery(dateFilter);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<Overview>(`/reports/overview?${qs}`),
      api.get<TrendItem[]>('/finance/trends?months=6'),
      api.get<CostStructure[]>(`/reports/cost-structure?${qs}`),
      api.get<CostDetails>(`/reports/cost-details?${qs}`),
      api.get<Receivables>('/reports/receivables'),
      api.get<SubSummary>('/reports/subscription-summary'),
      api.get<FinanceSummary>('/finance/summary'),
    ]).then(([ov, tr, cs, cd, rc, ss, fs]) => {
      setOverview(ov); setTrends(tr); setCostStructure(cs); setCostDetails(cd);
      setReceivables(rc); setSubSummary(ss); setFinanceSummary(fs);
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

  const recvTotal = financeSummary?.receivables ?? receivables?.total ?? 0;

  return (
    <div className="space-y-5 animate-in fade-in-0 duration-300">
      {/* ── 第一层 · 决策指标 ── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          icon={DollarSign} label="利润" value={fmtYuan(overview?.profit ?? 0)}
          iconBg="bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
          hint={`利润率 ${overview?.margin ?? 0}%`}
        />
        <StatCard
          icon={TrendingUp} label="收入" value={fmtYuan(overview?.income ?? 0)}
          iconBg="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          hint={`项目回款 ${fmtYuan(overview?.incomeBreakdown?.projectPayments ?? 0)}`}
        />
        <StatCard
          icon={TrendingDown} label="支出" value={fmtYuan(overview?.expense ?? 0)}
          iconBg="bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
          hint={`项目成本 ${fmtYuan(overview?.expenseBreakdown?.projectCosts ?? 0)}`}
        />
        <StatCard
          icon={Receipt} label="应收账款" value={fmtYuan(recvTotal)}
          iconBg="bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          hint={`待收 ${receivables?.count ?? 0} 笔`}
        />
      </div>

      {/* ── 第二层 · 4 图表 2×2 ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard title="收支趋势">
          <TrendChart
            labels={trends.map((t) => t.month.replace(/^\d{4}-/, ''))}
            lines={[
              { label: '收入', color: '#10b981', values: trends.map((t) => t.income / 100) },
              { label: '支出', color: '#f43f5e', values: trends.map((t) => t.expense / 100) },
              { label: '利润', color: '#6366f1', values: trends.map((t) => t.profit / 100) },
            ]}
            formatValue={(v) => `¥${Math.round(v).toLocaleString('zh-CN')}`}
            details={trends.map((t) => (
              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between"><span className="text-muted-foreground">利润率</span><span className="font-medium">{t.income > 0 ? Math.round((t.profit / t.income) * 100) : 0}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">环比收入</span><span className="font-medium">{fmtYuanRaw(t.income)}</span></div>
              </div>
            ))}
          />
        </SectionCard>

        <SectionCard title="支出结构">
          {costStructure.length === 0 ? (
            <EmptyPlaceholder text="暂无支出" />
          ) : (
            <DonutChart
              data={costStructure.map((s, i) => {
                // 找到原始 category key（后端返回的是 label）
                const rawKey = Object.entries(COST_LABEL).find(([, v]) => v === s.category)?.[0] || s.category;
                return {
                  label: s.category,
                  value: s.amount,
                  color: CHART_COLORS[i % CHART_COLORS.length],
                  detail: (
                    <div>
                      <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="text-[12px] font-semibold text-foreground">{s.category}</span>
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground">{fmtYuanRaw(s.amount)}</span>
                      </div>
                      <div className="mb-2 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">占比</span>
                        <span className="font-mono font-medium">{s.percent}%</span>
                      </div>
                      <CostListInPopover items={costDetails[rawKey] ?? []} />
                    </div>
                  ),
                };
              })}
              centerLabel="总支出"
              centerValue={fmtYuan(costStructure.reduce((s, c) => s + c.amount, 0))}
              formatValue={fmtYuan}
            />
          )}
        </SectionCard>

        <SectionCard title="应收账款明细">
          {!receivables || receivables.items.length === 0 ? (
            <EmptyPlaceholder text="无待收账款" icon="check" />
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">待收合计</span>
                <span className="font-bold tabular-nums text-foreground">{fmtYuanRaw(receivables.total)}</span>
              </div>
              <div className="space-y-2">
                {receivables.items.slice(0, 5).map((item) => (
                  <div key={item.projectId} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
                    <span className="font-medium text-foreground/80 truncate mr-2">{item.name}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-muted-foreground">已收 {fmtYuan(item.received)}</span>
                      <span className="font-mono font-semibold text-amber-600">{fmtYuan(item.outstanding)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="订阅成本"
          right={
            subSummary && subSummary.items.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                月均 {fmtYuanRaw(subSummary.monthlyTotal)} · 年度 {fmtYuanRaw(subSummary.yearlyTotal)}
              </span>
            ) : undefined
          }
        >
          {!subSummary || subSummary.items.length === 0 ? (
            <EmptyPlaceholder text="暂无订阅" icon="package" />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {subSummary.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-foreground">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground">{CYCLE_LABEL[item.cycle] || item.cycle}付</p>
                  </div>
                  <span className="text-sm font-mono font-bold tabular-nums text-foreground">
                    {fmtYuanRaw(item.monthlyAmount)}<span className="text-[10px] text-muted-foreground">/月</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
