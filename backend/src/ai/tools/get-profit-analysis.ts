import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const getProfitAnalysisTool: ToolDefinition = {
  name: 'get_profit_analysis',
  description: '分析订单利润，对比每单报价和实际成本。当用户问“赚了多少”“利润”“盈亏”“哪个订单不划算”时调用。',
  category: 'finance',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: '项目/订单 ID，不传则分析所有进行中订单' },
    },
  },
  handler: async (args, userId) => {
    const where: Record<string, unknown> = { ownerId: userId, status: 'ACTIVE' };
    if (args.projectId) where.id = args.projectId;
    const projects = await prisma.project.findMany({ where, include: { customer: { select: { name: true } } } });
    const results = [];

    for (const project of projects) {
      const [recordCostAgg, taskCostAgg] = await Promise.all([
        prisma.costRecord.aggregate({ where: { projectId: project.id }, _sum: { amount: true } }),
        prisma.task.aggregate({ where: { projectId: project.id, cost: { gt: 0 } }, _sum: { cost: true } }),
      ]);
      const cost = (recordCostAgg._sum.amount || 0) + (taskCostAgg._sum.cost || 0);
      const quote = project.budget || 0;
      const profit = quote - cost;
      results.push({
        projectName: project.name,
        customer: project.customer?.name || '未关联客户',
        quote: quote / 100,
        cost: cost / 100,
        profit: profit / 100,
        margin: quote > 0 ? `${Math.round((profit / quote) * 100)}%` : '-',
        status: profit > 0 ? '盈利' : profit < 0 ? '亏损' : '持平',
      });
    }

    return results.sort((a, b) => b.profit - a.profit);
  },
};