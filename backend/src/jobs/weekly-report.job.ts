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
const PROMPT = loadPrompt('weekly-report.txt', '你是项目管理助手，请生成周报。');

cron.schedule('0 9 * * 1', async () => {
  console.log('[weekly-report] 开始...');
  try {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const users = await prisma.user.findMany({
      where: { conversations: { some: { createdAt: { gte: weekAgo } } } },
      select: { id: true, preferences: { select: { systemNotify: true } } },
    });
    for (const user of users) {
      try {
        if (user.preferences && !user.preferences.systemNotify) continue;

        const stats = await dashboardService.getStats(user.id);
        const [weeklyDone, weeklyCreated, weeklyConversations] = await Promise.all([
          prisma.task.findMany({ where: { project: { ownerId: user.id }, status: 'DONE', updatedAt: { gte: weekAgo } }, select: { title: true, project: { select: { name: true } } } }),
          prisma.task.findMany({ where: { project: { ownerId: user.id }, createdAt: { gte: weekAgo } }, select: { title: true } }),
          prisma.conversation.findMany({ where: { userId: user.id, createdAt: { gte: weekAgo } }, select: { role: true, content: true }, orderBy: { createdAt: 'desc' }, take: 15 }),
        ]);
        const dialog = weeklyConversations.map(c => c.content.slice(0, 80)).join('\n').slice(0, 1500);

        const data = JSON.stringify({ stats, weeklyDone, weeklyCreated, weeklyDialog: dialog || '(无)' });
        const prompt = PROMPT.replace('{{data}}', data);

        const ai = new AIService(user.id);
        if (!await ai.init()) { console.log(`[weekly-report] 用户 ${user.id} 无 AI 配置`); continue; }
        let result = '';
        for await (const event of ai.chat({ messages: [{ role: 'system', content: '你是一人公司周报助手。' }, { role: 'user', content: prompt }] })) {
          if (event.type === 'text') result += event.content;
        }
        if (result) {
          await notificationService.create(user.id, 'AI_REPORT', '📊 本周周报', result);
        }
      } catch (e) { console.error(`[weekly-report] 用户 ${user.id} 失败:`, e); }
    }
    console.log(`[weekly-report] 完成`);
  } catch (e) { console.error('[weekly-report] 失败:', e); }
}, { timezone: 'Asia/Shanghai' });
