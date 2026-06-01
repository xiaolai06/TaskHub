import { prisma } from '../server';

/**
 * 获取当前时段活跃的问候语
 * 正确处理跨夜时间段（如 22:00 ~ 06:00）
 */
export async function getActive(userId: string, hour?: number) {
  const h = hour ?? new Date().getHours();

  // 先查出所有活跃问候语，在内存中过滤（问候语通常很少，不会超过几十条）
  const all = await prisma.greeting.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  return all.filter((g) => {
    if (g.hourStart <= g.hourEnd) {
      // 正常范围: start <= h <= end
      return g.hourStart <= h && h <= g.hourEnd;
    }
    // 跨夜范围: start > end，匹配 h >= start 或 h <= end
    return h >= g.hourStart || h <= g.hourEnd;
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
