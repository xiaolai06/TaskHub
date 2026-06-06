import cron from 'node-cron';
import { prisma } from '../server';
import { AIService } from '../services/ai.service';
import * as notificationService from '../services/notification.service';
import { loadPrompt } from '../utils/prompt-loader';
const PROMPT = loadPrompt('memory-extract.txt', '从以下对话中提取关键信息。');

function parseJSONSafely(text: string): any[] {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\[[\s\S]*\]/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  return [];
}

cron.schedule('0 20 * * 0', async () => {
  console.log('[weekly-memory] 开始...');
  try {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const users = await prisma.user.findMany({
      where: { conversations: { some: { createdAt: { gte: weekAgo } } } },
      select: { id: true, preferences: { select: { systemNotify: true } } },
    });
    for (const user of users) {
      try {
        if (user.preferences && !user.preferences.systemNotify) continue;

        const conversations = await prisma.conversation.findMany({ where: { userId: user.id, createdAt: { gte: weekAgo } }, orderBy: { createdAt: 'desc' }, take: 40, select: { role: true, content: true } });
        const dialog = conversations.reverse().map(c => `${c.role}: ${c.content}`).join('\n');
        const trimmed = dialog.length > 3000 ? dialog.slice(-3000) : dialog;
        if (conversations.length < 5) continue;

        const ai = new AIService(user.id);
        if (!await ai.init()) { console.log(`[weekly-memory] 用户 ${user.id} 无 AI 配置`); continue; }
        let response = '';
        for await (const event of ai.chat({ messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: `对话内容：\n${trimmed}` }] })) {
          if (event.type === 'text') response += event.content;
        }

        const memories = parseJSONSafely(response);
        let stored = 0;
        for (const mem of memories) {
          if (!mem.key || !mem.value || (mem.confidence || 0) < 0.5) continue;
          await prisma.userMemory.upsert({
            where: { userId_key: { userId: user.id, key: mem.key } },
            create: { userId: user.id, category: mem.category || 'SUMMARY', key: mem.key, value: String(mem.value), confidence: mem.confidence || 0.5, source: 'weekly-ai' },
            update: { value: String(mem.value), confidence: { increment: 0.05 }, lastAccessedAt: new Date() },
          });
          stored++;
        }
        if (stored > 0) {
          await notificationService.create(user.id, 'AI_REPORT', '🧠 记忆沉淀', `从本周 ${conversations.length} 条对话中提炼了 ${stored} 条记忆。`);
        }
      } catch (e) { console.error(`[weekly-memory] 用户 ${user.id} 失败:`, e); }
    }
    console.log(`[weekly-memory] 完成`);
  } catch (e) { console.error('[weekly-memory] 失败:', e); }
}, { timezone: 'Asia/Shanghai' });
