import { prisma } from '../server';

/**
 * 从对话中提取用户偏好记忆（正则模式匹配）
 * 注意：定时任务 weekly-memory.job.ts 使用 AI 方式提取，此函数提供轻量级正则提取
 */
export async function extractMemories(userId: string, sessionId: string): Promise<number> {
  const messages = await prisma.conversation.findMany({
    where: { userId, sessionId, role: { in: ['user', 'assistant'] } },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { role: true, content: true },
  });
  if (messages.length < 4) return 0;
  const dialog = messages.map((message) => `${message.role}: ${message.content}`).join('\n');
  return extractBasicMemories(userId, dialog);
}

async function extractBasicMemories(userId: string, dialog: string): Promise<number> {
  const keywords = [
    { pattern: /每天工作(\d+)小时/, key: 'daily_hours', value: '', category: 'HABIT' },
    { pattern: /优先级[是为]高/i, key: 'priority_preference', value: '偏好高优先级任务', category: 'PREFERENCE' },
    { pattern: /简洁|简短/i, key: 'reply_style', value: '偏好简洁回复', category: 'PREFERENCE' },
    { pattern: /报价|成本|花费|花钱/i, key: 'cost_conscious', value: '关注报价、成本和利润', category: 'PREFERENCE' },
  ];

  let count = 0;
  for (const keyword of keywords) {
    if (keyword.pattern.test(dialog)) {
      const match = dialog.match(keyword.pattern);
      const value = match?.[1] ? `每天工作${match[1]}小时` : keyword.value;
      await prisma.userMemory.upsert({
        where: { userId_key: { userId, key: keyword.key } },
        create: { userId, category: keyword.category, key: keyword.key, value, source: 'auto', confidence: 0.5 },
        update: { value, confidence: { increment: 0.1 }, lastAccessedAt: new Date() },
      });
      count++;
    }
  }
  return count;
}