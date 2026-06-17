import { prisma } from '../server';
import { CreateProjectInput, UpdateProjectInput } from '../validators/project.schema';

export async function findAll(userId: string, filters: {
  page?: number; limit?: number; status?: string;
  startDate?: string; endDate?: string;
}) {
  const { page = 1, limit = 20, status, startDate, endDate } = filters;
  const where: Record<string, unknown> = { ownerId: userId };
  if (status) where.status = status;
  if (startDate || endDate) {
    where.AND = [
      startDate ? { endDate: { gte: new Date(startDate) } } : {},
      endDate ? { startDate: { lte: new Date(endDate) } } : {},
    ];
  }

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { tasks: true, costRecords: true } },
        customer: { select: { id: true, name: true, company: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  // 批量聚合订单成本（成本记录 + 任务快捷成本，2 次查询替代 2N 次）
  const projectIds = projects.map(p => p.id);
  const [costAggs, taskCostAggs] = projectIds.length > 0
    ? await Promise.all([
        prisma.costRecord.groupBy({
          by: ['projectId'],
          where: { projectId: { in: projectIds } },
          _sum: { amount: true },
        }),
        prisma.task.groupBy({
          by: ['projectId'],
          where: { projectId: { in: projectIds } },
          _sum: { cost: true },
        }),
      ])
    : [[] as { projectId: string; _sum: { amount: number | null } }[], [] as { projectId: string; _sum: { cost: number | null } }[]];

  const costMap = new Map(costAggs.map(r => [r.projectId, r._sum.amount ?? 0]));
  const taskCostMap = new Map(taskCostAggs.map(r => [r.projectId, r._sum.cost ?? 0]));

  const data = projects.map(p => ({
    ...p,
    quote: p.budget ?? 0,
    actualCost: (costMap.get(p.id) ?? 0) + (taskCostMap.get(p.id) ?? 0),
    usedBudget: (costMap.get(p.id) ?? 0) + (taskCostMap.get(p.id) ?? 0),
    profit: (p.budget ?? 0) - ((costMap.get(p.id) ?? 0) + (taskCostMap.get(p.id) ?? 0)),
  }));

  return { data, total, page, limit };
}

export async function findById(userId: string, id: string) {
  const project = await prisma.project.findFirst({
    where: { id, ownerId: userId },
    include: {
      _count: { select: { tasks: true, costRecords: true } },
      tasks: { take: 5, orderBy: { updatedAt: 'desc' } },
      customer: { select: { id: true, name: true, company: true } },
    },
  });
  if (!project) return null;

  const [costAgg, taskCostAgg] = await Promise.all([
    prisma.costRecord.aggregate({ where: { projectId: id }, _sum: { amount: true } }),
    prisma.task.aggregate({ where: { projectId: id }, _sum: { cost: true } }),
  ]);

  const actualCost = (costAgg._sum.amount ?? 0) + (taskCostAgg._sum.cost ?? 0);
  return { ...project, quote: project.budget ?? 0, actualCost, usedBudget: actualCost, profit: (project.budget ?? 0) - actualCost };
}

export async function create(userId: string, data: CreateProjectInput) {
  return prisma.project.create({
    data: {
      name: data.name,
      description: data.description,
      status: data.status ?? 'ACTIVE',
      budget: data.budget,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      endDate: data.endDate ? new Date(data.endDate) : null,
      ownerId: userId,
      customerId: data.customerId || null,
      expenseNote: data.expenseNote,
      rewardNote: data.rewardNote,
      type: data.type,
    },
    include: {
      _count: { select: { tasks: true, costRecords: true } },
      customer: { select: { id: true, name: true, company: true } },
    },
  });
}

export async function update(userId: string, id: string, data: UpdateProjectInput) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.budget !== undefined) updateData.budget = data.budget;
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
  if (data.customerId !== undefined) updateData.customerId = data.customerId || null;
  if (data.expenseNote !== undefined) updateData.expenseNote = data.expenseNote;
  if (data.rewardNote !== undefined) updateData.rewardNote = data.rewardNote;
  if (data.type !== undefined) updateData.type = data.type;

  const result = await prisma.project.updateMany({
    where: { id, ownerId: userId },
    data: updateData,
  });
  if (result.count === 0) return null;

  const project = await prisma.project.findUnique({
    where: { id },
    include: { customer: { select: { id: true, name: true, company: true } } },
  });
  const [costAgg, taskCostAgg] = await Promise.all([
    prisma.costRecord.aggregate({ where: { projectId: id }, _sum: { amount: true } }),
    prisma.task.aggregate({ where: { projectId: id }, _sum: { cost: true } }),
  ]);
  const actualCost = (costAgg._sum.amount ?? 0) + (taskCostAgg._sum.cost ?? 0);
  return { ...project!, quote: project!.budget ?? 0, actualCost, usedBudget: actualCost, profit: (project!.budget ?? 0) - actualCost };
}

export async function archive(userId: string, id: string) {
  const result = await prisma.project.updateMany({
    where: { id, ownerId: userId },
    data: { status: 'ARCHIVED' },
  });
  if (result.count === 0) return null;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return null;

  const [costAgg, taskCostAgg] = await Promise.all([
    prisma.costRecord.aggregate({ where: { projectId: id }, _sum: { amount: true } }),
    prisma.task.aggregate({ where: { projectId: id }, _sum: { cost: true } }),
  ]);
  const actualCost = (costAgg._sum.amount ?? 0) + (taskCostAgg._sum.cost ?? 0);
  return { ...project, quote: project.budget ?? 0, actualCost, usedBudget: actualCost, profit: (project.budget ?? 0) - actualCost };
}

export async function remove(userId: string, id: string) {
  await prisma.$transaction([
    prisma.costRecord.deleteMany({ where: { projectId: id } }),
    prisma.task.deleteMany({ where: { projectId: id } }),
    prisma.project.deleteMany({ where: { id, ownerId: userId } }),
  ]);
  return { deleted: true };
}
