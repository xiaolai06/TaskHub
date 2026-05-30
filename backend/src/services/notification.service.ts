import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// TODO: findAll(userId, filters) - 通知列表
// TODO: getUnreadCount(userId) - 未读数量
// TODO: markAsRead(id) - 标记已读
// TODO: markAllAsRead(userId) - 全部标记已读
// TODO: delete(id) - 删除通知
// TODO: create(userId, type, title, content, relatedId?) - 创建通知
// TODO: sendWebhook(type, data) - 发送 Webhook 通知（企业微信/飞书/钉钉/Slack）
// TODO: sendEmail(to, subject, body) - 发送邮件通知
