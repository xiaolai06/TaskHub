import cron from 'node-cron';
import { prisma } from '../server';
import { AIService } from '../services/ai.service';
import * as notificationService from '../services/notification.service';
import { pushReport } from '../utils/push-helper';
import { loadPrompt } from '../utils/prompt-loader';
import { logExecution } from '../utils/job-logger';

const PROMPT = loadPrompt('memory-extract.txt', '从以下对话中提取关键信息。');

function parseJSONSafely(text: string): unknown[] {
  try { return JSON.parse(text); } catch { /* noop */ }
  const match = text.match(/\[[\s\S]*\]/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* noop */ } }
  return [];
}

/** 手动触发记忆沉淀（供当前用户使用） */
export async function runWeeklyMemory(userId: string): Promise<string> {
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const conversations = await prisma.conversation.findMany({
    where: { userId, createdAt: { gte: weekAgo } },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: { role: true, content: true },
  });
  const dialog = conversations.reverse().map(c => `${c.role}: ${c.content}`).join('\n');
  const trimmed = dialog.length > 3000 ? dialog.slice(-3000) : dialog;
  if (conversations.length < 5) return '对话不足 5 条，跳过';

  const ai = new AIService(userId);
  if (!await ai.init()) throw new Error('AI 未配置');

  let response = '';
  for await (const event of ai.chat({ messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: `对话内容：\n${trimmed}` }] })) {
    if (event.type === 'text') response += event.content;
  }

  const memories = parseJSONSafely(response);
  let stored = 0;
  for (const mem of memories) {
    const m = mem as Record<string, unknown>;
    if (!m.key || !m.value || (m.confidence as number || 0) < 0.5) continue;
    await prisma.userMemory.upsert({
      where: { userId_key: { userId, key: String(m.key) } },
      create: { userId, category: String(m.category || 'SUMMARY'), key: String(m.key), value: String(m.value), confidence: (m.confidence as number) || 0.5, source: 'weekly-ai' },
      update: { value: String(m.value), confidence: { increment: 0.05 }, lastAccessedAt: new Date() },
    });
    stored++;
  }
  if (stored > 0) {
    await pushReport({
      userId,
      title: '🧠 记忆沉淀',
      content: `从本周 ${conversations.length} 条对话中提炼了 ${stored} 条记忆。`,
      type: 'AI_REPORT',
    });
  }
  return `提炼 ${stored} 条记忆`;
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
      const userStart = Date.now();
      try {
        if (user.preferences && !user.preferences.systemNotify) {
          await logExecution({ jobSlug: 'weekly-memory', userId: user.id, status: 'skipped' });
          continue;
        }
        const result = await runWeeklyMemory(user.id);
        await logExecution({ jobSlug: 'weekly-memory', userId: user.id, status: 'success', result, durationMs: Date.now() - userStart });
      } catch (e) {
        console.error(`[weekly-memory] 用户 ${user.id} 失败:`, e);
        await logExecution({ jobSlug: 'weekly-memory', userId: user.id, status: 'error', error: e instanceof Error ? e.message : String(e), durationMs: Date.now() - userStart });
      }
    }
    console.log('[weekly-memory] 完成');
  } catch (e) { console.error('[weekly-memory] 失败:', e); }
}, { timezone: 'Asia/Shanghai' });
