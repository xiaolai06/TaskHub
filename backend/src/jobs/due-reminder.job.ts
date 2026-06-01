import cron from 'node-cron';
import { prisma } from '../server';
import * as schedulerService from '../services/scheduler.service';
import * as notificationService from '../services/notification.service';

cron.schedule('0 8 * * *', async () => {
  console.log('[due-reminder] 开始...');
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const users = await prisma.user.findMany({
      where: { projects: { some: { tasks: { some: { status: { not: 'DONE' }, dueDate: { lt: today } } } } } },
      select: { id: true, preferences: { select: { taskReminder: true } } },
    });
    for (const user of users) {
      try {
        if (!user.preferences?.taskReminder) continue;
        const projects = await prisma.project.findMany({ where: { ownerId: user.id, status: 'ACTIVE' }, select: { id: true, name: true } });
        const allDelays: string[] = [];
        for (const p of projects) {
          const delays = await schedulerService.detectDelays(user.id, p.id);
          for (const d of delays) { allDelays.push(`- [${p.name}] ${d.title}（逾期 ${d.overdueDays} 天）`); }
        }
        if (allDelays.length > 0) {
          await notificationService.create(user.id, 'TASK_DUE', `${allDelays.length} 个任务已到期`, `以下任务已到期：\n${allDelays.join('\n')}`);
        }
      } catch (e) { console.error(`[due-reminder] 用户 ${user.id} 失败:`, e); }
    }
    console.log(`[due-reminder] 完成，${users.length} 用户`);
  } catch (e) { console.error('[due-reminder] 失败:', e); }
}, { timezone: 'Asia/Shanghai' });
