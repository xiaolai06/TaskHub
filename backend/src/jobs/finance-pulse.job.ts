import cron from 'node-cron';
import { prisma } from '../server';
import { AIService } from '../services/ai.service';
import * as notificationService from '../services/notification.service';
import { loadPrompt } from '../utils/prompt-loader';

const PROMPT = loadPrompt(
  'system-finance-pulse.txt',
  '你是订单经营分析助手，请围绕每单报价、成本、利润、月入款给出简短可执行建议。',
);

cron.schedule('0 10 * * *', async () => {
  console.log('[finance-pulse] start');
  try {
    const users = await prisma.user.findMany({
      where: { projects: { some: {} } },
      select: { id: true, preferences: { select: { systemNotify: true } } },
    });

    for (const user of users) {
      try {
        if (user.preferences && !user.preferences.systemNotify) continue;

        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthStart = new Date(`${currentMonth}-01`);
        const projects = await prisma.project.findMany({
          where: { ownerId: user.id },
          select: { id: true, name: true, budget: true, status: true, updatedAt: true },
        });
        const projectIds = projects.map((project) => project.id);
        if (projectIds.length === 0) continue;

        const [costs, taskCostAgg, monthlyIncomeAgg] = await Promise.all([
          prisma.costRecord.findMany({
            where: { projectId: { in: projectIds }, date: { gte: monthStart } },
            select: { amount: true, category: true, projectId: true },
          }),
          prisma.task.groupBy({
            by: ['projectId'],
            where: { projectId: { in: projectIds }, cost: { gt: 0 }, createdAt: { gte: monthStart } },
            _sum: { cost: true },
          }),
          prisma.project.aggregate({
            where: { ownerId: user.id, status: 'COMPLETED', updatedAt: { gte: monthStart } },
            _sum: { budget: true },
          }),
        ]);

        const taskCostMap = new Map(taskCostAgg.map((row) => [row.projectId, row._sum.cost ?? 0]));
        const data = JSON.stringify({
          currentMonth,
          monthlyIncome: monthlyIncomeAgg._sum.budget || 0,
          projects: projects.map((project) => {
            const recordCost = costs.filter((cost) => cost.projectId === project.id).reduce((sum, cost) => sum + cost.amount, 0);
            const taskCost = taskCostMap.get(project.id) || 0;
            const quote = project.budget || 0;
            const totalCost = recordCost + taskCost;
            return {
              name: project.name,
              status: project.status,
              quote,
              totalCost,
              profit: quote - totalCost,
              costByCategory: costs.filter((cost) => cost.projectId === project.id).reduce((acc: Record<string, number>, cost) => {
                acc[cost.category] = (acc[cost.category] || 0) + cost.amount;
                return acc;
              }, { LABOR: taskCost }),
            };
          }),
        });

        const ai = new AIService(user.id);
        if (!await ai.init()) {
          console.log(`[finance-pulse] user ${user.id} has no AI config`);
          continue;
        }
        let result = '';
        for await (const event of ai.chat({ messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: data }] })) {
          if (event.type === 'text') result += event.content;
        }
        if (result) await notificationService.create(user.id, 'AI_INSIGHT', '订单利润简报', result);
      } catch (error) {
        console.error(`[finance-pulse] user ${user.id} failed:`, error);
      }
    }
    console.log('[finance-pulse] done');
  } catch (error) {
    console.error('[finance-pulse] failed:', error);
  }
}, { timezone: 'Asia/Shanghai' });