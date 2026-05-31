import { prisma } from '../server';

export type CostCategory = 'LABOR' | 'MATERIAL' | 'OVERHEAD' | 'OTHER';

/** 获取成本列表 */
export async function findAll(projectId: string, filters?: {
  page?: number; limit?: number; category?: string;
}) {
  const { page = 1, limit = 20, category } = filters || {};
  const where: Record<string, unknown> = { projectId };
  if (category) where.category = category;

  const [data, total] = await Promise.all([
    prisma.costRecord.findMany({
      where, skip: (page - 1) * limit, take: limit, orderBy: { date: 'desc' },
    }),
    prisma.costRecord.count({ where }),
  ]);
  return { data, total, page, limit };
}

/** 按类别汇总项目成本 */
export async function getSummaryByProject(projectId: string) {
  const byCategory = await prisma.costRecord.groupBy({
    by: ['category'], where: { projectId },
    _sum: { amount: true }, _count: true,
  });
  const totalAgg = await prisma.costRecord.aggregate({
    where: { projectId }, _sum: { amount: true },
  });
  const total = totalAgg._sum.amount || 0;
  return { total, byCategory: byCategory.map(c => ({
    category: c.category, amount: c._sum.amount || 0, count: c._count,
    percent: total > 0 ? Math.round(((c._sum.amount || 0) / total) * 100) : 0,
  })) };
}

/** 创建成本 */
export async function create(projectId: string, data: { amount: number; category: string; description: string; date: string; taskId?: string }) {
  return prisma.costRecord.create({ data: { ...data, projectId, date: new Date(data.date) } });
}

/** 删除成本 */
export async function remove(id: string) {
  return prisma.costRecord.delete({ where: { id } });
}

/** 按月汇总（跨项目） */
export async function getMonthlySummary(userId: string, month?: string) {
  const m = month || new Date().toISOString().slice(0, 7);
  const start = new Date(m + '-01');
  const end = new Date(start); end.setMonth(end.getMonth() + 1);

  const records = await prisma.costRecord.findMany({
    where: { project: { ownerId: userId }, date: { gte: start, lt: end } },
    include: { project: { select: { name: true } } },
  });
  const total = records.reduce((s, r) => s + r.amount, 0);
  const byProject: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const r of records) {
    byProject[r.project.name] = (byProject[r.project.name] || 0) + r.amount;
    byCategory[r.category] = (byCategory[r.category] || 0) + r.amount;
  }
  return { month: m, total, byProject, byCategory };
}
