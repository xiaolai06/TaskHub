import { ToolDefinition } from './types';

export const getFinancialTrendsTool: ToolDefinition = {
  name: 'get_financial_trends',
  description: `查询近 N 个月的收支趋势变化，逐月展示收入、支出、利润。

使用时机:
- "最近几个月的收支趋势"
- "看看收入变化"
- "利润走势怎么样"

不使用时机:
- 查看当月详细财务 → 用 get_report_overview
- 查看利润分析 → 用 get_profit_analysis
- 与上期对比 → 用 get_comparison`,
  category: 'finance',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      months: { type: 'number', description: '查看最近几个月，默认 6' },
    },
  },
  handler: async (args, userId) => {
    const { getFinancialTrends } = await import('../../services/finance.service');
    const months = (args.months as number) || 6;
    const data = await getFinancialTrends(userId, months);

    const totalIncome = data.reduce((s, m) => s + m.income, 0);
    const totalExpense = data.reduce((s, m) => s + m.expense, 0);
    const totalProfit = totalIncome - totalExpense;

    return {
      meta: { months, unit: '分' },
      highlights: [
        `近 ${months} 月总收入：¥${(totalIncome / 100).toFixed(2)}`,
        `近 ${months} 月总支出：¥${(totalExpense / 100).toFixed(2)}`,
        `近 ${months} 月净利润：¥${(totalProfit / 100).toFixed(2)}`,
      ],
      data: data.map(m => ({
        month: m.month,
        income: m.income / 100,
        expense: m.expense / 100,
        profit: m.profit / 100,
      })),
    };
  },
};

export const getComparisonTool: ToolDefinition = {
  name: 'get_comparison',
  description: `将当前周期与上一周期的财务数据对比，展示增减变化百分比。

使用时机:
- "跟上个月比怎么样"
- "本月比上月好了吗"
- "环比变化"

不使用时机:
- 趋势走势 → 用 get_financial_trends
- 当月详情 → 用 get_report_overview`,
  category: 'finance',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      period: { type: 'string', description: '周期 YYYY-MM，默认当月' },
      type: { type: 'string', enum: ['day', 'month', 'year'], description: '周期类型，默认 month' },
    },
  },
  handler: async (args, userId) => {
    const { getComparison } = await import('../../services/finance.service');
    const period = args.period as string | undefined;
    const type = (args.type as 'day' | 'month' | 'year') || 'month';
    const result = await getComparison(userId, period, type);

    const fmt = (v: number) => `¥${(v / 100).toFixed(2)}`;
    const chg = (v: number) => v > 0 ? `↑${v.toFixed(1)}%` : v < 0 ? `↓${Math.abs(v).toFixed(1)}%` : '持平';

    return {
      meta: { period: period || '当月', type },
      highlights: [
        `收入：${fmt(result.current.income)}（${chg(result.changes.income)}）`,
        `支出：${fmt(result.current.expense)}（${chg(result.changes.expense)}）`,
        `利润：${fmt(result.current.profit)}（${chg(result.changes.profit)}）`,
      ],
      data: {
        current: {
          income: result.current.income / 100,
          expense: result.current.expense / 100,
          profit: result.current.profit / 100,
        },
        previous: {
          income: result.previous.income / 100,
          expense: result.previous.expense / 100,
          profit: result.previous.profit / 100,
        },
        changes: result.changes,
      },
    };
  },
};
