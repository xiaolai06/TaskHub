import { ToolDefinition } from './types';
import * as notificationService from '../../services/notification.service';

/** 轻量 Markdown → HTML（邮件兼容） */
function mdToHtml(md: string): string {
  // 如果已经是 HTML（包含标签），直接返回
  if (/<[a-z][\s\S]*>/i.test(md)) return md;

  let html = md
    // 代码块
    .replace(/```[\s\S]*?```/g, (m) => {
      const code = m.replace(/```\w*\n?/g, '').replace(/```$/g, '');
      return `<pre style="background:#f1f5f9;padding:12px;border-radius:8px;font-size:13px;overflow-x:auto;white-space:pre-wrap;">${escapeHtml(code)}</pre>`;
    })
    // 标题
    .replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:600;margin:16px 0 8px;color:#0f172a;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:17px;font-weight:700;margin:20px 0 10px;color:#0f172a;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:700;margin:24px 0 12px;color:#0f172a;">$1</h1>')
    // 表格
    .replace(/\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)+)/g, (_match, header, body) => {
      const ths = header.split('|').filter((s: string) => s.trim()).map((s: string) =>
        `<th style="padding:8px 12px;text-align:left;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;">${s.trim()}</th>`
      ).join('');
      const rows = body.trim().split('\n').map((row: string) => {
        const tds = row.split('|').filter((s: string) => s.trim()).map((s: string) =>
          `<td style="padding:8px 12px;border:1px solid #e2e8f0;">${s.trim()}</td>`
        ).join('');
        return `<tr>${tds}</tr>`;
      }).join('');
      return `<table style="border-collapse:collapse;margin:12px 0;width:100%;font-size:13px;"><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
    })
    // 粗体（必须在斜体之前，避免 ** 被 * 先匹配）
    .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
    // 斜体（只匹配单个 * 且前后不是 *）
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/gs, '<em>$1</em>')
    // 行内代码
    .replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:2px 5px;border-radius:3px;font-size:12px;">$1</code>')
    // 列表项
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li style="margin:4px 0;">$2</li>')
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#4f46e5;">$1</a>')
    // 分割线
    .replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">');

  // 包裹连续 li 为 ul
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul style="margin:8px 0;padding-left:20px;">$1</ul>');

  // 段落：非标签行用 <p> 包裹
  html = html.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (/^<[a-z]/i.test(trimmed)) return trimmed;
    return `<p style="margin:6px 0;line-height:1.7;">${trimmed}</p>`;
  }).join('\n');

  return html;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export const sendEmailTool: ToolDefinition = {
  name: 'send_email',
  description: '发送邮件给指定收件人。可用于给客户发送项目进度、报价单、感谢信、周报等。body 支持 Markdown 格式，会自动转换为 HTML。需要用户确认后才发送。',
  category: 'client',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'balanced',
  parameters: {
    type: 'object',
    properties: {
      to: { type: 'string', description: '收件人邮箱地址' },
      subject: { type: 'string', description: '邮件标题' },
      body: { type: 'string', description: '邮件正文（支持 Markdown，自动转 HTML）' },
    },
    required: ['to', 'subject', 'body'],
  },
  handler: async (args, userId) => {
    const to = String(args.to || '').trim();
    const subject = String(args.subject || '').trim();
    const body = String(args.body || '').trim();

    if (!to || !to.includes('@')) return { error: '收件人邮箱格式不正确' };
    if (!subject) return { error: '邮件标题不能为空' };
    if (!body) return { error: '邮件正文不能为空' };

    try {
      const html = mdToHtml(body);
      const result = await notificationService.sendEmail(to, subject, html, userId);
      return {
        success: true,
        message: `邮件已发送给 ${to}`,
        messageId: result.messageId,
        accepted: result.accepted,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '发送失败';
      if (msg.includes('SMTP_NOT_CONFIGURED')) {
        return { error: 'SMTP 未配置，请在 系统设置 → 邮件设置 中配置 SMTP 服务器和授权码' };
      }
      return { error: `邮件发送失败: ${msg}` };
    }
  },
};
