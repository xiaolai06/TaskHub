import nodemailer from 'nodemailer';
import { config } from '../config';
import { prisma } from '../server';
import { decrypt } from './encryption.service';
import { AppError, NotFoundError } from '../utils/errors';
import type { NotificationFilters } from '../validators/notification.schema';

export type NotificationType = 'TASK_DUE' | 'COST_ALERT' | 'PROJECT_CHANGE' | 'AI_INSIGHT' | 'AI_REPORT' | 'SYSTEM' | 'REMINDER';

export interface N8nNotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  relatedId?: string;
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return user?.email ?? null;
}

export async function checkSmtpConfigured(userId: string): Promise<{ configured: boolean; message?: string }> {
  const smtp = await prisma.setting.findMany({
    where: { category: 'EMAIL', OR: [{ userId: 'system' }, { userId }] },
  });
  const hasHost = smtp.some(s => ['host', 'smtp_host'].includes(s.key.toLowerCase()));
  const hasPass = smtp.some(s => ['pass', 'password', 'smtp_pass'].includes(s.key.toLowerCase()));
  if (!hasHost || !hasPass) {
    return { configured: false, message: 'SMTP 未配置，请在系统设置→邮件中填写' };
  }
  return { configured: true };
}

export async function getWebhookSettings(): Promise<Array<{ name: string; channel: string; url: string }>> {
  const setting = await prisma.setting.findFirst({ where: { category: 'NOTIFY', key: 'webhooks' } });
  if (!setting?.value) return [];
  try {
    return JSON.parse(setting.value);
  } catch {
    return [];
  }
}

export interface EmailSummaryItem {
  title: string;
  bullets: string[];
}

export interface EmailSummaryInput {
  preheader?: string;
  headline: string;
  intro?: string;
  sections: EmailSummaryItem[];
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}

interface ResolvedSmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

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

export async function create(
  userId: string,
  type: NotificationType,
  title: string,
  content: string,
  relatedId?: string,
) {
  return prisma.notification.create({
    data: { userId, type, title, content, read: false, relatedId },
  });
}

export async function createFromN8n(payload: N8nNotificationPayload) {
  return create(payload.userId, payload.type, payload.title, payload.content, payload.relatedId);
}

export async function sendWebhook(channel: string, data: Record<string, unknown>, directUrl?: string) {
  const webhookUrl = directUrl || await getWebhookUrl(channel);
  if (!webhookUrl) return { sent: false, channel, skipped: true };

  const body = formatWebhookPayload(channel, data);
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new AppError(`${channel} webhook send failed: ${response.status}`, 502, 'WEBHOOK_SEND_FAILED');
  }

  return { sent: true, channel };
}

function readSettingValue(value: string, encrypted: boolean): string {
  if (!encrypted) return value;
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

async function resolveSmtpConfig(userId?: string): Promise<ResolvedSmtpConfig> {
  const resolved: ResolvedSmtpConfig = {
    host: config.smtp.host,
    port: config.smtp.port,
    user: config.smtp.user,
    pass: config.smtp.pass,
    from: config.smtp.user,
    secure: config.smtp.port === 465,
  };

  const settings = userId
    ? [
        ...await prisma.setting.findMany({ where: { category: 'EMAIL', userId: 'system' } }),
        ...await prisma.setting.findMany({ where: { category: 'EMAIL', userId } }),
      ]
    : await prisma.setting.findMany({ where: { category: 'EMAIL', userId: 'system' } });

  for (const setting of settings) {
    const key = setting.key.toLowerCase();
    const value = readSettingValue(setting.value, setting.encrypted);
    switch (key) {
      case 'host':
      case 'smtp_host':
        resolved.host = value;
        break;
      case 'port':
      case 'smtp_port':
        resolved.port = Number(value) || resolved.port;
        break;
      case 'user':
      case 'smtp_user':
        resolved.user = value;
        break;
      case 'pass':
      case 'password':
      case 'smtp_pass':
        resolved.pass = value;
        break;
      case 'from':
      case 'smtp_from':
        resolved.from = value;
        break;
      case 'secure':
      case 'smtp_secure':
        resolved.secure = value === 'true' || value === '1';
        break;
      default:
        break;
    }
  }

  if (!resolved.host || !resolved.user || !resolved.pass) {
    throw new AppError('SMTP is not configured', 400, 'SMTP_NOT_CONFIGURED');
  }
  if (!resolved.from) resolved.from = resolved.user;
  if (!resolved.secure) resolved.secure = resolved.port === 465;

  return resolved;
}

function createTransporter(smtp: ResolvedSmtpConfig) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSummaryEmail(data: EmailSummaryInput) {
  const sections = data.sections.map((section) => {
    const bullets = section.bullets.length
      ? `<ul style="margin:8px 0 0 18px;padding:0;color:#334155;">${section.bullets
          .map((bullet) => `<li style="margin:6px 0;">${escapeHtml(bullet)}</li>`)
          .join('')}</ul>`
      : '<p style="margin:8px 0 0;color:#94a3b8;">暂无内容</p>';

    return `
      <section style="padding:20px 0;border-top:1px solid #e2e8f0;">
        <h2 style="margin:0;font-size:16px;color:#0f172a;">${escapeHtml(section.title)}</h2>
        ${bullets}
      </section>
    `;
  }).join('');

  const cta = data.ctaLabel && data.ctaUrl
    ? `
      <div style="margin:24px 0 0;">
        <a href="${escapeHtml(data.ctaUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;">${escapeHtml(data.ctaLabel)}</a>
      </div>
    `
    : '';

  const footer = data.footer
    ? `<p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:1.6;">${escapeHtml(data.footer)}</p>`
    : '';

  return `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(data.headline)}</title>
      </head>
      <body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(data.preheader || data.headline)}</div>
        <div style="max-width:720px;margin:0 auto;padding:32px 16px;">
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:28px 28px 24px;box-shadow:0 8px 24px rgba(15,23,42,0.05);">
            <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">TaskFlow</p>
            <h1 style="margin:0;font-size:24px;line-height:1.3;color:#0f172a;">${escapeHtml(data.headline)}</h1>
            ${data.intro ? `<p style="margin:12px 0 0;color:#475569;line-height:1.7;">${escapeHtml(data.intro)}</p>` : ''}
            ${sections}
            ${cta}
            ${footer}
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendEmail(to: string, subject: string, body: string, userId?: string) {
  const smtp = await resolveSmtpConfig(userId);
  const transporter = createTransporter(smtp);
  const info = await transporter.sendMail({ from: smtp.from, to, subject, html: body });
  return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
}

export async function sendSummaryEmail(
  to: string,
  subject: string,
  summary: EmailSummaryInput,
  userId?: string,
) {
  return sendEmail(to, subject, renderSummaryEmail(summary), userId);
}

export async function sendTestEmail(to: string, userId?: string) {
  return sendSummaryEmail(
    to,
    'TaskFlow 邮箱通知测试',
    {
      preheader: 'TaskFlow 邮件通道测试成功',
      headline: '邮箱通知已连通',
      intro: '这是一封测试邮件，用于确认 TaskFlow 的 SMTP 配置和邮件发送链路工作正常。',
      sections: [
        {
          title: '已验证内容',
          bullets: ['SMTP 主机和账号可用', '后端可正常构建邮件内容', '当前邮箱可以接收 TaskFlow 通知'],
        },
      ],
      footer: '如果你收到了这封邮件，后续可以继续启用每日摘要和关键提醒。',
    },
    userId,
  );
}

async function getWebhookUrl(channel: string): Promise<string | null> {
  const keyMap: Record<string, string> = {
    wechat: 'WECHAT_WEBHOOK',
    feishu: 'FEISHU_WEBHOOK',
    dingtalk: 'DINGTALK_WEBHOOK',
    slack: 'SLACK_WEBHOOK',
  };
  const key = keyMap[channel] || channel.toUpperCase();
  const setting = await prisma.setting.findFirst({
    where: { category: 'NOTIFY', key, userId: 'system' },
  });
  return setting?.value || null;
}

function formatWebhookPayload(channel: string, data: Record<string, unknown>) {
  const title = String(data.title || 'TaskFlow 通知');
  const content = String(data.content || '');

  switch (channel) {
    case 'wechat':
      return { msgtype: 'markdown', markdown: { content: `### ${title}\n${content}` } };
    case 'feishu':
      return {
        msg_type: 'interactive',
        card: {
          header: { title: { content: title, tag: 'plain_text' } },
          elements: [{ tag: 'markdown', content }],
        },
      };
    case 'dingtalk':
      return { msgtype: 'markdown', markdown: { title, text: `### ${title}\n${content}` } };
    case 'slack':
      return { text: `*${title}*\n${content}` };
    default:
      return data;
  }
}
