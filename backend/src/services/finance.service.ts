import { prisma } from '../server';

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseRange(period?: string, type: 'day' | 'month' | 'year' = 'month'): { start: Date; end: Date } {
  const val = period || getCurrentMonth();
  const parts = val.split('-').map(Number);

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

function prevPeriod(period?: string, type: 'day' | 'month' | 'year' = 'month'): { start: Date; end: Date } {
  const val = period || getCurrentMonth();
  const parts = val.split('-').map(Number);

  if (type === 'day') {
    const d = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
    d.setDate(d.getDate() - 1);
    return { start: new Date(d.getFullYear(), d.getMonth(), d.getDate()), end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59) };
  }

  if (type === 'year') {
    const y = parts[0] - 1;
    return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59) };
  }

  const y = parts[0], m = (parts[1] || 1) - 1;
  const actualM = m === 0 ? 12 : m;
  const actualY = m === 0 ? y - 1 : y;
  return { start: new Date(actualY, actualM - 1, 1), end: new Date(actualY, actualM, 0, 23, 59, 59) };
}

export interface FinancialSummary {
  income: number;
  expense: number;
  profit: number;
  margin: number;
  receivables: number;
  incomeBreakdown: { projectPayments: number; otherIncome: number };
  expenseBreakdown: { projectCosts: number; operatingCosts: number; subscriptionCosts: number };
}

/**
 * 统一财务计算 — 全系统唯一的收入/支出/利润计算入口
 *
 * 收入 = Payment.sum(receivedAt in range) + Transaction(INCOME, source=MANUAL).sum
 * 支出 = CostRecord.sum(date in range) + Transaction(EXPENSE).sum
 * 利润 = 收入 - 支出
 * 应收 = sum(project.budget - Payment.sum) for 未结清项目
 */
export async function getFinancialSummary(
  userId: string,
  period?: string,
  type: 'day' | 'month' | 'year' = 'month',
): Promise<FinancialSummary> {
  const { start, end } = parseRange(period, type);

  const [paymentAgg, manualIncomeAgg, costRecordAgg, costRecordExpAgg, subscriptionExpAgg, projects] = await Promise.all([
    // 收入1：项目回款
    prisma.payment.aggregate({
      where: {
        receivedAt: { gte: start, lte: end },
        project: { ownerId: userId },
      },
      _sum: { amount: true },
    }),
    // 收入2：手动记的非项目收入
    prisma.transaction.aggregate({
      where: {
        userId,
        direction: 'INCOME',
        source: 'MANUAL',
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    // 支出1：项目成本（CostRecord）
    prisma.costRecord.aggregate({
      where: {
        project: { ownerId: userId },
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    // 支出1b：项目成本（Task.cost，按 createdAt 归属）
    prisma.task.aggregate({
      where: {
        project: { ownerId: userId },
        cost: { gt: 0 },
        createdAt: { gte: start, lte: end },
      },
      _sum: { cost: true },
    }),
    // 支出2：非项目支出（Transaction EXPENSE）
    prisma.transaction.aggregate({
      where: {
        userId,
        direction: 'EXPENSE',
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
    // 应收账款：所有未结清项目
    prisma.project.findMany({
      where: { ownerId: userId, budget: { gt: 0 } },
      select: {
        budget: true,
        payments: { select: { amount: true } },
      },
    }),
  ]);

  const projectPayments = paymentAgg._sum.amount || 0;
  const otherIncome = manualIncomeAgg._sum.amount || 0;
  const income = projectPayments + otherIncome;

  const projectCosts = (costRecordAgg._sum.amount || 0) + (costRecordExpAgg._sum.cost || 0);
  const operatingCosts = subscriptionExpAgg._sum.amount || 0;
  const expense = projectCosts + operatingCosts;

  const profit = income - expense;
  const margin = income > 0 ? Math.round((profit / income) * 1000) / 10 : 0;

  // 应收账款
  let receivables = 0;
  for (const project of projects) {
    const budget = project.budget || 0;
    const paid = project.payments.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = budget - paid;
    if (outstanding > 0) receivables += outstanding;
  }

  return {
    income,
    expense,
    profit,
    margin,
    receivables,
    incomeBreakdown: { projectPayments, otherIncome },
    expenseBreakdown: { projectCosts, operatingCosts, subscriptionCosts: operatingCosts },
  };
}

/**
 * 趋势数据 — 近 N 个月的收支变化
 */
export async function getFinancialTrends(userId: string, months = 6) {
  const results: Array<{ month: string; income: number; expense: number; profit: number }> = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const summary = await getFinancialSummary(userId, period, 'month');
    results.push({
      month: period,
      income: summary.income,
      expense: summary.expense,
      profit: summary.profit,
    });
  }

  return results;
}

/**
 * 上期对比数据
 */
export async function getComparison(userId: string, period?: string, type: 'day' | 'month' | 'year' = 'month') {
  const current = await getFinancialSummary(userId, period, type);
  const prev = prevPeriod(period, type);
  const prevPeriodStr = formatPrevPeriod(prev.start, type);
  const previous = await getFinancialSummary(userId, prevPeriodStr, type);

  return {
    current,
    previous,
    changes: {
      income: calcChange(current.income, previous.income),
      expense: calcChange(current.expense, previous.expense),
      profit: calcChange(current.profit, previous.profit),
    },
  };
}

function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function formatPrevPeriod(d: Date, type: 'day' | 'month' | 'year'): string {
  if (type === 'day') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (type === 'year') {
    return String(d.getFullYear());
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
