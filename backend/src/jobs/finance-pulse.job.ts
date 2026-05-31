import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { prisma } from '../server';
import { AIService } from '../services/ai.service';
import * as notificationService from '../services/notification.service';

const PROMPT = fs.readFileSync(path.resolve(__dirname, '../prompts/system-finance-pulse.txt'), 'utf-8');

cron.schedule('0 10 * * *', async () => {
  console.log('[finance-pulse] 开始...');
  try {
    const users = await prisma.user.findMany({
      where: { projects: { some: { costRecords: { some: {} } } } },
      select: { id: true, preferences: { select: { systemNotify: true } } },
    });
    for (const user of users) {
      try {
        if (user.preferences && !user.preferences.systemNotify) continue;

        const projects = await prisma.project.findMany({ where: { ownerId: user.id }, select: { id: true, name: true, budget: true, status: true } });
        const currentMonth = new Date().toISOString().slice(0, 7);
        const costs = await prisma.costRecord.findMany({ where: { project: { ownerId: user.id }, date: { gte: new Date(currentMonth + '-01') } }, select: { amount: true, category: true, description: true, projectId: true } });
        const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 7);
        const lastCosts = await prisma.costRecord.aggregate({ where: { project: { ownerId: user.id }, date: { gte: new Date(lastMonth + '-01'), lt: new Date(currentMonth + '-01') } }, _sum: { amount: true } });

        const data = JSON.stringify({
          projects: projects.map(p => ({ name: p.name, budget: p.budget, totalCost: costs.filter(c => c.projectId === p.id).reduce((s, c) => s + c.amount, 0), costsByCategory: costs.filter(c => c.projectId === p.id).reduce((acc: Record<string,number>, c) => { acc[c.category] = (acc[c.category]||0) + c.amount; return acc; }, {}) })),
          thisMonthTotal: costs.reduce((s, c) => s + c.amount, 0),
          lastMonthTotal: lastCosts._sum.amount || 0,
        });
        if (costs.length === 0) continue;

        const ai = new AIService(user.id);
        if (!await ai.init()) { console.log(`[finance-pulse] 用户 ${user.id} 无 AI 配置`); continue; }
        let result = '';
        for await (const event of ai.chat({ messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: data }] })) {
          if (event.type === 'text') result += event.content;
        }
        if (result) {
          await notificationService.create(user.id, 'AI_INSIGHT', '💰 财务脉搏', result);
        }
      } catch (e) { console.error(`[finance-pulse] 用户 ${user.id} 失败:`, e); }
    }
    console.log(`[finance-pulse] 完成`);
  } catch (e) { console.error('[finance-pulse] 失败:', e); }
}, { timezone: 'Asia/Shanghai' });
