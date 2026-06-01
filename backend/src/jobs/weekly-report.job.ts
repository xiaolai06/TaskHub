import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { prisma } from '../server';
import { AIService } from '../services/ai.service';
import * as notificationService from '../services/notification.service';
import * as dashboardService from '../services/dashboard.service';

function loadPrompt(filename: string, fallback: string): string {
  try {
    return fs.readFileSync(path.resolve(__dirname, `../prompts/${filename}`), 'utf-8');
  } catch {
    console.warn(`[weekly-report] Prompt file ${filename} not found, using fallback`);
    return fallback;
  }
}

function reportBullets(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean);
  return (lines.length ? lines : [text.trim()]).slice(0, 10);
}

const PROMPT = loadPrompt('weekly-report.txt', '你是项目管理助手，请生成周报。');

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

        const stats = await dashboardService.getStats(user.id);
        const [weeklyDone, weeklyCreated, weeklyConversations] = await Promise.all([
          prisma.task.findMany({
            where: { project: { ownerId: user.id }, status: 'DONE', updatedAt: { gte: weekAgo } },
            select: { title: true, project: { select: { name: true } } },
          }),
          prisma.task.findMany({
            where: { project: { ownerId: user.id }, createdAt: { gte: weekAgo } },
            select: { title: true },
          }),
          prisma.conversation.findMany({
            where: { userId: user.id, createdAt: { gte: weekAgo } },
            select: { role: true, content: true },
            orderBy: { createdAt: 'desc' },
            take: 15,
          }),
        ]);
        const dialog = weeklyConversations.map((c) => c.content.slice(0, 80)).join('\n').slice(0, 1500);

        const data = JSON.stringify({ stats, weeklyDone, weeklyCreated, weeklyDialog: dialog || '(无)' });
        const prompt = PROMPT.replace('{{data}}', data);

        const ai = new AIService(user.id);
        if (!await ai.init()) {
          console.log(`[weekly-report] user ${user.id} has no AI config`);
          continue;
        }

        let result = '';
        for await (const event of ai.chat({ messages: [{ role: 'system', content: '你是一人公司周报助手。' }, { role: 'user', content: prompt }] })) {
          if (event.type === 'text') result += event.content;
        }

        if (result) {
          await notificationService.create(user.id, 'AI_REPORT', '本周周报', result);
          if (user.preferences?.emailNotify && user.email) {
            await notificationService.sendSummaryEmail(
              user.email,
              'TaskFlow 本周周报',
              {
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
              user.id,
            );
          }
        }
      } catch (e) {
        console.error(`[weekly-report] user ${user.id} failed:`, e);
      }
    }
    console.log('[weekly-report] done');
  } catch (e) {
    console.error('[weekly-report] failed:', e);
  }
}, { timezone: 'Asia/Shanghai' });
