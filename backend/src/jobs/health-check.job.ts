import cron from 'node-cron';
import { prisma } from '../server';
import { AIService } from '../services/ai.service';
import * as notificationService from '../services/notification.service';
import * as dashboardService from '../services/dashboard.service';
import { loadPrompt } from '../utils/prompt-loader';
const PROMPT = loadPrompt('health-check.txt', '你是项目健康度检查助手，请分析项目状态。');

cron.schedule('0 10 * * 0', async () => {
  console.log('[health-check] 开始...');
  try {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const users = await prisma.user.findMany({
      where: { projects: { some: {} } },
      select: { id: true, preferences: { select: { systemNotify: true } } },
    });
    for (const user of users) {
      try {
        if (user.preferences && !user.preferences.systemNotify) continue;

        const stats = await dashboardService.getStats(user.id);
        const goals = await prisma.goal.findMany({ where: { userId: user.id, status: 'ACTIVE' }, select: { title: true, currentValue: true } });
        const customerCount = await prisma.customer.count({ where: { userId: user.id } });
        const weeklyConversations = await prisma.conversation.count({ where: { userId: user.id, createdAt: { gte: weekAgo } } });

        const data = JSON.stringify({ stats, goals, customerCount, weeklyConversations });
        const ai = new AIService(user.id);
        if (!await ai.init()) { console.log(`[health-check] 用户 ${user.id} 无 AI 配置`); continue; }
        let result = '';
        for await (const event of ai.chat({ messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: data }] })) {
          if (event.type === 'text') result += event.content;
        }
        if (result) {
          await notificationService.create(user.id, 'AI_INSIGHT', '🫀 业务体检', result);
        }
      } catch (e) { console.error(`[health-check] 用户 ${user.id} 失败:`, e); }
    }
    console.log(`[health-check] 完成`);
  } catch (e) { console.error('[health-check] 失败:', e); }
}, { timezone: 'Asia/Shanghai' });
