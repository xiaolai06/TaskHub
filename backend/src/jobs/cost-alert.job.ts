import cron from 'node-cron';
import { prisma } from '../server';
import * as costService from '../services/cost.service';
import * as notificationService from '../services/notification.service';

const formatFen = (fen: number) => `¥${(fen / 100).toFixed(0)}`;

cron.schedule('0 10 * * *', async () => {
  console.log('[cost-alert] 开始...');
  try {
    const users = await prisma.user.findMany({
      where: { projects: { some: { status: 'ACTIVE', budget: { gt: 0 }, costRecords: { some: {} } } } },
      select: { id: true, preferences: { select: { projectNotify: true } } },
    });
    for (const user of users) {
      try {
        if (!user.preferences?.projectNotify) continue;
        const projects = await prisma.project.findMany({ where: { ownerId: user.id, status: 'ACTIVE', budget: { gt: 0 } }, select: { id: true, name: true, budget: true } });
        const alerts: string[] = [];
        for (const p of projects) {
          const summary = await costService.getSummaryByProject(p.id);
          if (p.budget && summary.total / p.budget >= 0.8) {
            alerts.push(`- ${p.name}: ${formatFen(summary.total)} / ${formatFen(p.budget)}（${Math.round(summary.total / p.budget * 100)}%）`);
          }
        }
        if (alerts.length > 0) {
          await notificationService.create(user.id, 'COST_ALERT', `${alerts.length} 个项目成本预警`, `以下项目成本已超预算80%：\n${alerts.join('\n')}`);
        }
      } catch (e) { console.error(`[cost-alert] 用户 ${user.id} 失败:`, e); }
    }
    console.log(`[cost-alert] 完成`);
  } catch (e) { console.error('[cost-alert] 失败:', e); }
}, { timezone: 'Asia/Shanghai' });
