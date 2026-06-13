import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const getCashFlowTool: ToolDefinition = {
  name: 'get_cash_flow',
  description: `查询指定月份的现金流：收入（已完成项目报价）vs 支出（成本记录），按类别分组。

使用时机:
- "花了多少钱"、"现金流"、"收支"、"这个月进出账"
- "收入多少支出多少"、"资金情况"

不使用时机:
- 查看利润分析（报价 vs 成本） → 用 get_profit_analysis
- 查看成本明细分类 → 用 get_cost_breakdown
- 查看客户贡献排名 → 用 get_revenue_by_client

返回数据: month/income/expense/net/byCategory/incomeFrom，支持 month 参数(YYYY-MM)`,
  category: 'finance', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: { month: { type: 'string', description: '月份 YYYY-MM' } } },
  handler: async (args, userId) => {
    const m = (args.month as string) || new Date().toISOString().slice(0, 7);
    const start = new Date(m + '-01'); const end = new Date(start); end.setMonth(end.getMonth() + 1);
    const costs = await prisma.costRecord.groupBy({ by: ['category'], where: { date: { gte: start, lt: end }, project: { ownerId: userId } }, _sum: { amount: true } });
    const completed = await prisma.project.findMany({ where: { ownerId: userId, endDate: { gte: start, lt: end } }, select: { name: true, budget: true } });
    const totalExp = costs.reduce((s, c) => s + (c._sum.amount || 0), 0);
    const totalInc = completed.reduce((s, p) => s + (p.budget || 0), 0);
    const byCategory = costs.map(c => ({ category: c.category, amount: (c._sum.amount || 0) / 100 }));
    const incomeFrom = completed.map(p => ({ project: p.name, amount: (p.budget || 0) / 100 }));
    const biggestExp = byCategory.length > 0 ? byCategory.reduce((max, c) => c.amount > max.amount ? c : max) : null;
    const net = (totalInc - totalExp) / 100;
    return {
      meta: { tool: 'get_cash_flow', timeRange: m, startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] },
      highlights: { totalIncome: totalInc / 100, totalExpense: totalExp / 100, netFlow: net, biggestExpense: biggestExp ? `${biggestExp.category} (¥${biggestExp.amount})` : '-' },
      summary: `${m}月 净现金流¥${net}，收入¥${totalInc / 100}，支出¥${totalExp / 100}${biggestExp ? `，最大支出${biggestExp.category}` : ''}`,
      data: { month: m, income: totalInc / 100, expense: totalExp / 100, net, byCategory, incomeFrom },
    };
  },
};
