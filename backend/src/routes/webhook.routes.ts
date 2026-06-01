import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as notificationService from '../services/notification.service';
import { config } from '../config';
import { success, error } from '../utils/response';

const router = Router();

const notificationTypeSchema = z.enum(['TASK_DUE', 'COST_ALERT', 'PROJECT_CHANGE', 'AI_INSIGHT', 'AI_REPORT', 'SYSTEM']);

// ======================== n8n Webhook 回调 ========================

// POST /incoming - 接收 n8n 工作流回调
const n8nCallbackSchema = z.object({
  workflowId: z.string().min(1, '工作流 ID 不能为空'),
  data: z.record(z.unknown()),
  status: z.enum(['success', 'error']),
  message: z.string().optional(),
});

router.post('/incoming', async (req: Request, res: Response) => {
  const secret = req.headers['x-webhook-secret'];
  if (config.n8n.webhookSecret && secret !== config.n8n.webhookSecret) {
    error(res, 'FORBIDDEN', 'Webhook 密钥无效', 403);
    return;
  }

  try {
    const body = n8nCallbackSchema.parse(req.body);

    console.log(`n8n callback: workflow=${body.workflowId} status=${body.status}`);

    switch (body.workflowId) {
      case 'daily-digest':
      case 'weekly-report':
        if (body.status === 'success' && body.data.title && body.data.content) {
          await notificationService.createFromN8n({
            userId: String(body.data.userId || 'system'),
            type: 'AI_REPORT',
            title: String(body.data.title),
            content: String(body.data.content),
          });
        }
        break;

      case 'overdue-alert':
      case 'cost-alert':
        if (body.status === 'success' && body.data.title && body.data.content) {
          await notificationService.createFromN8n({
            userId: String(body.data.userId || 'system'),
            type: body.workflowId === 'cost-alert' ? 'COST_ALERT' : 'TASK_DUE',
            title: String(body.data.title),
            content: String(body.data.content),
            relatedId: body.data.relatedId ? String(body.data.relatedId) : undefined,
          });
        }
        break;

      default:
        console.log(`Unknown workflow: ${body.workflowId}`);
    }

    if (body.status === 'success' && body.data.notify) {
      const channels = ['wechat', 'feishu', 'dingtalk', 'slack'];
      for (const channel of channels) {
        await notificationService.sendWebhook(channel, {
          title: body.data.title,
          content: body.data.content,
        });
      }
    }

    success(res, { received: true }, '回调处理完成');
  } catch (err) {
    if (err instanceof z.ZodError) {
      error(res, 'VALIDATION_ERROR', '回调数据格式错误', 400, err.errors);
      return;
    }
    console.error('n8n callback failed:', err);
    error(res, 'INTERNAL_ERROR', '回调处理失败', 500);
  }
});

// POST /notify - 通用通知推送（n8n 直接调用）
const notifySchema = z.object({
  userId: z.string().min(1),
  type: notificationTypeSchema,
  title: z.string().min(1),
  content: z.string().min(1),
  relatedId: z.string().optional(),
  channels: z.array(z.string()).optional(),
});

router.post('/notify', async (req: Request, res: Response) => {
  const secret = req.headers['x-webhook-secret'];
  if (config.n8n.webhookSecret && secret !== config.n8n.webhookSecret) {
    error(res, 'FORBIDDEN', 'Webhook 密钥无效', 403);
    return;
  }

  try {
    const body = notifySchema.parse(req.body) as notificationService.N8nNotificationPayload & { channels?: string[] };

    const notification = await notificationService.createFromN8n({
      userId: body.userId,
      type: body.type,
      title: body.title,
      content: body.content,
      relatedId: body.relatedId,
    });

    if (body.channels?.length) {
      for (const channel of body.channels) {
        await notificationService.sendWebhook(channel, {
          title: body.title,
          content: body.content,
        });
      }
    }

    success(res, notification, '通知创建成功', 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      error(res, 'VALIDATION_ERROR', '通知数据格式错误', 400, err.errors);
      return;
    }
    console.error('notification webhook failed:', err);
    error(res, 'INTERNAL_ERROR', '通知创建失败', 500);
  }
});

export default router;
