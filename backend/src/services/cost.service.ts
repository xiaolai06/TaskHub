import { prisma } from '../server';
import { AppError } from '../utils/errors';

export type CostCategory = 'LABOR' | 'MATERIAL' | 'OVERHEAD' | 'OTHER';

/** 验证项目归属权 */
async function verifyProjectOwnership(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: userId },
    select: { id: true },
  });
  if (!project) {
    throw new AppError('项目不存在或无权访问', 404, 'NOT_FOUND');
  }
  return project;
}

/** 验证成本记录归属权 */
async function verifyCostOwnership(userId: string, costId: string) {
  const record = await prisma.costRecord.findFirst({
    where: { id: costId, project: { ownerId: userId } },
    select: { id: true, projectId: true },
  });
  if (!record) {
    throw new AppError('成本记录不存在或无权访问', 404, 'NOT_FOUND');
  }
  return record;
}

/** 获取成本列表 */
export async function findAll(userId: string, projectId: string, filters?: {
  page?: number; limit?: number; category?: string;
}) {
  await verifyProjectOwnership(userId, projectId);
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
export async function getSummaryByProject(userId: string, projectId: string) {
  await verifyProjectOwnership(userId, projectId);
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
export async function create(userId: string, projectId: string, data: { amount: number; category: string; description: string; date: string; taskId?: string }) {
  await verifyProjectOwnership(userId, projectId);
  return prisma.costRecord.create({ data: { ...data, projectId, date: new Date(data.date) } });
}

/** 删除成本 */
export async function remove(userId: string, id: string) {
  await verifyCostOwnership(userId, id);
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
