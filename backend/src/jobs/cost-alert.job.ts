import cron from 'node-cron';
import { prisma } from '../server';
import * as costService from '../services/cost.service';
import * as notificationService from '../services/notification.service';
import { logExecution } from '../utils/job-logger';
import logger from '../utils/logger';

const formatFen = (fen: number) => `¥${(fen / 100).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;

/** 手动触发成本预警（供当前用户使用） */
export async function runCostAlert(userId: string): Promise<string> {
  const projects = await prisma.project.findMany({
    where: { ownerId: userId, status: 'ACTIVE', budget: { gt: 0 } },
    select: { id: true, name: true, budget: true },
  });
  const alerts: string[] = [];
  for (const project of projects) {
    const summary = await costService.getSummaryByProject(userId, project.id);
    if (project.budget && summary.total / project.budget >= 0.8) {
      const percent = Math.round((summary.total / project.budget) * 100);
      alerts.push(`- ${project.name}: 成本 ${formatFen(summary.total)} / 报价 ${formatFen(project.budget)}，已占 ${percent}%`);
    }
  }
  if (alerts.length > 0) {
    await notificationService.create(
      userId,
      'COST_ALERT',
      `${alerts.length} 个订单成本预警`,
      `以下订单成本已超过报价的 80%：\n${alerts.join('\n')}`,
    );
  }
  return alerts.length > 0 ? `${alerts.length} 个预警` : '成本正常';
}

cron.schedule('0 10 * * *', async () => {
  logger.info({ job: 'cost-alert' }, 'start');
  try {
    const users = await prisma.user.findMany({
      where: { projects: { some: { status: 'ACTIVE', budget: { gt: 0 } } } },
      select: { id: true, preferences: { select: { projectNotify: true } } },
    });

    for (const user of users) {
      const userStart = Date.now();
      try {
        if (!user.preferences?.projectNotify) {
          await logExecution({ jobSlug: 'cost-alert', userId: user.id, status: 'skipped' });
          continue;
        }
        const result = await runCostAlert(user.id);
        await logExecution({ jobSlug: 'cost-alert', userId: user.id, status: 'success', result, durationMs: Date.now() - userStart });
      } catch (error) {
        logger.error({ job: 'cost-alert', userId: user.id, err: error }, 'user failed');
        await logExecution({ jobSlug: 'cost-alert', userId: user.id, status: 'error', error: error instanceof Error ? error.message : String(error), durationMs: Date.now() - userStart });
      }
    }
    logger.info({ job: 'cost-alert' }, 'done');
  } catch (error) {
    logger.error({ job: 'cost-alert', err: error }, 'failed');
  }
}, { timezone: 'Asia/Shanghai' });
