import { prisma } from '../server';
import { AppError } from '../utils/errors';

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
    const idx = rows.findIndex((item) => item.category === 'LABOR');
    if (idx >= 0) {
      rows[idx] = { ...rows[idx], amount: rows[idx].amount + taskCost, count: rows[idx].count + taskCostAgg._count };
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

export async function create(
  userId: string,
  projectId: string,
  data: { amount: number; direction?: 'INCOME' | 'EXPENSE'; category: string; description: string; date: string; taskId?: string; note?: string },
) {
  await verifyProjectOwnership(userId, projectId);
  const costDate = new Date(data.date);
  const direction = data.direction || 'EXPENSE';

  const costRecord = await prisma.costRecord.create({
    data: { amount: data.amount, category: data.category, description: data.description, date: costDate, projectId, taskId: data.taskId },
  });

  // 同步到记账中心 Transaction
  try {
    await prisma.transaction.create({
      data: {
        amount: data.amount,
        direction,
        category: data.category,
        description: data.description,
        date: costDate,
        source: 'COST_RECORD_SYNC',
        projectId,
        taskId: data.taskId || null,
        note: data.note || null,
        userId,
      },
    });
  } catch (err) {
    console.error('[cost.service] Transaction sync failed:', { costRecordId: costRecord.id, projectId, error: err });
  }

  return costRecord;
}

export async function remove(userId: string, id: string) {
  const record = await verifyCostOwnership(userId, id);

  // 先读取完整记录用于精确匹配 Transaction
  const costRecord = await prisma.costRecord.findUnique({ where: { id } });

  // 删除 CostRecord
  const deleted = await prisma.costRecord.delete({ where: { id } });

  // 清理同步产生的 Transaction
  if (costRecord) {
    try {
      await prisma.transaction.deleteMany({
        where: {
          source: 'COST_RECORD_SYNC',
          projectId: costRecord.projectId,
          taskId: costRecord.taskId,
          amount: costRecord.amount,
          date: costRecord.date,
        },
      });
    } catch (err) {
      console.error('[cost.service] Transaction cleanup failed:', { costId: id, error: err });
    }
  }

  return deleted;
}

/**
 * 批量同步：把任务中心已有 cost>0 但无 CostRecord 的记录，
 * 一次性创建 CostRecord + Transaction，让记账中心能看到历史数据。
 */
export async function syncTaskCostsToTransactions(userId: string, projectId?: string) {
  const where: Record<string, unknown> = {
    cost: { gt: 0 },
    costRecords: { none: {} }, // 没有关联 CostRecord 的任务
  };
  if (projectId) {
    where.projectId = projectId;
    await verifyProjectOwnership(userId, projectId);
  } else {
    where.project = { ownerId: userId };
  }

  const tasks = await prisma.task.findMany({
    where,
    select: { id: true, title: true, cost: true, projectId: true, createdAt: true },
  });

  let synced = 0;
  for (const task of tasks) {
    try {
      const description = `任务成本同步（任务：${task.title}）`;
      const costRecord = await prisma.costRecord.create({
        data: {
          amount: task.cost,
          category: 'PROJECT_COST',
          description,
          date: task.createdAt,
          projectId: task.projectId,
          taskId: task.id,
        },
      });

      await prisma.transaction.create({
        data: {
          amount: task.cost,
          direction: 'EXPENSE',
          category: 'PROJECT_COST',
          description,
          date: task.createdAt,
          source: 'COST_RECORD_SYNC',
          projectId: task.projectId,
          taskId: task.id,
          userId,
        },
      });
      synced++;
    } catch (err) {
      console.error('[cost.service] sync task cost failed:', { taskId: task.id, error: err });
    }
  }

  return { synced, total: tasks.length };
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
