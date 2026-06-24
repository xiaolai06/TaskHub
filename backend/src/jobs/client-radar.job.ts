import cron from 'node-cron';
import { prisma } from '../server';
import { AIService } from '../services/ai.service';
import * as notificationService from '../services/notification.service';
import { pushReport } from '../utils/push-helper';
import { loadPrompt } from '../utils/prompt-loader';
import { logExecution } from '../utils/job-logger';
import logger from '../utils/logger';
const PROMPT = loadPrompt('system-client-radar.txt', '你是客户关系管理助手，请分析客户动态。');

export async function runClientRadar(userId: string): Promise<string> {
  const customers = await prisma.customer.findMany({ where: { userId }, select: { id: true, name: true, company: true, status: true } });
  const communications = await prisma.communication.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50, select: { customerId: true, content: true, createdAt: true } });

  const today = new Date();
  const clientData = customers.map(c => {
    const lastComm = communications.find(com => com.customerId === c.id);
    const daysSince = lastComm ? Math.floor((today.getTime() - lastComm.createdAt.getTime()) / 86400000) : 999;
    return { name: c.name, company: c.company, status: c.status, lastContactDays: daysSince, lastContent: lastComm?.content?.slice(0, 50) || '' };
  });

  const data = JSON.stringify({ customers: clientData, totalCustomers: customers.length });
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
      title: '📡 客户雷达',
      content: result,
      type: 'AI_INSIGHT',
      emailSummary: {
        preheader: '客户跟进提醒和关系健康度分析',
        headline: '客户雷达',
        intro: '以下是客户关系健康度分析和跟进建议。',
        sections: [
          { title: 'AI 分析', bullets: result.split('\n').filter(l => l.trim()).slice(0, 10) },
          { title: '需关注客户', bullets: clientData.filter(c => c.lastContactDays > 7).map(c => `${c.name} — ${c.lastContactDays} 天未联系`) },
        ],
        ctaLabel: '打开 TaskFlow',
        ctaUrl: '/main/customers',
      },
    });
  }
  return result;
}

cron.schedule('0 9 * * *', async () => {
  logger.info({ job: 'client-radar' }, '开始');
  try {
    const users = await prisma.user.findMany({
      where: { customers: { some: {} } },
      select: { id: true, preferences: { select: { systemNotify: true } } },
    });
    for (const user of users) {
      const userStart = Date.now();
      try {
        if (user.preferences && !user.preferences.systemNotify) {
          await logExecution({ jobSlug: 'client-radar', userId: user.id, status: 'skipped' });
          continue;
        }
        const customerCount = await prisma.customer.count({ where: { userId: user.id } });
        if (customerCount === 0) {
          await logExecution({ jobSlug: 'client-radar', userId: user.id, status: 'skipped' });
          continue;
        }
        await runClientRadar(user.id);
        await logExecution({ jobSlug: 'client-radar', userId: user.id, status: 'success', durationMs: Date.now() - userStart });
      } catch (e) {
        logger.error({ job: 'client-radar', userId: user.id, err: e }, '用户失败');
        await logExecution({ jobSlug: 'client-radar', userId: user.id, status: 'error', error: e instanceof Error ? e.message : String(e), durationMs: Date.now() - userStart });
      }
    }
    logger.info({ job: 'client-radar' }, '完成');
  } catch (e) { logger.error({ job: 'client-radar', err: e }, '失败'); }
}, { timezone: 'Asia/Shanghai' });
