import { ToolDefinition } from './types';
import * as notificationService from '../../services/notification.service';
import { prisma } from '../../server';

export const sendWebhookTool: ToolDefinition = {
  name: 'send_webhook',
  description: '推送消息到企业微信/飞书/钉钉群机器人。通过昵称指定推送目标（如"项目群""客户群"），昵称在系统设置→推送管理中配置。如未找到昵称，返回错误提示。',
  category: 'work',
  access: 'write',
  requiresConfirmation: true,
  preferredModel: 'balanced',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '推送目标昵称，如"项目群""客户群""日报群"' },
      title: { type: 'string', description: '消息标题' },
      content: { type: 'string', description: '消息内容（支持 Markdown 格式）' },
    },
    required: ['name', 'title', 'content'],
  },
  handler: async (args) => {
    const name = String(args.name || '').trim();
    const title = String(args.title || '').trim();
    const content = String(args.content || '').trim();

    if (!name) return { error: '请指定推送目标昵称，如"项目群"。可在系统设置→推送管理中查看已配置的昵称。' };
    if (!title) return { error: '消息标题不能为空' };
    if (!content) return { error: '消息内容不能为空' };

    // 从数据库读取 webhook 列表
    const setting = await prisma.setting.findFirst({
      where: { category: 'NOTIFY', key: 'webhooks' },
    });
    if (!setting?.value) {
      return { error: '未配置任何推送目标，请在系统设置→推送管理中添加群机器人 Webhook。' };
    }

    let webhooks: Array<{ name: string; channel: string; url: string }>;
    try {
      webhooks = JSON.parse(setting.value);
    } catch {
      return { error: '推送配置数据异常，请在系统设置→推送管理中重新配置。' };
    }

    const target = webhooks.find(w => w.name === name);
    if (!target) {
      const available = webhooks.map(w => w.name).join('、');
      return {
        error: `未找到昵称为"${name}"的推送目标。已配置的昵称：${available || '无'}。请在系统设置→推送管理中添加或确认昵称。`,
      };
    }

    try {
      const result = await notificationService.sendWebhook(target.channel, { title, content }, target.url);
      if (result.skipped) {
        return { error: `${target.channel} Webhook URL 无效，请在系统设置→推送管理中检查配置。` };
      }
      return {
        success: true,
        message: `消息已推送到"${name}"（${target.channel}）`,
        target: name,
        channel: target.channel,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '推送失败';
      return { error: `推送到"${name}"失败: ${msg}` };
    }
  },
};
