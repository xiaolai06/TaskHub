import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors';
import { config } from '../config';

const prisma = new PrismaClient();

// ======================== 查询 ========================

/** 获取通知列表（支持分页 + 未读筛选） */
export async function findAll(
  userId: string,
  options: { page?: number; limit?: number; unreadOnly?: boolean } = {},
) {
  const { page = 1, limit = 20, unreadOnly = false } = options;
  const where = {
    userId,
    ...(unreadOnly ? { read: false } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return { data, meta: { total, page, limit } };
}

/** 获取未读通知数量 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}

// ======================== 写入 ========================

/** 创建通知（n8n 和后端业务通用） */
export async function create(
  userId: string,
  type: string,
  title: string,
  content: string,
  relatedId?: string,
) {
  const validTypes = ['TASK_DUE', 'COST_ALERT', 'PROJECT_CHANGE', 'AI_REPORT', 'SYSTEM'];
  if (!validTypes.includes(type)) {
    throw new ValidationError(`无效的通知类型: ${type}`);
  }

  return prisma.notification.create({
    data: { userId, type, title, content, relatedId },
  });
}

/** 标记单条已读 */
export async function markAsRead(id: string, userId: string) {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== userId) {
    throw new NotFoundError('通知');
  }

  return prisma.notification.update({
    where: { id },
    data: { read: true },
  });
}

/** 全部标记已读 */
export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

/** 删除通知 */
export async function remove(id: string, userId: string) {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== userId) {
    throw new NotFoundError('通知');
  }

  return prisma.notification.delete({ where: { id } });
}

// ======================== n8n 集成 ========================

/** n8n 创建通知（通过 Webhook 回调） */
export async function createFromN8n(payload: {
  userId: string;
  type: string;
  title: string;
  content: string;
  relatedId?: string;
}) {
  return create(payload.userId, payload.type, payload.title, payload.content, payload.relatedId);
}

/** 发送 Webhook 通知（企业微信/飞书/钉钉/Slack） */
export async function sendWebhook(channel: string, data: Record<string, unknown>) {
  const webhookUrl = await getWebhookUrl(channel);
  if (!webhookUrl) {
    console.warn(`⚠️ ${channel} Webhook URL 未配置，跳过推送`);
    return { sent: false, channel };
  }

  try {
    const body = formatWebhookPayload(channel, data);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`❌ ${channel} 推送失败: ${response.status}`);
      return { sent: false, channel, error: response.statusText };
    }

    return { sent: true, channel };
  } catch (err) {
    console.error(`❌ ${channel} 推送异常:`, err);
    return { sent: false, channel, error: String(err) };
  }
}

/** 从 Setting 表读取 Webhook URL */
async function getWebhookUrl(channel: string): Promise<string | null> {
  const keyMap: Record<string, string> = {
    wechat: 'WECHAT_WEBHOOK',
    feishu: 'FEISHU_WEBHOOK',
    dingtalk: 'DINGTALK_WEBHOOK',
    slack: 'SLACK_WEBHOOK',
  };

  const setting = await prisma.setting.findUnique({
    where: {
      userId_category_key: {
        userId: 'system',
        category: 'NOTIFY',
        key: keyMap[channel] || channel,
      },
    },
  });

  return setting?.value || null;
}

/** 按渠道格式化 Webhook 消息体 */
function formatWebhookPayload(channel: string, data: Record<string, unknown>) {
  const { title = '', content = '' } = data;

  switch (channel) {
    case 'wechat':
      return { msgtype: 'markdown', markdown: { content: `### ${title}\n${content}` } };
    case 'feishu':
      return { msg_type: 'interactive', card: { header: { title: { content: title, tag: 'plain_text' } }, elements: [{ tag: 'markdown', content }] } };
    case 'dingtalk':
      return { msgtype: 'markdown', markdown: { title, text: `### ${title}\n${content}` } };
    case 'slack':
      return { text: `*${title}*\n${content}` };
    default:
      return data;
  }
}
