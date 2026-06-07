import * as notificationService from '../services/notification.service';
import type { NotificationType, EmailSummaryInput } from '../services/notification.service';
import { prisma } from '../server';

/**
 * 统一推送：站内通知 + 邮件 + Webhook
 * 所有定时任务共用此函数，根据用户偏好自动决定推送渠道
 */
export async function pushReport(params: {
  userId: string;
  title: string;
  content: string;
  type: NotificationType;
  emailSummary?: EmailSummaryInput;
}) {
  const { userId, title, content, type, emailSummary } = params;

  // 1. 创建站内通知（始终执行）
  await notificationService.create(userId, type, title, content);

  // 2. 读取用户偏好
  const [prefs, user] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);

  // 3. 发邮件（emailNotify=true 且有邮箱且有邮件模板）
  if (prefs?.emailNotify && user?.email && emailSummary) {
    try {
      await notificationService.sendSummaryEmail(user.email, title, emailSummary, userId);
    } catch (err) {
      console.warn(`[pushReport] 邮件发送失败 (${userId}):`, err instanceof Error ? err.message : err);
    }
  }

  // 4. 推送到 Webhook（webhookNotify=true）
  if (prefs?.webhookNotify) {
    try {
      // 从数据库读取 webhook 列表（JSON 格式）
      const setting = await prisma.setting.findFirst({
        where: { category: 'NOTIFY', key: 'webhooks' },
      });
      if (setting?.value) {
        const webhooks: Array<{ name: string; channel: string; url: string }> = JSON.parse(setting.value);
        for (const wh of webhooks) {
          try {
            await notificationService.sendWebhook(wh.channel, { title, content }, wh.url);
          } catch (err) {
            console.warn(`[pushReport] ${wh.name}(${wh.channel}) 推送失败:`, err instanceof Error ? err.message : err);
          }
        }
      }
    } catch (err) {
      console.warn(`[pushReport] Webhook 推送异常 (${userId}):`, err instanceof Error ? err.message : err);
    }
  }
}
