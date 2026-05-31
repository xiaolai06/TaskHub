import { prisma } from '../server';

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 根据类型 + 日期值计算时间范围 */
function parseRange(period: string | undefined, type: 'day' | 'month' | 'year'): { start: Date; end: Date } {
  const val = period || getCurrentMonth();
  const parts = val.split('-').map(Number);

  if (type === 'day') {
    // val = YYYY-MM-DD
    const y = parts[0], m = parts[1] || 1, d = parts[2] || 1;
    const start = new Date(y, m - 1, d);
    const end = new Date(y, m - 1, d, 23, 59, 59);
    return { start, end };
  }

  if (type === 'year') {
    // val = YYYY
    const y = parts[0];
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31, 23, 59, 59);
    return { start, end };
  }

  // month: val = YYYY-MM
  const y = parts[0], m = parts[1] || 1;
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59);
  return { start, end };
}

export async function getOverview(userId: string, period?: string, type?: string) {
  const { start, end } = parseRange(period, (type as 'day' | 'month' | 'year') || 'month');

  // 收入 = 该时段内完成的项目的 budget 之和
  const completedProjects = await prisma.project.findMany({
    where: {
      ownerId: userId,
      status: 'COMPLETED',
      updatedAt: { gte: start, lte: end },
    },
    select: { budget: true },
  });
  const income = completedProjects.reduce((s, p) => s + (p.budget ?? 0), 0);

  // 支出 = 该时段内 CostRecord + Task.cost
  const [costAgg, taskCostAgg] = await Promise.all([
    prisma.costRecord.aggregate({ where: { project: { ownerId: userId }, date: { gte: start, lte: end } }, _sum: { amount: true } }),
    prisma.task.aggregate({ where: { project: { ownerId: userId }, cost: { gt: 0 }, createdAt: { gte: start, lte: end } }, _sum: { cost: true } }),
  ]);
  const expense = (costAgg._sum.amount ?? 0) + (taskCostAgg._sum.cost ?? 0);

  const profit = income - expense;
  const margin = income > 0 ? Math.round((profit / income) * 1000) / 10 : 0;
  return { income, expense, profit, margin, period: period || getCurrentMonth(), type };
}

export async function getProjectRanking(userId: string, period?: string, type?: string) {
  const { start, end } = parseRange(period, (type as 'day' | 'month' | 'year') || 'month');
  const projects = await prisma.project.findMany({ where: { ownerId: userId }, select: { id: true, name: true, budget: true } });
  const ranking = await Promise.all(projects.map(async (p) => {
    const [c, t] = await Promise.all([
      prisma.costRecord.aggregate({ where: { projectId: p.id, date: { gte: start, lte: end } }, _sum: { amount: true } }),
      prisma.task.aggregate({ where: { projectId: p.id, cost: { gt: 0 } }, _sum: { cost: true } }),
    ]);
    const cost = (c._sum.amount ?? 0) + (t._sum.cost ?? 0);
    const budget = p.budget ?? 0;
    const profit = budget - cost;
    const margin = budget > 0 ? Math.round((profit / budget) * 1000) / 10 : 0;
    return { id: p.id, name: p.name, budget, cost, profit, margin };
  }));
  return ranking.sort((a, b) => b.margin - a.margin);
}

export async function getCostStructure(userId: string, period?: string, type?: string) {
  const { start, end } = parseRange(period, (type as 'day' | 'month' | 'year') || 'month');
  const records = await prisma.costRecord.findMany({
    where: { project: { ownerId: userId }, date: { gte: start, lte: end } },
    select: { category: true, amount: true },
  });
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const r of records) { byCategory[r.category || 'OTHER'] = (byCategory[r.category || 'OTHER'] || 0) + r.amount; total += r.amount; }
  const labels: Record<string, string> = { LABOR: '人工', MATERIAL: '材料', OVERHEAD: '管理费', OTHER: '其他' };
  return Object.entries(byCategory).map(([c, a]) => ({ category: labels[c] || c, amount: a, percent: total > 0 ? Math.round((a / total) * 1000) / 10 : 0 }));
}

export async function getTimeAnalysis(userId: string, period?: string, type?: string) {
  const { start, end } = parseRange(period, (type as 'day' | 'month' | 'year') || 'month');
  const entries = await prisma.timeEntry.findMany({
    where: { userId, date: { gte: start, lte: end } },
    include: { project: { select: { name: true } } },
  });
  const byProj: Record<string, number> = {}; let total = 0;
  for (const e of entries) { const n = e.project?.name || '无项目'; byProj[n] = (byProj[n] || 0) + e.hours; total += e.hours; }
  const daysInPeriod = type === 'day' ? 1 : type === 'year' ? 365 : new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  return {
    byProject: Object.entries(byProj).map(([p, h]) => ({ project: p, hours: Math.round(h * 10) / 10 })),
    totalHours: Math.round(total * 10) / 10,
    avgPerDay: Math.round((total / daysInPeriod) * 10) / 10,
  };
}
