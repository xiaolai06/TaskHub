import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const getCostBreakdownTool: ToolDefinition = {
  name: 'get_cost_breakdown',
  description: '成本明细分析。当用户问"钱花在哪了"、"成本明细"时调用。',
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
    return { total: total / 100, byCategory: byCat.map(c => ({ category: c.category, amount: (c._sum.amount || 0) / 100, count: c._count, percent: total > 0 ? Math.round(((c._sum.amount || 0) / total) * 100) + '%' : '0%' })), byProject: byProj.map(p => ({ project: projMap.get(p.projectId) || '未知', amount: (p._sum.amount || 0) / 100 })) };
  },
};
