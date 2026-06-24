'use client';

import { PieChart } from 'lucide-react';
import type { CostSummary as CostSummaryData } from '@/hooks/useCosts';

const categoryLabel: Record<string, string> = {
  // 支出类
  PROJECT_COST: '项目成本',
  SALARY: '工资薪酬',
  RENT: '房租水电',
  MEAL: '餐饮招待',
  TRAVEL: '差旅交通',
  EQUIPMENT: '设备采购',
  OFFICE: '办公用品',
  SUBSCRIPTION: '软件订阅',
  MARKETING: '推广广告',
  TAX: '税费',
  INSURANCE: '保险',
  LOAN_LEND: '借款支出',
  OTHER_EXPENSE: '其他支出',
  // 收入类
  PROJECT_PAYMENT: '项目回款',
  INTEREST: '利息收益',
  REFUND: '退款返佣',
  SUBSIDY: '补贴奖金',
  FREELANCE: '兼职收入',
  LOAN_REPAYMENT: '借款还款',
  ASSET_SALE: '资产出售',
  OTHER_INCOME: '其他收入',
  // 兼容旧数据
  LABOR: '人工',
  MATERIAL: '材料',
  OVERHEAD: '运营',
  OTHER: '其他',
};

function formatYuan(fen: number): string {
  return `¥${(fen / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

export function CostSummary({ summary, quote }: { summary?: CostSummaryData; quote?: number | null }) {
  const total = summary?.total ?? 0;
  const profit = (quote ?? 0) - total;
  const margin = quote && quote > 0 ? Math.round((profit / quote) * 1000) / 10 : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <PieChart className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-slate-700">订单利润</h3>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Metric label="报价" value={formatYuan(quote ?? 0)} />
        <Metric label="成本" value={formatYuan(total)} />
        <Metric label="利润" value={`${formatYuan(profit)} · ${margin}%`} tone={profit >= 0 ? 'good' : 'bad'} />
      </div>
      {summary?.byCategory?.length ? (
        <div className="mt-4 space-y-2">
          {summary.byCategory.map((item) => (
            <div key={item.category}>
              <div className="mb-1 flex justify-between text-2xs-plus text-slate-500">
                <span>{categoryLabel[item.category] || item.category}</span>
                <span>{formatYuan(item.amount)} · {item.percent}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-indigo-400 progress-animate" style={{ width: `${item.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-2xs-plus text-slate-400">{label}</p>
      <p className={tone === 'bad' ? 'mt-1 text-sm font-bold text-red-600' : tone === 'good' ? 'mt-1 text-sm font-bold text-emerald-600' : 'mt-1 text-sm font-bold text-slate-800'}>
        {value}
      </p>
    </div>
  );
}
