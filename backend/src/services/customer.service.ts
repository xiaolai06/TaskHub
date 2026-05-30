import { prisma } from '../server';
import type { CreateCustomerInput, UpdateCustomerInput } from '../validators/customer.schema';

interface ListFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

/** 批量查项目的已花费和已完成任务数 */
async function batchProjectStats(projectIds: string[]) {
  if (projectIds.length === 0) return { costMap: new Map(), completedMap: new Map() };
  const [costAggs, completedCounts] = await Promise.all([
    prisma.$queryRaw<{ projectId: string; total: number }[]>`
      SELECT "projectId", COALESCE(SUM("amount"), 0) as total
      FROM "CostRecord" WHERE "projectId" IN (${projectIds})
      GROUP BY "projectId"`,
    prisma.$queryRaw<{ projectId: string; cnt: number }[]>`
      SELECT "projectId", COUNT(*) as cnt
      FROM "Task" WHERE "projectId" IN (${projectIds}) AND "status" = 'DONE'
      GROUP BY "projectId"`,
  ]);
  return {
    costMap: new Map(costAggs.map((r) => [r.projectId, Number(r.total)])),
    completedMap: new Map(completedCounts.map((r) => [r.projectId, Number(r.cnt)])),
  };
}

export async function findAll(userId: string, filters: ListFilters) {
  const { page = 1, limit = 20, search, status, startDate, endDate } = filters;
  const where: Record<string, unknown> = { userId };
  if (status) where.status = status;
  if (startDate || endDate) {
    const createdAt: Record<string, unknown> = {};
    if (startDate) createdAt.gte = new Date(startDate);
    if (endDate) createdAt.lte = new Date(endDate + 'T23:59:59.999Z');
    where.createdAt = createdAt;
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { company: { contains: search } },
      { email: { contains: search } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.customer.count({ where }),
  ]);

  const customerIds = data.map((c) => c.id);
  const [allProjects, allLastContacts] = await Promise.all([
    prisma.project.findMany({
      where: { customerId: { in: customerIds } },
      select: {
        id: true, customerId: true, name: true, status: true, type: true,
        budget: true, rewardNote: true, expenseNote: true,
        _count: { select: { tasks: true } },
      },
    }),
    prisma.communication.findMany({
      where: { customerId: { in: customerIds } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, customerId: true, type: true, createdAt: true, nextFollowAt: true },
    }),
  ]);

  // 按 customerId 分组
  const projectMap = new Map<string, typeof allProjects>();
  for (const p of allProjects) {
    if (!p.customerId) continue;
    const list = projectMap.get(p.customerId) ?? [];
    list.push(p);
    projectMap.set(p.customerId, list);
  }
  const lastContactMap = new Map<string, typeof allLastContacts[0]>();
  for (const c of allLastContacts) {
    if (!c.customerId) continue;
    if (!lastContactMap.has(c.customerId)) lastContactMap.set(c.customerId, c);
  }

  // 批量查项目统计
  const allProjectIds = allProjects.map((p) => p.id);
  const { costMap, completedMap } = await batchProjectStats(allProjectIds);

  const enriched = data.map((c) => {
    const projects = (projectMap.get(c.id) ?? []).map((p) => ({
      id: p.id, name: p.name, status: p.status, type: p.type,
      budget: p.budget, rewardNote: p.rewardNote, expenseNote: p.expenseNote,
      usedBudget: costMap.get(p.id) ?? 0,
      taskCount: p._count.tasks,
      completedTaskCount: completedMap.get(p.id) ?? 0,
    }));
    const totalBudget = projects.reduce((s, p) => s + (p.budget ?? 0), 0);
    const totalSpent = projects.reduce((s, p) => s + p.usedBudget, 0);
    const lastContact = lastContactMap.get(c.id);
    return {
      ...c, projects, projectCount: projects.length, totalBudget, totalSpent,
      lastContactAt: lastContact?.createdAt ?? null,
      lastContactType: lastContact?.type ?? null,
      nextFollowAt: lastContact?.nextFollowAt ?? null,
    };
  });

  return { data: enriched, total, page, limit };
}

export async function findById(userId: string, id: string) {
  const customer = await prisma.customer.findFirst({
    where: { id, userId },
    include: { _count: { select: { communications: true } } },
  });
  if (!customer) return null;

  const [projects, communications] = await Promise.all([
    prisma.project.findMany({
      where: { customerId: id },
      select: {
        id: true, name: true, status: true, type: true,
        budget: true, rewardNote: true, expenseNote: true,
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.communication.findMany({
      where: { customerId: id },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { id: true, name: true } } },
    }),
  ]);

  const projectIds = projects.map((p) => p.id);
  const { costMap, completedMap } = await batchProjectStats(projectIds);

  const enrichedProjects = projects.map((p) => {
    const { _count, ...rest } = p;
    return {
      ...rest,
      usedBudget: costMap.get(p.id) ?? 0,
      taskCount: _count.tasks,
      completedTaskCount: completedMap.get(p.id) ?? 0,
    };
  });

  const totalBudget = enrichedProjects.reduce((s, p) => s + (p.budget ?? 0), 0);
  const totalSpent = enrichedProjects.reduce((s, p) => s + p.usedBudget, 0);
  const lastContact = communications[0] ?? null;

  return {
    ...customer,
    projects: enrichedProjects,
    projectCount: enrichedProjects.length,
    totalBudget, totalSpent,
    lastContactAt: lastContact?.createdAt ?? null,
    lastContactType: lastContact?.type ?? null,
    nextFollowAt: lastContact?.nextFollowAt ?? null,
    communications,
  };
}

export async function create(userId: string, data: CreateCustomerInput) {
  return prisma.customer.create({
    data: {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      address: data.address || null,
      industry: data.industry || null,
      status: data.status ?? 'ACTIVE',
      notes: data.notes || null,
      userId,
    },
  });
}

export async function update(userId: string, id: string, data: UpdateCustomerInput) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email || null;
  if (data.phone !== undefined) updateData.phone = data.phone || null;
  if (data.company !== undefined) updateData.company = data.company || null;
  if (data.address !== undefined) updateData.address = data.address || null;
  if (data.industry !== undefined) updateData.industry = data.industry || null;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes || null;

  const result = await prisma.customer.updateMany({
    where: { id, userId },
    data: updateData,
  });
  if (result.count === 0) return null;
  return prisma.customer.findUnique({ where: { id } });
}

export async function remove(userId: string, id: string) {
  const result = await prisma.customer.deleteMany({ where: { id, userId } });
  return { deleted: result.count > 0 };
}
