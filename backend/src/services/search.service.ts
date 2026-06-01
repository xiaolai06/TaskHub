import { prisma } from '../server';

/** 执行业务搜索（保存搜索记录） */
export async function search(userId: string, query: string, source = 'manual') {
  // 保存搜索记录
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
  if (!record || record.userId !== userId) {
    throw new Error('搜索记录不存在');
  }
  return prisma.searchResult.delete({ where: { id } });
}
