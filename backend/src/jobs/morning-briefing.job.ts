import cron from 'node-cron';
import { prisma } from '../server';
import { AIService } from '../services/ai.service';
import * as notificationService from '../services/notification.service';
import * as dashboardService from '../services/dashboard.service';
import { loadPrompt } from '../utils/prompt-loader';

function briefBullets(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean);
  return (lines.length ? lines : [text.trim()]).slice(0, 8);
}

const PROMPT = loadPrompt('system-morning.txt', '你是项目管理助手，请根据数据生成今日简报。');

cron.schedule('0 8 * * *', async () => {
  console.log('[morning-briefing] start');
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const users = await prisma.user.findMany({
      where: { projects: { some: { tasks: { some: {} } } } },
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
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [todayTasks, overdueTasks, yesterdayDone] = await Promise.all([
          prisma.task.findMany({
            where: { project: { ownerId: user.id }, status: { not: 'DONE' }, dueDate: today },
            include: { project: { select: { name: true } } },
            take: 10,
          }),
          prisma.task.findMany({
            where: { project: { ownerId: user.id }, status: { not: 'DONE' }, dueDate: { lt: today } },
            include: { project: { select: { name: true } } },
            take: 10,
          }),
          prisma.task.findMany({
            where: { project: { ownerId: user.id }, status: 'DONE', updatedAt: { gte: new Date(Date.now() - 86400000) } },
            select: { title: true },
            take: 5,
          }),
        ]);

        const recentConversations = await prisma.conversation.findMany({
          where: { userId: user.id, createdAt: { gte: sevenDaysAgo } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { content: true },
        });
        const dialog = recentConversations.map((c) => c.content.slice(0, 100)).join('\n').slice(0, 1000);

        if (todayTasks.length === 0 && overdueTasks.length === 0) continue;

        const data = JSON.stringify({ stats, todayTasks, overdueTasks, yesterdayDone, recentDialog: dialog || '(无)' });

        const ai = new AIService(user.id);
        if (!await ai.init()) {
          console.log(`[morning-briefing] user ${user.id} has no AI config`);
          continue;
        }

        let result = '';
        for await (const event of ai.chat({ messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: data }] })) {
          if (event.type === 'text') result += event.content;
        }

        if (result) {
          await notificationService.create(user.id, 'AI_INSIGHT', '晨间简报', result);
          if (user.preferences?.emailNotify && user.email) {
            await notificationService.sendSummaryEmail(
              user.email,
              'TaskFlow 晨间简报',
              {
                preheader: '今日任务、逾期事项和 AI 建议摘要',
                headline: '晨间简报',
                intro: '以下是 TaskFlow 根据你的项目和任务数据生成的今日摘要。',
                sections: [
                  { title: 'AI 建议', bullets: briefBullets(result) },
                  { title: '今日任务', bullets: todayTasks.map((task) => `${task.title} - ${task.project.name}`) },
                  { title: '逾期任务', bullets: overdueTasks.map((task) => `${task.title} - ${task.project.name}`) },
                ],
                ctaLabel: '打开 TaskFlow',
                ctaUrl: '/',
              },
              user.id,
            );
          }
        }
      } catch (e) {
        console.error(`[morning-briefing] user ${user.id} failed:`, e);
      }
    }
    console.log(`[morning-briefing] done, users=${users.length}`);
  } catch (e) {
    console.error('[morning-briefing] failed:', e);
  }
}, { timezone: 'Asia/Shanghai' });
