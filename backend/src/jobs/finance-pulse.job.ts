import cron from 'node-cron';
import { prisma } from '../server';
import { AIService } from '../services/ai.service';
import * as notificationService from '../services/notification.service';
import { pushReport } from '../utils/push-helper';
import { loadPrompt } from '../utils/prompt-loader';
import { logExecution } from '../utils/job-logger';
import logger from '../utils/logger';

const PROMPT = loadPrompt(
  'system-finance-pulse.txt',
  '你是订单经营分析助手，请围绕每单报价、成本、利润、月入款给出简短可执行建议。',
);

export async function runFinancePulse(userId: string): Promise<string> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthStart = new Date(`${currentMonth}-01`);
  const projects = await prisma.project.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true, budget: true, status: true, updatedAt: true },
  });
  const projectIds = projects.map((project) => project.id);

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
      where: { ownerId: userId, status: 'COMPLETED', updatedAt: { gte: monthStart } },
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

  const ai = new AIService(userId);
  if (!await ai.init()) {
    throw new Error(`user ${userId} has no AI config`);
  }
  let result = '';
  for await (const event of ai.chat({ messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: data }] })) {
    if (event.type === 'text') result += event.content;
  }
  if (result) {
    await pushReport({
      userId,
      title: '订单利润简报',
      content: result,
      type: 'AI_INSIGHT',
      emailSummary: {
        preheader: '本月订单利润分析和成本预警',
        headline: '订单利润简报',
        intro: '以下是本月各订单的利润分析和成本明细。',
        sections: [
          { title: 'AI 分析', bullets: result.split('\n').filter(l => l.trim()).slice(0, 10) },
        ],
        ctaLabel: '打开 TaskFlow',
        ctaUrl: '/main/reports',
      },
    });
  }
  return result;
}

cron.schedule('0 10 * * *', async () => {
  logger.info({ job: 'finance-pulse' }, 'start');
  try {
    const users = await prisma.user.findMany({
      where: { projects: { some: {} } },
      select: { id: true, preferences: { select: { systemNotify: true } } },
    });

    for (const user of users) {
      const userStart = Date.now();
      try {
        if (user.preferences && !user.preferences.systemNotify) {
          await logExecution({ jobSlug: 'finance-pulse', userId: user.id, status: 'skipped' });
          continue;
        }
        const projectCount = await prisma.project.count({ where: { ownerId: user.id } });
        if (projectCount === 0) {
          await logExecution({ jobSlug: 'finance-pulse', userId: user.id, status: 'skipped' });
          continue;
        }
        await runFinancePulse(user.id);
        await logExecution({ jobSlug: 'finance-pulse', userId: user.id, status: 'success', durationMs: Date.now() - userStart });
      } catch (error) {
        logger.error({ job: 'finance-pulse', userId: user.id, err: error }, 'user failed');
        await logExecution({ jobSlug: 'finance-pulse', userId: user.id, status: 'error', error: error instanceof Error ? error.message : String(error), durationMs: Date.now() - userStart });
      }
    }
    logger.info({ job: 'finance-pulse' }, 'done');
  } catch (error) {
    logger.error({ job: 'finance-pulse', err: error }, 'failed');
  }
}, { timezone: 'Asia/Shanghai' });