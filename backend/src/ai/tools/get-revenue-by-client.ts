import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const getRevenueByClientTool: ToolDefinition = {
  name: 'get_revenue_by_client',
  description: `按客户统计收入排名：汇总每个客户的项目预算，按总收入降序排列。支持按月筛选。

使用时机:
- "哪个客户最赚钱"、"客户收入排名"
- "哪个客户贡献最大"、"客户价值"

不使用时机:
- 查看客户跟进状态 → 用 get_client_follow_up
- 查看单个客户详情 → 用 get_client_insights
- 查看项目利润（含成本） → 用 get_profit_analysis
- 记录客户沟通 → 用 log_communication

返回数据: 客户列表含 totalRevenue/projectCount/activeProjects，支持 month+limit 参数`,
  category: 'finance', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: { limit: { type: 'number', description: '前N个' }, month: { type: 'string', description: '筛选月份 YYYY-MM，只统计该月创建的项目' } } },
  handler: async (args, userId) => {
    const projectWhere: Record<string, unknown> = {};
    if (args.month) {
      const start = new Date((args.month as string) + '-01');
      const end = new Date(start); end.setMonth(end.getMonth() + 1);
      projectWhere.createdAt = { gte: start, lt: end };
    }
    const customers = await prisma.customer.findMany({ where: { userId }, include: { projects: { where: projectWhere, select: { budget: true, status: true, createdAt: true } } } });
    const results = customers.filter(c => c.projects.length > 0).map(c => ({ clientName: c.name, company: c.company, status: c.status, totalRevenue: c.projects.reduce((s, p) => s + (p.budget || 0), 0) / 100, projectCount: c.projects.length, activeProjects: c.projects.filter(p => p.status === 'ACTIVE').length }));
    results.sort((a, b) => b.totalRevenue - a.totalRevenue);
    const data = (args.limit as number) ? results.slice(0, args.limit as number) : results;
    const top3 = data.slice(0, 3).map(c => `${c.clientName} ¥${c.totalRevenue}`);
    const totalRevenue = data.reduce((s, c) => s + c.totalRevenue, 0);
    return {
      meta: { tool: 'get_revenue_by_client', timeRange: args.month || '全量', totalInDB: customers.length, returned: data.length },
      highlights: { totalRevenue: Math.round(totalRevenue * 100) / 100, top3, clientCount: data.length },
      summary: `${args.month ? args.month + '月' : '全部'}${data.length}个客户，总收入¥${Math.round(totalRevenue)}${top3.length > 0 ? `，最高${top3[0]}` : ''}`,
      data,
    };
  },
};

export const getProjectMarginRankingTool: ToolDefinition = {
  name: 'get_project_margin_ranking',
  description: `项目利润排名：对比每个项目的预算和实际成本，计算利润率，按利润降序排列。支持按月和按状态筛选。

使用时机:
- "项目利润排名"、"哪个项目最赚"、"项目盈亏排名"
- "哪些项目亏了"、"利润率排名"

不使用时机:
- 查看现金流 → 用 get_cash_flow
- 查看成本明细 → 用 get_cost_breakdown
- 查看客户收入 → 用 get_revenue_by_client
- 查看项目进度 → 用 get_project_progress

返回数据: 项目列表含 budget/cost/profit/margin，支持 month+status 参数`,
  category: 'finance', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: { status: { type: 'string', enum: ['ACTIVE','COMPLETED','ARCHIVED'], description: '筛选状态' }, month: { type: 'string', description: '筛选月份 YYYY-MM，成本按月统计' } } },
  handler: async (args, userId) => {
    const where: Record<string, unknown> = { ownerId: userId };
    if (args.status) where.status = args.status;
    const projects = await prisma.project.findMany({ where, include: { customer: { select: { name: true } } } });
    const projectIds = projects.map(p => p.id);

    // 批量聚合，支持按月筛选成本
    const costWhere: Record<string, unknown> = { projectId: { in: projectIds } };
    if (args.month) {
      const start = new Date((args.month as string) + '-01');
      const end = new Date(start); end.setMonth(end.getMonth() + 1);
      costWhere.date = { gte: start, lt: end };
    }
    const costAggs = projectIds.length > 0
      ? await prisma.costRecord.groupBy({ by: ['projectId'], where: costWhere, _sum: { amount: true } })
      : [];
    const costMap = new Map(costAggs.map(a => [a.projectId, a._sum.amount || 0]));

    const data = projects.map(p => {
      const cost = costMap.get(p.id) || 0;
      const budget = p.budget || 0;
      const profit = budget - cost;
      return { projectName: p.name, client: p.customer?.name || '无', status: p.status, budget: budget / 100, cost: cost / 100, profit: profit / 100, margin: budget > 0 ? Math.round((profit / budget) * 100) + '%' : '-' };
    }).sort((a, b) => (b.profit as number) - (a.profit as number));
    const totalProfit = data.reduce((s, p) => s + (p.profit as number), 0);
    const hasAnomaly = data.some(p => (p.profit as number) < 0);
    return {
      meta: { tool: 'get_project_margin_ranking', timeRange: args.month || '全量', totalInDB: projects.length, returned: data.length, hasAnomaly },
      highlights: { totalProfit: Math.round(totalProfit * 100) / 100, top3: data.slice(0, 3).map(p => `${p.projectName} ¥${p.profit}`), projectCount: data.length },
      summary: `${args.month ? args.month + '月' : '全部'}${data.length}个项目，总利润¥${Math.round(totalProfit)}${hasAnomaly ? '，存在亏损项目' : ''}`,
      data,
    };
  },
};
