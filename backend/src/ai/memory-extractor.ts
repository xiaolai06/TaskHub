// 对话记忆提炼服务
import { prisma } from '../server';
import { AIService } from '../services/ai.service';

export async function extractMemories(userId: string, sessionId: string): Promise<number> {
  const messages = await prisma.conversation.findMany({
    where: { userId, sessionId, role: { in: ['user', 'assistant'] } },
    orderBy: { createdAt: 'asc' }, take: 20, select: { role: true, content: true },
  });
  if (messages.length < 4) return 0;
  const dialog = messages.map(m => `${m.role}: ${m.content}`).join('\n');
  return extractBasicMemories(userId, dialog);
}

async function extractBasicMemories(userId: string, dialog: string): Promise<number> {
  const keywords = [
    { pattern: /每天工作(\d+)小时/, key: 'daily_hours', value: '', category: 'HABIT' },
    { pattern: /优先级[是高]/i, key: 'priority_preference', value: '偏好高优先级任务', category: 'PREFERENCE' },
    { pattern: /简洁|简短/i, key: 'reply_style', value: '偏好简洁回复', category: 'PREFERENCE' },
    { pattern: /预算|成本|花费|花钱/i, key: 'budget_conscious', value: '关注成本控制', category: 'PREFERENCE' },
  ];
  let count = 0;
  for (const kw of keywords) {
    if (kw.pattern.test(dialog)) {
      const match = dialog.match(kw.pattern);
      const value = match?.[1] ? `每天工作${match[1]}小时` : kw.value;
      await prisma.userMemory.upsert({
        where: { userId_key: { userId, key: kw.key } },
        create: { userId, category: kw.category, key: kw.key, value, source: 'auto', confidence: 0.5 },
        update: { value, confidence: { increment: 0.1 }, lastAccessedAt: new Date() },
      });
      count++;
    }
  }
  return count;
}
