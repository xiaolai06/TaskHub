import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const listNotificationsTool: ToolDefinition = {
  name: 'list_notifications',
  description: `通知列表。支持按类型和已读状态筛选。

使用时机:
- "查看通知"、"有什么通知"、"未读通知"

不使用时机:
- 发送通知 → 用 send_email / send_webhook
- 未读数量 → 用 get_unread_count

返回数据: 通知列表含 title/content/read/type/createdAt`,
  category: 'notification',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      unreadOnly: { type: 'boolean', description: '只看未读' },
      type: { type: 'string', description: '筛选类型：TASK_DUE/COST_ALERT/PROJECT_CHANGE/AI_REPORT/SYSTEM' },
      limit: { type: 'number', description: '返回条数，默认 20' },
    },
  },
  handler: async (args, userId) => {
    const where: Record<string, unknown> = { userId };
    if (args.unreadOnly) where.read = false;
    if (args.type) where.type = args.type;

    const limit = (args.limit as number) || 20;
    const notifications = await prisma.notification.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const unreadCount = notifications.filter(n => !n.read).length;

    return {
      meta: { tool: 'list_notifications', total: notifications.length, unread: unreadCount },
      highlights: { total: notifications.length, unread: unreadCount },
      summary: `${notifications.length} 条通知，${unreadCount} 条未读`,
      data: notifications.map(n => ({
        id: n.id,
        title: n.title,
        content: n.content.slice(0, 100),
        type: n.type,
        read: n.read,
        createdAt: n.createdAt.toISOString().split('T')[0],
      })),
    };
  },
};

export const getUnreadCountTool: ToolDefinition = {
  name: 'get_unread_count',
  description: '未读通知数量。用户问"有多少未读""通知数量"时调用。',
  category: 'notification',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {},
  },
  handler: async (_args, userId) => {
    const count = await prisma.notification.count({ where: { userId, read: false } });
    return {
      meta: { tool: 'get_unread_count' },
      highlights: { unread: count },
      summary: `${count} 条未读通知`,
      data: { unread: count },
    };
  },
};

export const markAsReadTool: ToolDefinition = {
  name: 'mark_as_read',
  description: '标记通知已读。用户说"标记已读""全部已读"时调用。写操作需确认。',
  category: 'notification',
  access: 'write',
  requiresConfirmation: false,
  preferredModel: 'fast',
  parameters: {
    type: 'object',
    properties: {
      notificationId: { type: 'string', description: '通知 ID，不传则标记全部已读' },
      markAll: { type: 'boolean', description: '是否标记全部已读' },
    },
  },
  handler: async (args, userId) => {
    if (args.markAll) {
      await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
      return { success: true, action: '全部标记已读', summary: '已标记所有通知为已读', details: {} };
    }

    const id = args.notificationId as string;
    if (!id) return { error: '请提供通知 ID 或设置 markAll=true' };

    const notification = await prisma.notification.findFirst({ where: { id, userId } });
    if (!notification) return { error: '未找到该通知' };

    await prisma.notification.update({ where: { id }, data: { read: true } });
    return {
      success: true,
      action: '标记已读',
      summary: `已标记「${notification.title}」为已读`,
      details: { 标题: notification.title },
    };
  },
};
