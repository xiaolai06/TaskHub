import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { prisma } from '../server';
import { AIService } from '../services/ai.service';
import * as notificationService from '../services/notification.service';
import * as dashboardService from '../services/dashboard.service';
import * as schedulerService from '../services/scheduler.service';

const PROMPT = fs.readFileSync(path.resolve(__dirname, '../prompts/system-morning.txt'), 'utf-8');

cron.schedule('0 8 * * *', async () => {
  console.log('[morning-briefing] 开始...');
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const users = await prisma.user.findMany({
      where: { projects: { some: { tasks: { some: {} } } } },
      select: { id: true, preferences: { select: { systemNotify: true } } },
    });
    for (const user of users) {
      try {
        if (user.preferences && !user.preferences.systemNotify) continue;

        // 收集数据
        const stats = await dashboardService.getStats(user.id);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const [todayTasks, overdueTasks, yesterdayDone] = await Promise.all([
          prisma.task.findMany({ where: { project: { ownerId: user.id }, status: { not: 'DONE' }, dueDate: today }, include: { project: { select: { name: true } } }, take: 10 }),
          prisma.task.findMany({ where: { project: { ownerId: user.id }, status: { not: 'DONE' }, dueDate: { lt: today } }, include: { project: { select: { name: true } } }, take: 10 }),
          prisma.task.findMany({ where: { project: { ownerId: user.id }, status: 'DONE', updatedAt: { gte: new Date(Date.now() - 86400000) } }, select: { title: true }, take: 5 }),
        ]);
        const recentConversations = await prisma.conversation.findMany({ where: { userId: user.id, createdAt: { gte: sevenDaysAgo } }, orderBy: { createdAt: 'desc' }, take: 10, select: { content: true } });
        const dialog = recentConversations.map(c => c.content.slice(0, 100)).join('\n').slice(0, 1000);

        if (todayTasks.length === 0 && overdueTasks.length === 0) continue;

        const data = JSON.stringify({ stats, todayTasks, overdueTasks, yesterdayDone, recentDialog: dialog || '(无)' });

        // AI 分析
        const ai = new AIService(user.id);
        if (!await ai.init()) { console.log(`[morning-briefing] 用户 ${user.id} 无 AI 配置`); continue; }
        let result = '';
        for await (const event of ai.chat({ messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: data }] })) {
          if (event.type === 'text') result += event.content;
        }
        if (result) {
          await notificationService.create(user.id, 'AI_INSIGHT', '☀️ 晨间简报', result);
        }
      } catch (e) { console.error(`[morning-briefing] 用户 ${user.id} 失败:`, e); }
    }
    console.log(`[morning-briefing] 完成，${users.length} 用户`);
  } catch (e) { console.error('[morning-briefing] 失败:', e); }
}, { timezone: 'Asia/Shanghai' });
