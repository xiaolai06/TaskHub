import cron from 'node-cron';
import { prisma } from '../server';
import * as costService from '../services/cost.service';
import * as notificationService from '../services/notification.service';

const formatFen = (fen: number) => `¥${(fen / 100).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;

cron.schedule('0 10 * * *', async () => {
  console.log('[cost-alert] start');
  try {
    const users = await prisma.user.findMany({
      where: { projects: { some: { status: 'ACTIVE', budget: { gt: 0 } } } },
      select: { id: true, preferences: { select: { projectNotify: true } } },
    });

    for (const user of users) {
      try {
        if (!user.preferences?.projectNotify) continue;
        const projects = await prisma.project.findMany({
          where: { ownerId: user.id, status: 'ACTIVE', budget: { gt: 0 } },
          select: { id: true, name: true, budget: true },
        });
        const alerts: string[] = [];
        for (const project of projects) {
          const summary = await costService.getSummaryByProject(user.id, project.id);
          if (project.budget && summary.total / project.budget >= 0.8) {
            const percent = Math.round((summary.total / project.budget) * 100);
            alerts.push(`- ${project.name}: 成本 ${formatFen(summary.total)} / 报价 ${formatFen(project.budget)}，已占 ${percent}%`);
          }
        }
        if (alerts.length > 0) {
          await notificationService.create(
            user.id,
            'COST_ALERT',
            `${alerts.length} 个订单成本预警`,
            `以下订单成本已超过报价的 80%：\n${alerts.join('\n')}`,
          );
        }
      } catch (error) {
        console.error(`[cost-alert] user ${user.id} failed:`, error);
      }
    }
    console.log('[cost-alert] done');
  } catch (error) {
    console.error('[cost-alert] failed:', error);
  }
}, { timezone: 'Asia/Shanghai' });