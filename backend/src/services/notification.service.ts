import { prisma } from '../server';
import { AppError, NotFoundError } from '../utils/errors';
import type { NotificationFilters } from '../validators/notification.schema';
import nodemailer from 'nodemailer';

// ═══ 查询 ═══

export async function findAll(userId: string, filters?: NotificationFilters) {
  const { page = 1, limit = 20, type, read } = filters || {};
  const where: Record<string, unknown> = { userId };
  if (type) where.type = type;
  if (read !== undefined) where.read = read;

  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function markAsRead(userId: string, id: string) {
  const record = await prisma.notification.findUnique({ where: { id } });
  if (!record || record.userId !== userId) throw new NotFoundError('通知');
  return prisma.notification.update({ where: { id }, data: { read: true } });
}

export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return { count: result.count };
}

export async function remove(userId: string, id: string) {
  const record = await prisma.notification.findUnique({ where: { id } });
  if (!record || record.userId !== userId) throw new NotFoundError('通知');
  return prisma.notification.delete({ where: { id } });
}

// ═══ 创建（所有 Job 依赖） ═══

export async function create(
  userId: string,
  type: 'TASK_DUE' | 'COST_ALERT' | 'PROJECT_CHANGE' | 'AI_INSIGHT' | 'AI_REPORT' | 'SYSTEM',
  title: string,
  content: string,
  relatedId?: string,
) {
  return prisma.notification.create({
    data: { userId, type, title, content, read: false, relatedId },
  });
}

// ═══ Email（nodemailer，已存在于依赖中） ═══

export async function sendEmail(to: string, subject: string, body: string) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, html: body });
}
