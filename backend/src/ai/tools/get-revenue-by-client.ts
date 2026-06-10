import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const getRevenueByClientTool: ToolDefinition = {
  name: 'get_revenue_by_client', description: '按客户统计收入。当用户问"哪个客户最赚钱"时调用。',
  category: 'finance', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: { limit: { type: 'number', description: '前N个' } } },
  handler: async (args, userId) => {
    const customers = await prisma.customer.findMany({ where: { userId }, include: { projects: { select: { budget: true, status: true } } } });
    const results = customers.map(c => ({ clientName: c.name, company: c.company, status: c.status, totalRevenue: c.projects.reduce((s, p) => s + (p.budget || 0), 0) / 100, projectCount: c.projects.length, activeProjects: c.projects.filter(p => p.status === 'ACTIVE').length }));
    results.sort((a, b) => b.totalRevenue - a.totalRevenue);
    return (args.limit as number) ? results.slice(0, args.limit as number) : results;
  },
};

export const getProjectMarginRankingTool: ToolDefinition = {
  name: 'get_project_margin_ranking', description: '项目利润排名。当用户问"项目利润排名"时调用。',
  category: 'finance', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: { status: { type: 'string', enum: ['ACTIVE','COMPLETED','ARCHIVED'], description: '筛选状态' } } },
  handler: async (args, userId) => {
    const where: Record<string, unknown> = { ownerId: userId };
    if (args.status) where.status = args.status;
    const projects = await prisma.project.findMany({ where, include: { customer: { select: { name: true } } } });
    const projectIds = projects.map(p => p.id);

    // 批量聚合替代 N+1 查询
    const costAggs = projectIds.length > 0
      ? await prisma.costRecord.groupBy({ by: ['projectId'], where: { projectId: { in: projectIds } }, _sum: { amount: true } })
      : [];
    const costMap = new Map(costAggs.map(a => [a.projectId, a._sum.amount || 0]));

    return projects.map(p => {
      const cost = costMap.get(p.id) || 0;
      const budget = p.budget || 0;
      const profit = budget - cost;
      return { projectName: p.name, client: p.customer?.name || '无', status: p.status, budget: budget / 100, cost: cost / 100, profit: profit / 100, margin: budget > 0 ? Math.round((profit / budget) * 100) + '%' : '-' };
    }).sort((a, b) => (b.profit as number) - (a.profit as number));
  },
};
