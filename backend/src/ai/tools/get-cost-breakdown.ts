import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const getCostBreakdownTool: ToolDefinition = {
  name: 'get_cost_breakdown',
  description: `成本明细分析：按类别和项目分组统计成本，含金额、笔数、占比百分比。支持按月和按项目筛选。

使用时机:
- "钱花在哪了"、"成本明细"、"成本分类"
- "哪个类别花钱最多"、"项目成本"

不使用时机:
- 查看现金流（含收入） → 用 get_cash_flow
- 查看利润分析（报价 vs 成本） → 用 get_profit_analysis
- 查看项目进度 → 用 get_project_progress

返回数据: total/byCategory(类别+金额+笔数+占比)/byProject(项目+金额)，支持 month+projectId 参数`,
  category: 'finance', access: 'read', requiresConfirmation: false, preferredModel: 'fast',
  parameters: { type: 'object', properties: { projectId: { type: 'string', description: '限定项目' }, month: { type: 'string', description: '限定月份' } } },
  handler: async (args, userId) => {
    const where: Record<string, unknown> = { project: { ownerId: userId } };
    if (args.projectId) where.projectId = args.projectId;
    if (args.month) { const s = new Date(args.month + '-01'); const e = new Date(s); e.setMonth(e.getMonth() + 1); where.date = { gte: s, lt: e }; }
    const byCat = await prisma.costRecord.groupBy({ by: ['category'], where, _sum: { amount: true }, _count: true });
    const byProj = await prisma.costRecord.groupBy({ by: ['projectId'], where, _sum: { amount: true } });
    const projIds = byProj.map(p => p.projectId);
    const projects = await prisma.project.findMany({ where: { id: { in: projIds } }, select: { id: true, name: true } });
    const projMap = new Map(projects.map(p => [p.id, p.name]));
    const total = byCat.reduce((s, c) => s + (c._sum.amount || 0), 0);
    const byCategory = byCat.map(c => ({ category: c.category, amount: (c._sum.amount || 0) / 100, count: c._count, percent: total > 0 ? Math.round(((c._sum.amount || 0) / total) * 100) + '%' : '0%' }));
    const byProject = byProj.map(p => ({ project: projMap.get(p.projectId) || '未知', amount: (p._sum.amount || 0) / 100 }));
    const top3 = byCategory.slice(0, 3).map(c => `${c.category} ¥${c.amount}`);
    return {
      meta: { tool: 'get_cost_breakdown', timeRange: args.month || '全量', totalInDB: byCat.reduce((s, c) => s + c._count, 0), returned: byCategory.length },
      highlights: { totalCost: total / 100, top3Categories: top3, avgPerProject: byProject.length > 0 ? Math.round((total / 100) / byProject.length) : 0 },
      summary: `${args.month ? args.month + '月' : '全部'}总成本¥${total / 100}，${byCategory.length}个类别，${byProject.length}个项目${top3.length > 0 ? `，最大支出${top3[0]}` : ''}`,
      data: { total: total / 100, byCategory, byProject },
    };
  },
};
