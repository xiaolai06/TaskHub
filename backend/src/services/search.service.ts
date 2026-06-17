import { prisma } from '../server';
import { NotFoundError, ForbiddenError } from '../utils/errors';

/** 执行业务搜索（保存搜索记录） */
export async function search(userId: string, query: string, source = 'manual') {
  const record = await prisma.searchResult.create({
    data: {
      query,
      source,
      title: `搜索: ${query}`,
      content: `用户搜索了「${query}」`,
      relevance: 0.5,
      userId,
    },
  });

  return record;
}

/** 获取搜索历史 */
export async function getHistory(userId: string, limit = 20) {
  return prisma.searchResult.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/** 删除搜索记录 */
export async function remove(id: string, userId: string) {
  const record = await prisma.searchResult.findUnique({ where: { id } });
  if (!record) {
    throw new NotFoundError('搜索记录');
  }
  if (record.userId !== userId) {
    throw new ForbiddenError('无权删除他人的搜索记录');
  }
  return prisma.searchResult.delete({ where: { id } });
}
