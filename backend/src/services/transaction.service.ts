import { prisma } from '../server';
import { AppError } from '../utils/errors';
import type { CreateTransactionInput, UpdateTransactionInput } from '../validators/transaction.schema';

export async function findAll(userId: string, filters?: {
  page?: number;
  limit?: number;
  direction?: string;
  category?: string;
  source?: string;
  projectId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}) {
  const { direction, category, source, projectId, startDate, endDate, search } = filters || {};
  const page = Number(filters?.page) || 1;
  const limit = Number(filters?.limit) || 20;

  const where: Record<string, unknown> = { userId };
  if (direction) where.direction = direction;
  if (category) where.category = category;
  if (source) where.source = source;
  if (projectId) where.projectId = projectId;
  if (startDate || endDate) {
    where.date = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate ? { lte: new Date(endDate + 'T23:59:59') } : {}),
    };
  }
  if (search) {
    where.OR = [
      { description: { contains: search } },
      { note: { contains: search } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        payment: { select: { id: true, type: true, project: { select: { name: true } } } },
        subscription: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function create(userId: string, data: CreateTransactionInput) {
  return prisma.transaction.create({
    data: {
      amount: data.amount,
      direction: data.direction,
      category: data.category,
      description: data.description,
      date: new Date(data.date),
      note: data.note,
      source: 'MANUAL',
      projectId: data.projectId || null,
      taskId: data.taskId || null,
      userId,
    },
  });
}

export async function update(userId: string, id: string, data: UpdateTransactionInput) {
  const tx = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!tx) throw new AppError('流水记录不存在', 404, 'NOT_FOUND');
  if (tx.source !== 'MANUAL') throw new AppError('自动生成的记录不可编辑', 403, 'FORBIDDEN');

  return prisma.transaction.update({
    where: { id },
    data: {
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.date !== undefined && { date: new Date(data.date) }),
      ...(data.projectId !== undefined && { projectId: data.projectId || null }),
      ...(data.taskId !== undefined && { taskId: data.taskId || null }),
      ...(data.note !== undefined && { note: data.note }),
    },
  });
}

export async function remove(userId: string, id: string) {
  const tx = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!tx) throw new AppError('流水记录不存在', 404, 'NOT_FOUND');
  if (tx.source !== 'MANUAL') throw new AppError('自动生成的记录不可删除', 403, 'FORBIDDEN');

  return prisma.transaction.delete({ where: { id } });
}
