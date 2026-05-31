import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { prisma } from '../server';
import { AIService } from '../services/ai.service';
import * as notificationService from '../services/notification.service';

function loadPrompt(filename: string, fallback: string): string {
  try {
    return fs.readFileSync(path.resolve(__dirname, `../prompts/${filename}`), 'utf-8');
  } catch {
    console.warn(`[client-radar] Prompt file ${filename} not found, using fallback`);
    return fallback;
  }
}
const PROMPT = loadPrompt('system-client-radar.txt', '你是客户关系管理助手，请分析客户动态。');

cron.schedule('0 9 * * *', async () => {
  console.log('[client-radar] 开始...');
  try {
    const users = await prisma.user.findMany({
      where: { customers: { some: {} } },
      select: { id: true, preferences: { select: { systemNotify: true } } },
    });
    for (const user of users) {
      try {
        if (user.preferences && !user.preferences.systemNotify) continue;

        const customers = await prisma.customer.findMany({ where: { userId: user.id }, select: { id: true, name: true, company: true, status: true } });
        const communications = await prisma.communication.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50, select: { customerId: true, content: true, createdAt: true } });
        if (customers.length === 0) continue;

        const today = new Date();
        const clientData = customers.map(c => {
          const lastComm = communications.find(com => com.customerId === c.id);
          const daysSince = lastComm ? Math.floor((today.getTime() - lastComm.createdAt.getTime()) / 86400000) : 999;
          return { name: c.name, company: c.company, status: c.status, lastContactDays: daysSince, lastContent: lastComm?.content?.slice(0, 50) || '' };
        });

        const data = JSON.stringify({ customers: clientData, totalCustomers: customers.length });
        const ai = new AIService(user.id);
        if (!await ai.init()) { console.log(`[client-radar] 用户 ${user.id} 无 AI 配置`); continue; }
        let result = '';
        for await (const event of ai.chat({ messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: data }] })) {
          if (event.type === 'text') result += event.content;
        }
        if (result) {
          await notificationService.create(user.id, 'AI_INSIGHT', '📡 客户雷达', result);
        }
      } catch (e) { console.error(`[client-radar] 用户 ${user.id} 失败:`, e); }
    }
    console.log(`[client-radar] 完成`);
  } catch (e) { console.error('[client-radar] 失败:', e); }
}, { timezone: 'Asia/Shanghai' });
