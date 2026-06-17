import { prisma } from '../server';
import { AppError } from '../utils/errors';

type RangeType = 'day' | 'month' | 'year';

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function resolveType(type?: string): RangeType {
  if (type === 'day' || type === 'year') return type;
  return 'month';
}

function parseRange(period: string | undefined, type: 'day' | 'month' | 'year', endDate?: string): { start: Date; end: Date } {
  const val = period || getCurrentMonth();
  const parts = val.split('-').map(Number);

  if (!Number.isFinite(parts[0]) || parts[0] < 2000 || parts[0] > 2100) {
    throw new AppError('日期格式无效，请使用 YYYY-MM 或 YYYY-MM-DD 格式', 400, 'VALIDATION_ERROR');
  }

  if (type === 'day' && endDate) {
    const sp = val.split('-').map(Number);
    const ep = endDate.split('-').map(Number);
    return { start: new Date(sp[0], sp[1] - 1, sp[2]), end: new Date(ep[0], ep[1] - 1, ep[2], 23, 59, 59) };
  }

  if (type === 'day') {
    const y = parts[0], m = parts[1] || 1, d = parts[2] || 1;
    return { start: new Date(y, m - 1, d), end: new Date(y, m - 1, d, 23, 59, 59) };
  }

  if (type === 'year') {
    const y = parts[0];
    return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59) };
  }

  const y = parts[0], m = parts[1] || 1;
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59) };
}

async function getProjectCostMap(projectIds: string[], start: Date, end: Date) {
  if (projectIds.length === 0) return new Map<string, number>();

  // 只查 CostRecord，不重复计入 Task.cost
  const rows = await prisma.costRecord.groupBy({
    by: ['projectId'],
    where: { projectId: { in: projectIds }, date: { gte: start, lte: end } },
    _sum: { amount: true },
  });
  const costMap = new Map(rows.map((row) => [row.projectId, row._sum.amount ?? 0]));

  // 兜底：没有关联 CostRecord 的孤立任务 cost
  const taskIdsWithRecord = await prisma.costRecord.findMany({
    where: { projectId: { in: projectIds }, date: { gte: start, lte: end }, taskId: { not: null } },
    select: { taskId: true },
  });
  const excludeIds = taskIdsWithRecord.map((r) => r.taskId!).filter(Boolean);
  const orphanTasks = await prisma.task.groupBy({
    by: ['projectId'],
    where: {
      projectId: { in: projectIds },
      cost: { gt: 0 },
      createdAt: { gte: start, lte: end },
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
    },
    _sum: { cost: true },
  });
  for (const row of orphanTasks) {
    const existing = costMap.get(row.projectId) ?? 0;
    costMap.set(row.projectId, existing + (row._sum.cost ?? 0));
  }

  return costMap;
}

export async function getOverview(userId: string, period?: string, type?: string, endDate?: string) {
  const { start, end } = parseRange(period, resolveType(type), endDate);

  // 收入：项目回款（Payment.receivedAt 在范围内）
  const paymentAgg = await prisma.payment.aggregate({
    where: {
      receivedAt: { gte: start, lte: end },
      project: { ownerId: userId },
    },
    _sum: { amount: true },
  });
  const monthlyIncome = paymentAgg._sum.amount || 0;

  const projects = await prisma.project.findMany({
    where: { ownerId: userId, status: { not: 'ARCHIVED' } },
    select: { id: true, budget: true },
  });
  const projectIds = projects.map((project) => project.id);
  const costMap = await getProjectCostMap(projectIds, start, end);

  const cost = projectIds.reduce((sum, id) => sum + (costMap.get(id) ?? 0), 0);
  const quoteTotal = projects.reduce((sum, project) => sum + (project.budget ?? 0), 0);
  const profit = monthlyIncome - cost;
  const margin = monthlyIncome > 0 ? Math.round((profit / monthlyIncome) * 1000) / 10 : 0;

  return {
    income: monthlyIncome,
    monthlyIncome,
    expense: cost,
    cost,
    quoteTotal,
    profit,
    margin,
    period: period || getCurrentMonth(),
    type,
  };
}

export async function getProjectRanking(userId: string, period?: string, type?: string, endDate?: string) {
  const { start, end } = parseRange(period, resolveType(type), endDate);
  const projects = await prisma.project.findMany({
    where: { ownerId: userId },
    select: {
      id: true, name: true, budget: true, status: true,
      payments: { where: { receivedAt: { gte: start, lte: end } }, select: { amount: true } },
    },
  });

  const projectIds = projects.map((project) => project.id);
  const costMap = await getProjectCostMap(projectIds, start, end);

  const ranking = projects.map((project) => {
    const quote = project.budget ?? 0;
    const received = project.payments.reduce((sum, p) => sum + p.amount, 0);
    const cost = costMap.get(project.id) ?? 0;
    const profit = received - cost;
    const margin = received > 0 ? Math.round((profit / received) * 1000) / 10 : 0;
    return {
      id: project.id,
      name: project.name,
      budget: quote,
      quote,
      received,
      cost,
      profit,
      margin,
    };
  });
  return [...ranking].sort((a, b) => b.profit - a.profit);
}

export async function getCostStructure(userId: string, period?: string, type?: string, endDate?: string) {
  const { start, end } = parseRange(period, resolveType(type), endDate);

  // 只查 CostRecord，不再重复计入 Task.cost（Task.cost 是从 CostRecord 聚合的）
  const records = await prisma.costRecord.findMany({
    where: { project: { ownerId: userId }, date: { gte: start, lte: end } },
    select: { category: true, amount: true, taskId: true },
  });

  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const record of records) {
    const cat = record.category || 'OTHER';
    byCategory[cat] = (byCategory[cat] || 0) + record.amount;
    total += record.amount;
  }

  // 查询没有关联 CostRecord 的任务自身 cost（兜底，防止遗漏）
  const taskIdsWithRecord = records.filter((r) => r.taskId).map((r) => r.taskId!);
  const orphanTasks = await prisma.task.findMany({
    where: {
      project: { ownerId: userId },
      cost: { gt: 0 },
      createdAt: { gte: start, lte: end },
      id: { notIn: taskIdsWithRecord },
    },
    select: { cost: true },
  });
  const orphanCost = orphanTasks.reduce((s, t) => s + t.cost, 0);
  if (orphanCost > 0) {
    byCategory.LABOR = (byCategory.LABOR || 0) + orphanCost;
    total += orphanCost;
  }

  const labels: Record<string, string> = { LABOR: '人工', MATERIAL: '材料', OVERHEAD: '运营', OTHER: '其他' };
  return Object.entries(byCategory).map(([category, amount]) => ({
    category: labels[category] || category,
    amount,
    percent: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
  }));
}

export async function getTimeAnalysis(userId: string, period?: string, type?: string, endDate?: string) {
  const { start, end } = parseRange(period, resolveType(type), endDate);
  const entries = await prisma.timeEntry.findMany({
    where: { userId, date: { gte: start, lte: end } },
    include: { project: { select: { name: true } } },
  });
  const byProject: Record<string, number> = {};
  let total = 0;
  for (const entry of entries) {
    const name = entry.project?.name || '未关联项目';
    byProject[name] = (byProject[name] || 0) + entry.hours;
    total += entry.hours;
  }
  const daysInPeriod = type === 'day' ? 1 : type === 'year' ? 365 : new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  return {
    byProject: Object.entries(byProject).map(([project, hours]) => ({ project, hours: Math.round(hours * 10) / 10 })),
    totalHours: Math.round(total * 10) / 10,
    avgPerDay: Math.round((total / daysInPeriod) * 10) / 10,
  };
}

// ─── 新增：应收账款明细 ───

export async function getReceivables(userId: string) {
  const projects = await prisma.project.findMany({
    where: { ownerId: userId, budget: { gt: 0 }, status: { not: 'ARCHIVED' } },
    select: {
      id: true,
      name: true,
      budget: true,
      status: true,
      payments: { select: { amount: true } },
    },
  });

  const items = projects
    .map((p) => {
      const received = p.payments.reduce((s, pay) => s + pay.amount, 0);
      const outstanding = (p.budget ?? 0) - received;
      return {
        projectId: p.id,
        name: p.name,
        budget: p.budget ?? 0,
        received,
        outstanding: Math.max(0, outstanding),
        receiveRate: (p.budget ?? 0) > 0 ? Math.round((received / (p.budget ?? 1)) * 1000) / 10 : 0,
        status: p.status,
      };
    })
    .filter((i) => i.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  const total = items.reduce((s, i) => s + i.outstanding, 0);
  return { items, total, count: items.length };
}

// ─── 新增：订阅成本月报 ───

export async function getSubscriptionSummary(userId: string) {
  const subs = await prisma.subscription.findMany({
    where: { userId, status: { not: 'CANCELLED' } },
    select: { id: true, name: true, amount: true, cycle: true, category: true, status: true, exchangeRate: true },
    orderBy: { amount: 'desc' },
  });

  let monthlyTotal = 0;
  const items = subs.map((s) => {
    const amountFen = Math.round(s.amount * s.exchangeRate);
    const monthlyAmount = s.cycle === 'YEARLY' ? Math.round(amountFen / 12) : s.cycle === 'QUARTERLY' ? Math.round(amountFen / 3) : amountFen;
    monthlyTotal += monthlyAmount;
    return {
      id: s.id,
      name: s.name,
      amount: s.amount,
      cycle: s.cycle,
      category: s.category,
      status: s.status,
      monthlyAmount,
    };
  });

  return { items, monthlyTotal, yearlyTotal: monthlyTotal * 12 };
}

// ─── 新增：项目统计概览 ───

export async function getProjectStats(userId: string, period?: string, type?: string, endDate?: string) {
  const { start, end } = parseRange(period, resolveType(type), endDate);

  const [activeCount, completedCount, completedInRange, projects] = await Promise.all([
    prisma.project.count({ where: { ownerId: userId, status: 'ACTIVE' } }),
    prisma.project.count({ where: { ownerId: userId, status: 'COMPLETED' } }),
    prisma.project.count({ where: { ownerId: userId, status: 'COMPLETED', completedAt: { gte: start, lte: end } } }),
    prisma.project.findMany({
      where: { ownerId: userId, status: 'ACTIVE' },
      select: { budget: true },
    }),
  ]);

  const budgetTotal = projects.reduce((s, p) => s + (p.budget ?? 0), 0);

  // 计算总利润率：来自 getProjectRanking
  const ranking = await getProjectRanking(userId, period, type, endDate);
  const totalReceived = ranking.reduce((s, r) => s + r.received, 0);
  const totalCost = ranking.reduce((s, r) => s + r.cost, 0);
  const totalMargin = totalReceived > 0 ? Math.round(((totalReceived - totalCost) / totalReceived) * 1000) / 10 : 0;

  return {
    activeCount,
    completedCount,
    completedInRange,
    budgetTotal,
    totalMargin,
  };
}

// ─── 新增：项目明细表 ───

export async function getProjectDetail(userId: string, period?: string, type?: string, endDate?: string) {
  const ranking = await getProjectRanking(userId, period, type, endDate);
  const projects = await prisma.project.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true, type: true, status: true },
  });

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  return ranking.map((r) => {
    const p = projectMap.get(r.id);
    return {
      ...r,
      type: p?.type ?? '-',
      status: p?.status ?? '-',
    };
  });
}

// ─── 新增：任务统计（状态 + 优先级分布） ───

export async function getTaskStats(userId: string, period?: string, type?: string, endDate?: string) {
  const { start, end } = parseRange(period, resolveType(type), endDate);

  // 任务筛选：期间内创建 OR 期间内完成 — 覆盖所有活跃在该期间的任务
  const periodFilter = {
    OR: [
      { createdAt: { gte: start, lte: end } },
      { completedAt: { gte: start, lte: end } },
    ],
  };

  const [statusGroups, priorityGroups, overdueCount, totalActive, costAgg] = await Promise.all([
    prisma.task.groupBy({
      by: ['status'],
      where: { project: { ownerId: userId }, ...periodFilter },
      _count: { id: true },
    }),
    prisma.task.groupBy({
      by: ['priority'],
      where: { project: { ownerId: userId }, status: { not: 'DONE' }, ...periodFilter },
      _count: { id: true },
    }),
    prisma.task.count({
      where: { project: { ownerId: userId }, dueDate: { lt: new Date() }, status: { not: 'DONE' }, ...periodFilter },
    }),
    prisma.task.count({
      where: { project: { ownerId: userId }, status: { not: 'DONE' }, ...periodFilter },
    }),
    prisma.task.aggregate({
      where: { project: { ownerId: userId }, cost: { gt: 0 }, ...periodFilter },
      _sum: { cost: true },
    }),
  ]);

  const statusDist = statusGroups.map((g) => ({ status: g.status, count: g._count.id }));
  const totalTasks = statusGroups.reduce((s, g) => s + g._count.id, 0);
  const doneTasks = statusGroups.find((g) => g.status === 'DONE')?._count.id ?? 0;
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const priorityDist = priorityGroups.map((g) => ({ priority: g.priority, count: g._count.id }));

  return {
    statusDist,
    priorityDist,
    totalTasks,
    doneTasks,
    completionRate,
    overdueCount,
    totalActive,
    totalCost: costAgg._sum.cost ?? 0,
  };
}

// ─── 新增：逾期任务列表 ───

export async function getOverdueTasks(userId: string) {
  return prisma.task.findMany({
    where: { project: { ownerId: userId }, dueDate: { lt: new Date() }, status: { not: 'DONE' } },
    orderBy: { dueDate: 'asc' },
    take: 10,
    select: {
      id: true,
      title: true,
      priority: true,
      dueDate: true,
      status: true,
      project: { select: { id: true, name: true } },
    },
  });
}

// ─── 新增：按状态分组的任务列表 ───

export async function getTasksByStatus(userId: string, period?: string, type?: string, endDate?: string) {
  const { start, end } = parseRange(period, resolveType(type), endDate);
  const periodFilter = {
    OR: [
      { createdAt: { gte: start, lte: end } },
      { completedAt: { gte: start, lte: end } },
    ],
  };
  const tasks = await prisma.task.findMany({
    where: { project: { ownerId: userId }, ...periodFilter },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      project: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const grouped: Record<string, { id: string; title: string; priority: string; dueDate: string | null; projectName: string }[]> = {};
  for (const t of tasks) {
    (grouped[t.status] ??= []).push({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      projectName: t.project?.name ?? '-',
    });
  }
  return grouped;
}

// ─── 新增：按优先级分组的任务列表 ───

export async function getTasksByPriority(userId: string, period?: string, type?: string, endDate?: string) {
  const { start, end } = parseRange(period, resolveType(type), endDate);
  const periodFilter = {
    OR: [
      { createdAt: { gte: start, lte: end } },
      { completedAt: { gte: start, lte: end } },
    ],
  };
  const tasks = await prisma.task.findMany({
    where: { project: { ownerId: userId }, status: { not: 'DONE' }, ...periodFilter },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      project: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const grouped: Record<string, { id: string; title: string; status: string; dueDate: string | null; projectName: string }[]> = {};
  for (const t of tasks) {
    (grouped[t.priority] ??= []).push({
      id: t.id,
      title: t.title,
      status: t.status,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      projectName: t.project?.name ?? '-',
    });
  }
  return grouped;
}

// ─── 新增：支出明细按类别分组 ───

export async function getCostDetails(userId: string, period?: string, type?: string, endDate?: string) {
  const { start, end } = parseRange(period, resolveType(type), endDate);

  const records = await prisma.costRecord.findMany({
    where: { project: { ownerId: userId }, date: { gte: start, lte: end } },
    select: { id: true, category: true, amount: true, description: true, taskId: true, project: { select: { name: true } } },
    orderBy: { date: 'desc' },
    take: 300,
  });

  const labels: Record<string, string> = { LABOR: '人工', MATERIAL: '材料', OVERHEAD: '运营', OTHER: '其他' };
  const grouped: Record<string, { id: string; name: string; amount: number; projectName: string }[]> = {};

  for (const r of records) {
    const cat = r.category || 'OTHER';
    (grouped[cat] ??= []).push({
      id: r.id,
      name: r.description || labels[cat] || cat,
      amount: r.amount,
      projectName: r.project?.name ?? '-',
    });
  }

  // 只计入没有关联 CostRecord 的孤立任务 cost，避免重复
  const taskIdsWithRecord = records.filter((r) => r.taskId).map((r) => r.taskId!);
  const orphanTasks = await prisma.task.findMany({
    where: {
      project: { ownerId: userId },
      cost: { gt: 0 },
      createdAt: { gte: start, lte: end },
      ...(taskIdsWithRecord.length > 0 ? { id: { notIn: taskIdsWithRecord } } : {}),
    },
    select: { id: true, title: true, cost: true, project: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  for (const t of orphanTasks) {
    (grouped.LABOR ??= []).push({
      id: t.id,
      name: t.title,
      amount: t.cost,
      projectName: t.project?.name ?? '-',
    });
  }

  return grouped;
}

// ─── 新增：客户价值排行 ───

export async function getCustomerRanking(userId: string) {
  const customers = await prisma.customer.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      company: true,
      status: true,
      projects: {
        select: {
          payments: { select: { amount: true } },
          budget: true,
          status: true,
        },
      },
    },
  });

  return customers
    .map((c) => {
      const totalReceived = c.projects.reduce((s, p) => s + p.payments.reduce((ps, pay) => ps + pay.amount, 0), 0);
      const totalBudget = c.projects.reduce((s, p) => s + (p.budget ?? 0), 0);
      return {
        id: c.id,
        name: c.company || c.name,
        contact: c.name,
        status: c.status,
        projectCount: c.projects.length,
        totalReceived,
        totalBudget,
      };
    })
    .filter((c) => c.totalReceived > 0 || c.projectCount > 0)
    .sort((a, b) => b.totalReceived - a.totalReceived);
}

// ─── 新增：客户统计概览 ───

export async function getCustomerStats(userId: string) {
  const [statusGroups, totalCount] = await Promise.all([
    prisma.customer.groupBy({
      by: ['status'],
      where: { userId },
      _count: { id: true },
    }),
    prisma.customer.count({ where: { userId } }),
  ]);

  const statusDist = statusGroups.map((g) => ({ status: g.status, count: g._count.id }));
  const vipCount = statusGroups.find((g) => g.status === 'VIP')?._count.id ?? 0;

  return { statusDist, totalCount, vipCount };
}

// ─── 新增：待跟进客户提醒 ───

export async function getFollowUpReminders(userId: string) {
  const now = new Date();
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  const [upcoming, overdue] = await Promise.all([
    prisma.communication.findMany({
      where: {
        userId,
        nextFollowAt: { gte: now, lte: sevenDaysLater },
      },
      orderBy: { nextFollowAt: 'asc' },
      take: 10,
      select: {
        id: true,
        type: true,
        nextFollowAt: true,
        summary: true,
        customer: { select: { id: true, name: true, company: true } },
      },
    }),
    prisma.communication.findMany({
      where: {
        userId,
        nextFollowAt: { lt: now },
      },
      orderBy: { nextFollowAt: 'asc' },
      take: 10,
      select: {
        id: true,
        type: true,
        nextFollowAt: true,
        summary: true,
        customer: { select: { id: true, name: true, company: true } },
      },
    }),
  ]);

  const items = [
    ...overdue.map((c) => ({
      id: c.id,
      type: c.type,
      nextFollowAt: c.nextFollowAt,
      summary: c.summary,
      customerName: c.customer?.company || c.customer?.name || '未知',
      customerId: c.customer?.id,
      isOverdue: true,
      daysUntil: c.nextFollowAt ? Math.ceil((now.getTime() - c.nextFollowAt.getTime()) / 86400000) : 0,
    })),
    ...upcoming.map((c) => ({
      id: c.id,
      type: c.type,
      nextFollowAt: c.nextFollowAt,
      summary: c.summary,
      customerName: c.customer?.company || c.customer?.name || '未知',
      customerId: c.customer?.id,
      isOverdue: false,
      daysUntil: c.nextFollowAt ? Math.ceil((c.nextFollowAt.getTime() - now.getTime()) / 86400000) : 0,
    })),
  ];

  return { items, overdueCount: overdue.length, upcomingCount: upcoming.length };
}
