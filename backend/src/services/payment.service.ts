import { prisma } from '../server';
import { AppError } from '../utils/errors';
import type { CreatePaymentInput } from '../validators/payment.schema';

export async function findAll(userId: string, filters?: {
  page?: number;
  limit?: number;
  projectId?: string;
}) {
  const { page = 1, limit = 50, projectId } = filters || {};
  const where: Record<string, unknown> = { project: { ownerId: userId } };
  if (projectId) where.projectId = projectId;

  const [data, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { receivedAt: 'desc' },
      include: { project: { select: { id: true, name: true, budget: true } } },
    }),
    prisma.payment.count({ where }),
  ]);

  return { data, total, page, limit };
}

/**
 * 录入回款 → 同时创建 Payment + Transaction(source=PAYMENT)
 */
export async function create(userId: string, data: CreatePaymentInput) {
  const project = await prisma.project.findFirst({
    where: { id: data.projectId, ownerId: userId },
    select: { id: true, name: true },
  });
  if (!project) throw new AppError('项目不存在或无权访问', 404, 'NOT_FOUND');

  const payment = await prisma.$transaction(async (tx) => {
    const paymentTypeLabels: Record<string, string> = {
      DOWN_PAYMENT: '预付款',
      PROGRESS: '进度款',
      FINAL: '尾款',
      ADJUSTMENT: '调整项',
      OTHER: '其他回款',
    };

    const created = await tx.payment.create({
      data: {
        amount: data.amount,
        type: data.type,
        method: data.method || 'BANK_TRANSFER',
        receivedAt: new Date(data.receivedAt),
        note: data.note,
        projectId: data.projectId,
      },
    });

    await tx.transaction.create({
      data: {
        amount: data.amount,
        direction: 'INCOME',
        category: 'PROJECT_PAYMENT',
        description: `${project.name} - ${paymentTypeLabels[data.type] || '回款'}`,
        date: new Date(data.receivedAt),
        source: 'PAYMENT',
        paymentId: created.id,
        userId,
      },
    });

    return created;
  });

  return payment;
}

/**
 * 应收账款汇总
 */
export async function getReceivables(userId: string) {
  const projects = await prisma.project.findMany({
    where: { ownerId: userId, budget: { gt: 0 } },
    select: {
      id: true,
      name: true,
      budget: true,
      status: true,
      startDate: true,
      endDate: true,
      payments: { select: { amount: true, receivedAt: true } },
    },
  });

  let totalReceivable = 0;
  let totalReceived = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  const now = new Date();

  const projectDetails = projects.map((project) => {
    const budget = project.budget || 0;
    const received = project.payments.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = Math.max(0, budget - received);
    const rate = budget > 0 ? Math.round((received / budget) * 1000) / 10 : 0;

    totalReceivable += outstanding;
    totalReceived += received;

    // 判断逾期：项目结束且未结清
    const lastPayment = project.payments.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())[0];
    const referenceDate = lastPayment?.receivedAt || project.startDate;
    const daysSince = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = outstanding > 0 && project.status === 'COMPLETED' && daysSince > 30;

    if (isOverdue) {
      overdueAmount += outstanding;
      overdueCount++;
    }

    return {
      id: project.id,
      name: project.name,
      budget,
      received,
      outstanding,
      rate,
      status: project.status,
      isOverdue,
      daysSince,
    };
  });

  const monthlyReceived = await prisma.payment.aggregate({
    where: {
      project: { ownerId: userId },
      receivedAt: {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lte: now,
      },
    },
    _sum: { amount: true },
  });

  const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
  const overallRate = totalBudget > 0 ? Math.round((totalReceived / totalBudget) * 1000) / 10 : 0;

  return {
    totalReceivable,
    totalReceived,
    monthlyReceived: monthlyReceived._sum.amount || 0,
    overdueAmount,
    overdueCount,
    overallRate,
    projects: projectDetails.sort((a, b) => b.outstanding - a.outstanding),
  };
}

/**
 * 账龄分析
 */
export async function getAgingAnalysis(userId: string) {
  const projects = await prisma.project.findMany({
    where: { ownerId: userId, budget: { gt: 0 } },
    select: {
      budget: true,
      startDate: true,
      payments: { select: { amount: true, receivedAt: true } },
    },
  });

  const now = new Date();
  const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  let totalOutstanding = 0;

  for (const project of projects) {
    const budget = project.budget || 0;
    const received = project.payments.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = Math.max(0, budget - received);
    if (outstanding === 0) continue;

    totalOutstanding += outstanding;

    const lastPayment = project.payments.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())[0];
    const referenceDate = lastPayment?.receivedAt || project.startDate;
    const days = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));

    if (days <= 30) buckets['0-30'] += outstanding;
    else if (days <= 60) buckets['31-60'] += outstanding;
    else if (days <= 90) buckets['61-90'] += outstanding;
    else buckets['90+'] += outstanding;
  }

  return { totalOutstanding, buckets };
}
