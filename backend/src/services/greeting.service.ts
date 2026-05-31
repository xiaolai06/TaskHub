import { prisma } from '../server';

export async function getActive(userId: string, hour?: number) {
  const h = hour ?? new Date().getHours();
  return prisma.greeting.findMany({
    where: {
      userId,
      isActive: true,
      OR: [
        { hourStart: { lte: h }, hourEnd: { gte: h } },
        { hourStart: { gt: h }, hourEnd: { lt: h } }, // 跨夜场景
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAll(userId: string) {
  return prisma.greeting.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function create(userId: string, data: { content: string; hourStart?: number; hourEnd?: number; source?: string }) {
  return prisma.greeting.create({
    data: {
      content: data.content,
      hourStart: data.hourStart ?? 0,
      hourEnd: data.hourEnd ?? 23,
      source: data.source ?? 'custom',
      userId,
    },
  });
}

export async function update(userId: string, id: string, data: { content?: string; hourStart?: number; hourEnd?: number; isActive?: boolean }) {
  const result = await prisma.greeting.updateMany({
    where: { id, userId },
    data,
  });
  if (result.count === 0) return null;
  return prisma.greeting.findUnique({ where: { id } });
}

export async function remove(userId: string, id: string) {
  await prisma.greeting.deleteMany({ where: { id, userId } });
  return { deleted: true };
}
