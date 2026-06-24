import cron from 'node-cron';
import { prisma } from '../server';
import { AIService } from '../services/ai.service';
import { pushReport } from '../utils/push-helper';
import * as dashboardService from '../services/dashboard.service';
import { loadPrompt } from '../utils/prompt-loader';
import { logExecution } from '../utils/job-logger';
import logger from '../utils/logger';
const PROMPT = loadPrompt('health-check.txt', '你是项目健康度检查助手，请分析项目状态。');

export async function runHealthCheck(userId: string): Promise<string> {
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const stats = await dashboardService.getStats(userId);
  const goals = await prisma.goal.findMany({ where: { userId, status: 'ACTIVE' }, select: { title: true, currentValue: true } });
  const customerCount = await prisma.customer.count({ where: { userId } });
  const weeklyConversations = await prisma.conversation.count({ where: { userId, createdAt: { gte: weekAgo } } });

  const data = JSON.stringify({ stats, goals, customerCount, weeklyConversations });
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
      title: '🫀 业务体检',
      content: result,
      type: 'AI_INSIGHT',
      emailSummary: {
        preheader: '经营健康度多维评估报告',
        headline: '业务体检报告',
        intro: '以下是根据你的项目、客户、财务、目标四个维度生成的健康度评估。',
        sections: [
          { title: 'AI 评估', bullets: result.split('\n').filter(l => l.trim()).slice(0, 10) },
          { title: '关键指标', bullets: [
            `活跃项目: ${stats.projectCount} 个`,
            `待办任务: ${stats.totalTasks - stats.doneTasks} 个`,
            `逾期任务: ${stats.overdueCount} 个`,
            `客户总数: ${customerCount}`,
          ]},
        ],
        ctaLabel: '打开 TaskFlow',
        ctaUrl: '/main/dashboard',
      },
    });
  }
  return result;
}

cron.schedule('0 10 * * 0', async () => {
  logger.info({ job: 'health-check' }, '开始');
  try {
    const users = await prisma.user.findMany({
      where: { projects: { some: {} } },
      select: { id: true, preferences: { select: { systemNotify: true } } },
    });
    for (const user of users) {
      const userStart = Date.now();
      try {
        if (user.preferences && !user.preferences.systemNotify) {
          await logExecution({ jobSlug: 'health-check', userId: user.id, status: 'skipped' });
          continue;
        }
        await runHealthCheck(user.id);
        await logExecution({ jobSlug: 'health-check', userId: user.id, status: 'success', durationMs: Date.now() - userStart });
      } catch (e) {
        logger.error({ job: 'health-check', userId: user.id, err: e }, '用户失败');
        await logExecution({ jobSlug: 'health-check', userId: user.id, status: 'error', error: e instanceof Error ? e.message : String(e), durationMs: Date.now() - userStart });
      }
    }
    logger.info({ job: 'health-check' }, '完成');
  } catch (e) { logger.error({ job: 'health-check', err: e }, '失败'); }
}, { timezone: 'Asia/Shanghai' });
