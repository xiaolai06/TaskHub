import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const getCashFlowTool: ToolDefinition = {
  name: 'get_cash_flow',
  description: '查询指定月份的现金流。当用户问"花了多少钱"、"现金流"、"收支"时调用。',
  category: 'finance', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: { month: { type: 'string', description: '月份 YYYY-MM' } } },
  handler: async (args, userId) => {
    const m = (args.month as string) || new Date().toISOString().slice(0, 7);
    const start = new Date(m + '-01'); const end = new Date(start); end.setMonth(end.getMonth() + 1);
    const costs = await prisma.costRecord.groupBy({ by: ['category'], where: { date: { gte: start, lt: end }, project: { ownerId: userId } }, _sum: { amount: true } });
    const completed = await prisma.project.findMany({ where: { ownerId: userId, endDate: { gte: start, lt: end } }, select: { name: true, budget: true } });
    const totalExp = costs.reduce((s, c) => s + (c._sum.amount || 0), 0);
    const totalInc = completed.reduce((s, p) => s + (p.budget || 0), 0);
    return { month: m, income: totalInc / 100, expense: totalExp / 100, net: (totalInc - totalExp) / 100, byCategory: costs.map(c => ({ category: c.category, amount: (c._sum.amount || 0) / 100 })), incomeFrom: completed.map(p => ({ project: p.name, amount: (p.budget || 0) / 100 })) };
  },
};
