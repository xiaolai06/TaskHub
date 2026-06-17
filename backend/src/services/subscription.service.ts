import { prisma } from '../server';
import { AppError } from '../utils/errors';
import type { CreateSubscriptionInput, UpdateSubscriptionInput } from '../validators/subscription.schema';

export async function findAll(userId: string, filters?: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  const { page = 1, limit = 50, status } = filters || {};
  const where: Record<string, unknown> = { userId };
  if (status) where.status = status;

  const [data, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ status: 'asc' }, { nextBillingAt: 'asc' }],
    }),
    prisma.subscription.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function create(userId: string, data: CreateSubscriptionInput) {
  return prisma.subscription.create({
    data: {
      name: data.name,
      category: data.category,
      amount: data.amount,
      currency: data.currency || 'CNY',
      exchangeRate: data.exchangeRate || 1.0,
      cycle: data.cycle,
      startDate: new Date(data.startDate),
      nextBillingAt: new Date(data.nextBillingAt),
      autoRenew: data.autoRenew ?? true,
      url: data.url || null,
      note: data.note,
      userId,
    },
  });
}

export async function update(userId: string, id: string, data: UpdateSubscriptionInput) {
  const sub = await prisma.subscription.findFirst({ where: { id, userId } });
  if (!sub) throw new AppError('订阅不存在', 404, 'NOT_FOUND');

  return prisma.subscription.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.exchangeRate !== undefined && { exchangeRate: data.exchangeRate }),
      ...(data.cycle !== undefined && { cycle: data.cycle }),
      ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
      ...(data.nextBillingAt !== undefined && { nextBillingAt: new Date(data.nextBillingAt) }),
      ...(data.autoRenew !== undefined && { autoRenew: data.autoRenew }),
      ...(data.url !== undefined && { url: data.url || null }),
      ...(data.note !== undefined && { note: data.note }),
    },
  });
}

export async function pause(userId: string, id: string) {
  const sub = await prisma.subscription.findFirst({ where: { id, userId } });
  if (!sub) throw new AppError('订阅不存在', 404, 'NOT_FOUND');
  if (sub.status !== 'ACTIVE') throw new AppError('只有活跃订阅可以暂停', 400, 'INVALID_STATUS');

  return prisma.subscription.update({ where: { id }, data: { status: 'PAUSED' } });
}

export async function resume(userId: string, id: string) {
  const sub = await prisma.subscription.findFirst({ where: { id, userId } });
  if (!sub) throw new AppError('订阅不存在', 404, 'NOT_FOUND');
  if (sub.status !== 'PAUSED') throw new AppError('只有暂停的订阅可以恢复', 400, 'INVALID_STATUS');

  return prisma.subscription.update({ where: { id }, data: { status: 'ACTIVE' } });
}

export async function remove(userId: string, id: string) {
  const sub = await prisma.subscription.findFirst({ where: { id, userId } });
  if (!sub) throw new AppError('订阅不存在', 404, 'NOT_FOUND');

  return prisma.subscription.delete({ where: { id } });
}

/**
 * 月度/年度成本汇总（返回单位：分）
 */
export async function getCostSummary(userId: string) {
  const subs = await prisma.subscription.findMany({
    where: { userId, status: 'ACTIVE' },
  });

  let monthlyTotal = 0;
  const byCategory: Record<string, number> = {};

  for (const sub of subs) {
    // amount 是分，exchangeRate 是汇率（CNY 默认 1.0）
    const amountFen = Math.round(sub.amount * sub.exchangeRate);
    let monthlyCost: number;
    if (sub.cycle === 'MONTHLY') monthlyCost = amountFen;
    else if (sub.cycle === 'QUARTERLY') monthlyCost = Math.round(amountFen / 3);
    else monthlyCost = Math.round(amountFen / 12);

    monthlyTotal += monthlyCost;

    const label = categoryLabels[sub.category] || sub.category;
    byCategory[label] = (byCategory[label] || 0) + monthlyCost;
  }

  return {
    monthlyTotal,
    yearlyEstimate: monthlyTotal * 12,
    activeCount: subs.length,
    byCategory: Object.entries(byCategory).map(([category, amount]) => ({
      category,
      amount,
      percent: monthlyTotal > 0 ? Math.round((amount / monthlyTotal) * 1000) / 10 : 0,
    })),
  };
}

/**
 * 订阅到期自动记账 — 定时任务调用
 */
export async function processDueSubscriptions() {
  const now = new Date();
  const dueSubs = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', nextBillingAt: { lte: now } },
  });

  const results: Array<{ name: string; amount: number; success: boolean }> = [];

  for (const sub of dueSubs) {
    try {
      const amountCNY = Math.round((sub.amount / 100) * sub.exchangeRate);

      await prisma.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            amount: amountCNY,
            direction: 'EXPENSE',
            category: 'SUBSCRIPTION',
            description: `${sub.name} - ${cycleLabels[sub.cycle] || '订阅费'}`,
            date: now,
            source: 'SUBSCRIPTION',
            subscriptionId: sub.id,
            userId: sub.userId,
          },
        });

        const nextDate = calcNextBilling(sub.nextBillingAt, sub.cycle);
        await tx.subscription.update({
          where: { id: sub.id },
          data: { nextBillingAt: nextDate },
        });
      });

      results.push({ name: sub.name, amount: amountCNY, success: true });
    } catch {
      results.push({ name: sub.name, amount: 0, success: false });
    }
  }

  return results;
}

// ---------- helpers ----------

const categoryLabels: Record<string, string> = {
  SOFTWARE: 'AI/软件',
  CLOUD: '云服务',
  DOMAIN: '域名/托管',
  TOOL: '效率工具',
  MEDIA: '素材库',
  OTHER: '其他',
};

const cycleLabels: Record<string, string> = {
  MONTHLY: '月费',
  QUARTERLY: '季费',
  YEARLY: '年费',
};

function calcNextBilling(current: Date, cycle: string): Date {
  const next = new Date(current);
  if (cycle === 'MONTHLY') next.setMonth(next.getMonth() + 1);
  else if (cycle === 'QUARTERLY') next.setMonth(next.getMonth() + 3);
  else next.setFullYear(next.getFullYear() + 1);
  return next;
}
