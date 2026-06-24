import cron from 'node-cron';
import { prisma } from '../server';
import * as schedulerService from '../services/scheduler.service';
import * as notificationService from '../services/notification.service';
import { logExecution } from '../utils/job-logger';
import logger from '../utils/logger';

/** 手动触发到期提醒（供当前用户使用） */
export async function runDueReminder(userId: string): Promise<string> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const projects = await prisma.project.findMany({ where: { ownerId: userId, status: 'ACTIVE' }, select: { id: true, name: true } });
  const allDelays: string[] = [];
  for (const p of projects) {
    const delays = await schedulerService.detectDelays(userId, p.id);
    for (const d of delays) { allDelays.push(`- [${p.name}] ${d.title}（逾期 ${d.overdueDays} 天）`); }
  }
  if (allDelays.length > 0) {
    await notificationService.create(userId, 'TASK_DUE', `${allDelays.length} 个任务已到期`, `以下任务已到期：\n${allDelays.join('\n')}`);
  }
  return allDelays.length > 0 ? `${allDelays.length} 个到期` : '无逾期任务';
}

cron.schedule('0 8 * * *', async () => {
  logger.info({ job: 'due-reminder' }, '开始');
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const users = await prisma.user.findMany({
      where: { projects: { some: { tasks: { some: { status: { not: 'DONE' }, dueDate: { lt: today } } } } } },
      select: { id: true, preferences: { select: { taskReminder: true } } },
    });
    for (const user of users) {
      const userStart = Date.now();
      try {
        if (!user.preferences?.taskReminder) {
          await logExecution({ jobSlug: 'due-reminder', userId: user.id, status: 'skipped' });
          continue;
        }
        const result = await runDueReminder(user.id);
        await logExecution({ jobSlug: 'due-reminder', userId: user.id, status: 'success', result, durationMs: Date.now() - userStart });
      } catch (e) {
        logger.error({ job: 'due-reminder', userId: user.id, err: e }, '用户失败');
        await logExecution({ jobSlug: 'due-reminder', userId: user.id, status: 'error', error: e instanceof Error ? e.message : String(e), durationMs: Date.now() - userStart });
      }
    }
    logger.info({ job: 'due-reminder', userCount: users.length }, '完成');
  } catch (e) { logger.error({ job: 'due-reminder', err: e }, '失败'); }
}, { timezone: 'Asia/Shanghai' });
