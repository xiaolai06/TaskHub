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

function parseRange(period: string | undefined, type: 'day' | 'month' | 'year'): { start: Date; end: Date } {
  const val = period || getCurrentMonth();
  const parts = val.split('-').map(Number);

  if (!Number.isFinite(parts[0]) || parts[0] < 2000 || parts[0] > 2100) {
    throw new AppError('日期格式无效，请使用 YYYY-MM 或 YYYY-MM-DD 格式', 400, 'VALIDATION_ERROR');
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

async function getTaskCostByProject(projectIds: string[], start?: Date, end?: Date) {
  if (projectIds.length === 0) return new Map<string, number>();
  const rows = await prisma.task.groupBy({
    by: ['projectId'],
    where: {
      projectId: { in: projectIds },
      cost: { gt: 0 },
      ...(start && end ? { createdAt: { gte: start, lte: end } } : {}),
    },
    _sum: { cost: true },
  });
  return new Map(rows.map((row) => [row.projectId, row._sum.cost ?? 0]));
}

async function getRecordCostByProject(projectIds: string[], start?: Date, end?: Date) {
  if (projectIds.length === 0) return new Map<string, number>();
  const rows = await prisma.costRecord.groupBy({
    by: ['projectId'],
    where: {
      projectId: { in: projectIds },
      ...(start && end ? { date: { gte: start, lte: end } } : {}),
    },
    _sum: { amount: true },
  });
  return new Map(rows.map((row) => [row.projectId, row._sum.amount ?? 0]));
}

export async function getOverview(userId: string, period?: string, type?: string) {
  const { start, end } = parseRange(period, resolveType(type));

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
    where: { ownerId: userId },
    select: { id: true, budget: true },
  });
  const projectIds = projects.map((project) => project.id);
  const [recordCostMap, taskCostMap] = await Promise.all([
    getRecordCostByProject(projectIds, start, end),
    getTaskCostByProject(projectIds, start, end),
  ]);

  const cost = projectIds.reduce((sum, id) => sum + (recordCostMap.get(id) ?? 0) + (taskCostMap.get(id) ?? 0), 0);
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

export async function getProjectRanking(userId: string, period?: string, type?: string) {
  const { start, end } = parseRange(period, resolveType(type));
  const projects = await prisma.project.findMany({
    where: { ownerId: userId },
    select: {
      id: true, name: true, budget: true, status: true,
      payments: { where: { receivedAt: { gte: start, lte: end } }, select: { amount: true } },
    },
  });

  const projectIds = projects.map((project) => project.id);
  const [recordCostMap, taskCostMap] = await Promise.all([
    getRecordCostByProject(projectIds, start, end),
    getTaskCostByProject(projectIds, start, end),
  ]);

  const ranking = projects.map((project) => {
    const quote = project.budget ?? 0;
    const received = project.payments.reduce((sum, p) => sum + p.amount, 0);
    const cost = (recordCostMap.get(project.id) ?? 0) + (taskCostMap.get(project.id) ?? 0);
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

export async function getCostStructure(userId: string, period?: string, type?: string) {
  const { start, end } = parseRange(period, resolveType(type));
  const [records, taskCostAgg] = await Promise.all([
    prisma.costRecord.findMany({
      where: { project: { ownerId: userId }, date: { gte: start, lte: end } },
      select: { category: true, amount: true },
    }),
    prisma.task.aggregate({
      where: { project: { ownerId: userId }, cost: { gt: 0 }, createdAt: { gte: start, lte: end } },
      _sum: { cost: true },
    }),
  ]);

  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const record of records) {
    byCategory[record.category || 'OTHER'] = (byCategory[record.category || 'OTHER'] || 0) + record.amount;
    total += record.amount;
  }
  const taskCost = taskCostAgg._sum.cost ?? 0;
  if (taskCost > 0) {
    byCategory.LABOR = (byCategory.LABOR || 0) + taskCost;
    total += taskCost;
  }

  const labels: Record<string, string> = { LABOR: '人工/任务', MATERIAL: '材料', OVERHEAD: '运营', OTHER: '其他' };
  return Object.entries(byCategory).map(([category, amount]) => ({
    category: labels[category] || category,
    amount,
    percent: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
  }));
}

export async function getTimeAnalysis(userId: string, period?: string, type?: string) {
  const { start, end } = parseRange(period, resolveType(type));
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
