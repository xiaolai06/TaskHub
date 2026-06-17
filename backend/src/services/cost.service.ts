import { prisma } from '../server';
import { AppError } from '../utils/errors';

export type CostCategory = 'LABOR' | 'MATERIAL' | 'OVERHEAD' | 'OTHER';

async function verifyProjectOwnership(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: userId },
    select: { id: true },
  });
  if (!project) throw new AppError('项目不存在或无权访问', 404, 'NOT_FOUND');
  return project;
}

async function verifyCostOwnership(userId: string, costId: string) {
  const record = await prisma.costRecord.findFirst({
    where: { id: costId, project: { ownerId: userId } },
    select: { id: true, projectId: true },
  });
  if (!record) throw new AppError('成本记录不存在或无权访问', 404, 'NOT_FOUND');
  return record;
}

export async function findAll(userId: string, projectId: string, filters?: { page?: number; limit?: number; category?: string }) {
  await verifyProjectOwnership(userId, projectId);
  const { page = 1, limit = 20, category } = filters || {};
  const where: Record<string, unknown> = { projectId };
  if (category) where.category = category;

  const [data, total] = await Promise.all([
    prisma.costRecord.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { date: 'desc' } }),
    prisma.costRecord.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getSummaryByProject(userId: string, projectId: string) {
  await verifyProjectOwnership(userId, projectId);
  const [byCategory, recordTotalAgg, taskCostAgg] = await Promise.all([
    prisma.costRecord.groupBy({
      by: ['category'],
      where: { projectId },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.costRecord.aggregate({ where: { projectId }, _sum: { amount: true } }),
    // 排除已有关联 CostRecord 的任务，避免重复计算
    prisma.task.aggregate({ where: { projectId, cost: { gt: 0 }, costRecords: { none: {} } }, _sum: { cost: true }, _count: true }),
  ]);

  const taskCost = taskCostAgg._sum.cost || 0;
  const total = (recordTotalAgg._sum.amount || 0) + taskCost;
  const rows = byCategory.map((item) => ({
    category: item.category,
    amount: item._sum.amount || 0,
    count: item._count,
  }));

  if (taskCost > 0) {
    const labor = rows.find((item) => item.category === 'LABOR');
    if (labor) {
      labor.amount += taskCost;
      labor.count += taskCostAgg._count;
    } else {
      rows.push({ category: 'LABOR', amount: taskCost, count: taskCostAgg._count });
    }
  }

  return {
    total,
    byCategory: rows.map((item) => ({
      ...item,
      percent: total > 0 ? Math.round((item.amount / total) * 100) : 0,
    })),
  };
}

export async function create(userId: string, projectId: string, data: { amount: number; category: string; description: string; date: string; taskId?: string }) {
  await verifyProjectOwnership(userId, projectId);
  return prisma.costRecord.create({ data: { ...data, projectId, date: new Date(data.date) } });
}

export async function remove(userId: string, id: string) {
  await verifyCostOwnership(userId, id);
  return prisma.costRecord.delete({ where: { id } });
}

export async function getMonthlySummary(userId: string, month?: string) {
  const selectedMonth = month || new Date().toISOString().slice(0, 7);
  const start = new Date(`${selectedMonth}-01`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const [records, taskCosts] = await Promise.all([
    prisma.costRecord.findMany({
      where: { project: { ownerId: userId }, date: { gte: start, lt: end } },
      include: { project: { select: { name: true } } },
    }),
    prisma.task.findMany({
      where: { project: { ownerId: userId }, cost: { gt: 0 }, createdAt: { gte: start, lt: end } },
      include: { project: { select: { name: true } } },
    }),
  ]);

  const byProject: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const record of records) {
    byProject[record.project.name] = (byProject[record.project.name] || 0) + record.amount;
    byCategory[record.category] = (byCategory[record.category] || 0) + record.amount;
  }
  for (const task of taskCosts) {
    byProject[task.project.name] = (byProject[task.project.name] || 0) + task.cost;
    byCategory.LABOR = (byCategory.LABOR || 0) + task.cost;
  }

  const total = Object.values(byProject).reduce((sum, amount) => sum + amount, 0);
  return { month: selectedMonth, total, byProject, byCategory };
}