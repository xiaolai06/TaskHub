import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const getProfitAnalysisTool: ToolDefinition = {
  name: 'get_profit_analysis',
  description: '分析项目利润，对比预算和实际支出。当用户问"赚了多少"、"利润"、"盈亏"时调用。',
  category: 'finance', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: { projectId: { type: 'string', description: '项目ID，不传则分析所有活跃项目' } } },
  handler: async (args, userId) => {
    const where: Record<string, unknown> = { ownerId: userId, status: 'ACTIVE' };
    if (args.projectId) where.id = args.projectId;
    const projects = await prisma.project.findMany({ where, include: { customer: { select: { name: true } } } });
    const results = [];
    for (const p of projects) {
      const agg = await prisma.costRecord.aggregate({ where: { projectId: p.id }, _sum: { amount: true } });
      const cost = agg._sum.amount || 0, budget = p.budget || 0, profit = budget - cost;
      results.push({ projectName: p.name, client: p.customer?.name || '无', budget: budget / 100, cost: cost / 100, profit: profit / 100, margin: budget > 0 ? Math.round((profit / budget) * 100) + '%' : '-', status: profit > 0 ? '盈利' : profit < 0 ? '亏损' : '持平' });
    }
    return results.sort((a, b) => (b.profit as number) - (a.profit as number));
  },
};
