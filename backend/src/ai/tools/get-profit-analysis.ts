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
    const projectIds = projects.map(p => p.id);

    // 批量聚合替代 N+1 查询
    const [costAggs, taskAggs] = await Promise.all([
      projectIds.length > 0 ? prisma.costRecord.groupBy({ by: ['projectId'], where: { projectId: { in: projectIds } }, _sum: { amount: true } }) : [],
      projectIds.length > 0 ? prisma.task.groupBy({ by: ['projectId'], where: { projectId: { in: projectIds }, cost: { gt: 0 } }, _sum: { cost: true } }) : [],
    ]);
    const costMap = new Map(costAggs.map(a => [a.projectId, a._sum.amount || 0]));
    const taskCostMap = new Map(taskAggs.map(a => [a.projectId, a._sum.cost || 0]));

    return projects.map(project => {
      const cost = (costMap.get(project.id) || 0) + (taskCostMap.get(project.id) || 0);
      const quote = project.budget || 0;
      const profit = quote - cost;
      return {
        projectName: project.name,
        customer: project.customer?.name || '未关联客户',
        quote: quote / 100, cost: cost / 100, profit: profit / 100,
        margin: quote > 0 ? `${Math.round((profit / quote) * 100)}%` : '-',
        status: profit > 0 ? '盈利' : profit < 0 ? '亏损' : '持平',
      };
    }).sort((a, b) => b.profit - a.profit);
  },
};