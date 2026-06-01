import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** 获取用户本周对话记录（n8n 每周总结用） */
export async function getWeeklyConversations(userId: string, weeksAgo = 0) {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7; // 周日=7
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek + 1 - weeksAgo * 7);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const conversations = await prisma.conversation.findMany({
    where: {
      userId,
      createdAt: { gte: startOfWeek, lte: endOfWeek },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      role: true,
      content: true,
      sessionId: true,
      createdAt: true,
    },
  });

  return {
    conversations,
    period: {
      start: startOfWeek.toISOString(),
      end: endOfWeek.toISOString(),
    },
    summary: {
      totalMessages: conversations.length,
      userMessages: conversations.filter(c => c.role === 'user').length,
      assistantMessages: conversations.filter(c => c.role === 'assistant').length,
      sessions: [...new Set(conversations.map(c => c.sessionId))].length,
    },
  };
}

/** 获取用户对话历史（最近 N 条） */
export async function getHistory(userId: string, limit = 20) {
  return prisma.conversation.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      role: true,
      content: true,
      sessionId: true,
      toolName: true,
      createdAt: true,
    },
  });
}

/** 获取指定会话详情 */
export async function getSession(userId: string, sessionId: string) {
  return prisma.conversation.findMany({
    where: { userId, sessionId },
    orderBy: { createdAt: 'asc' },
  });
}

/** 删除指定会话 */
export async function deleteSession(userId: string, sessionId: string) {
  return prisma.conversation.deleteMany({
    where: { userId, sessionId },
  });
}
