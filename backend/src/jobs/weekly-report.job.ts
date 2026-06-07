import cron from 'node-cron';
import { prisma } from '../server';
import { AIService } from '../services/ai.service';
import * as notificationService from '../services/notification.service';
import * as dashboardService from '../services/dashboard.service';
import { pushReport } from '../utils/push-helper';
import { loadPrompt } from '../utils/prompt-loader';

function reportBullets(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean);
  return (lines.length ? lines : [text.trim()]).slice(0, 10);
}

const PROMPT = loadPrompt('weekly-report.txt', '你是项目管理助手，请生成周报。');

export async function runWeeklyReport(userId: string): Promise<string> {
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const stats = await dashboardService.getStats(userId);
  const [weeklyDone, weeklyCreated, weeklyConversations] = await Promise.all([
    prisma.task.findMany({
      where: { project: { ownerId: userId }, status: 'DONE', updatedAt: { gte: weekAgo } },
      select: { title: true, project: { select: { name: true } } },
    }),
    prisma.task.findMany({
      where: { project: { ownerId: userId }, createdAt: { gte: weekAgo } },
      select: { title: true },
    }),
    prisma.conversation.findMany({
      where: { userId, createdAt: { gte: weekAgo } },
      select: { role: true, content: true },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
  ]);
  const dialog = weeklyConversations.map((c) => c.content.slice(0, 80)).join('\n').slice(0, 1500);

  const data = JSON.stringify({ stats, weeklyDone, weeklyCreated, weeklyDialog: dialog || '(无)' });
  const prompt = PROMPT.replace('{{data}}', data);

  const ai = new AIService(userId);
  if (!await ai.init()) {
    throw new Error(`user ${userId} has no AI config`);
  }

  let result = '';
  for await (const event of ai.chat({ messages: [{ role: 'system', content: '你是一人公司周报助手。' }, { role: 'user', content: prompt }] })) {
    if (event.type === 'text') result += event.content;
  }

  if (result) {
    await pushReport({
      userId,
      title: '本周周报',
      content: result,
      type: 'AI_REPORT',
      emailSummary: {
        preheader: '本周完成、创建任务和 AI 复盘摘要',
        headline: '本周周报',
        intro: '以下是 TaskFlow 根据你本周的任务和对话生成的周报。',
        sections: [
          { title: 'AI 复盘', bullets: reportBullets(result) },
          { title: '本周完成', bullets: weeklyDone.map((task) => `${task.title} - ${task.project.name}`) },
          { title: '本周新增', bullets: weeklyCreated.map((task) => task.title) },
        ],
        ctaLabel: '打开 TaskFlow',
        ctaUrl: '/',
      },
    });
  }

  return result;
}

cron.schedule('0 9 * * 1', async () => {
  console.log('[weekly-report] start');
  try {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const users = await prisma.user.findMany({
      where: { conversations: { some: { createdAt: { gte: weekAgo } } } },
      select: {
        id: true,
        email: true,
        preferences: { select: { systemNotify: true, emailNotify: true } },
      },
    });

    for (const user of users) {
      try {
        if (user.preferences && !user.preferences.systemNotify) continue;
        await runWeeklyReport(user.id);
      } catch (e) {
        console.error(`[weekly-report] user ${user.id} failed:`, e);
      }
    }
    console.log('[weekly-report] done');
  } catch (e) {
    console.error('[weekly-report] failed:', e);
  }
}, { timezone: 'Asia/Shanghai' });
