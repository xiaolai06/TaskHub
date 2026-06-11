import { prisma } from '../server';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { AIService } from './ai.service';

/** 确保用户有默认会话，没有则创建 */
export async function ensureDefaultSession(userId: string) {
  const existing = await prisma.conversationSession.findFirst({
    where: { userId, isDefault: true },
  });
  if (existing) return existing;

  return prisma.conversationSession.create({
    data: { userId, title: '默认对话', isPinned: true, isDefault: true },
  });
}

/** 列出用户所有会话（置顶在前，按 updatedAt 排序） */
export async function listSessions(userId: string) {
  const sessions = await prisma.conversationSession.findMany({
    where: { userId },
    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
    include: {
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true, createdAt: true },
      },
    },
  });

  return sessions.map(s => ({
    id: s.id,
    title: s.title,
    isPinned: s.isPinned,
    isDefault: s.isDefault,
    messageCount: s._count.messages,
    lastMessage: s.messages[0]?.createdAt || s.updatedAt,
    preview: s.messages[0]?.content?.slice(0, 60) || '',
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
}

/** 创建新会话 */
export async function createSession(userId: string, title?: string) {
  return prisma.conversationSession.create({
    data: { userId, title: title || '新对话' },
  });
}

/** 更新会话（标题 / 置顶） */
export async function updateSession(userId: string, id: string, data: { title?: string; isPinned?: boolean }) {
  const session = await prisma.conversationSession.findFirst({ where: { id, userId } });
  if (!session) throw new NotFoundError('会话不存在');
  if (session.isDefault && data.title !== undefined) {
    throw new ForbiddenError('默认对话不能修改标题');
  }
  return prisma.conversationSession.update({ where: { id }, data });
}

/** 删除会话 + 所有消息（默认会话禁止删除） */
export async function deleteSession(userId: string, id: string) {
  const session = await prisma.conversationSession.findFirst({ where: { id, userId } });
  if (!session) throw new NotFoundError('会话不存在');
  if (session.isDefault) throw new ForbiddenError('默认对话不能删除');

  await prisma.conversation.deleteMany({ where: { conversationSessionId: id } });
  await prisma.conversationSession.delete({ where: { id } });
}

/** 获取会话消息 */
export async function getMessages(userId: string, sessionId: string) {
  const session = await prisma.conversationSession.findFirst({ where: { id: sessionId, userId } });
  if (session) {
    return prisma.conversation.findMany({
      where: { conversationSessionId: sessionId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, createdAt: true },
    });
  }
  // 兼容旧 sessionId（迁移期间）
  return prisma.conversation.findMany({
    where: { userId, sessionId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true, content: true, createdAt: true },
  });
}

/** 为会话生成 AI 标题（异步，失败静默回退到截取标题） */
export async function generateTitle(userId: string, sessionId: string, firstMessage: string) {
  try {
    const fallback = firstMessage.slice(0, 30).replace(/\n/g, ' ').trim();

    let title = fallback;
    try {
      const ai = new AIService(userId);
      const initialized = await ai.init();
      if (initialized) {
        const messages = [
          { role: 'system' as const, content: '你是一个标题生成器。请用一句简短的话（不超过15个字）概括用户的对话主题，只输出标题文字，不要标点符号。' },
          { role: 'user' as const, content: firstMessage },
        ];
        let result = '';
        for await (const event of ai.chat({ messages })) {
          if (event.type === 'text') result += event.content;
        }
        if (result.trim().length > 0 && result.trim().length <= 30) {
          title = result.trim().replace(/^["「【]|["」】]$/g, '');
        }
      }
    } catch {
      // AI 生成失败，使用 fallback
    }

    await prisma.conversationSession.update({
      where: { id: sessionId },
      data: { title },
    });
  } catch {
    // 整体失败静默忽略
  }
}

/** 获取用户本周对话记录（n8n 每周总结用） */
export async function getWeeklyConversations(userId: string, weeksAgo = 0) {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek + 1 - weeksAgo * 7);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return prisma.conversation.findMany({
    where: { userId, createdAt: { gte: startOfWeek, lte: endOfWeek } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true, content: true, sessionId: true, createdAt: true },
  });
}
