import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import { createCronJobSchema, updateCronJobSchema } from '../validators/cron-job.schema';
import * as cronJobService from '../services/cron-job.service';
import * as notificationService from '../services/notification.service';
import { prisma } from '../server';
import { success, error } from '../utils/response';

const router = Router();

// GET / — 定时任务列表（自动初始化）
router.get('/', async (req: Request, res: Response, next) => {
  try {
    // 确保系统预置任务存在
    await cronJobService.ensureSystemJobs(req.userId!);
    // 读取列表
    const enabled = req.query.enabled === 'true' ? true : req.query.enabled === 'false' ? false : undefined;
    const data = await cronJobService.findAll(req.userId!, { enabled });
    success(res, data);
  } catch (err) { next(err); }
});

// POST /system/init — 手动初始化
router.post('/system/init', async (req: Request, res: Response, next) => {
  try {
    const result = await cronJobService.ensureSystemJobs(req.userId!);
    success(res, result, `已初始化 ${result.created} 个系统任务`);
  } catch (err) { next(err); }
});

// GET /:id
router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const data = await cronJobService.findById(req.userId!, String(req.params.id));
    success(res, data);
  } catch (err) { next(err); }
});

// POST / — 创建
router.post('/', validate(createCronJobSchema), async (req: Request, res: Response, next) => {
  try {
    const data = await cronJobService.create(req.userId!, req.body);
    success(res, data, '创建成功', 201);
  } catch (err) { next(err); }
});

// PUT /:id — 更新
router.put('/:id', validate(updateCronJobSchema), async (req: Request, res: Response, next) => {
  try {
    const data = await cronJobService.update(req.userId!, String(req.params.id), req.body);
    success(res, data, '更新成功');
  } catch (err) { next(err); }
});

// DELETE /:id
router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    await cronJobService.remove(req.userId!, String(req.params.id));
    success(res, null, '已删除');
  } catch (err) { next(err); }
});

// POST /:id/test-notify — 测试已配置的通知渠道
router.post('/:id/test-notify', async (req: Request, res: Response, next) => {
  try {
    const job = await cronJobService.findById(req.userId!, String(req.params.id));
    const config = JSON.parse(job.config || '{}');
    const webhookTargets: string[] = config.webhookTargets || [];
    const results: { channel: string; ok: boolean; msg: string }[] = [];

    // 1. 邮件（仅用户勾选了才测）
    if (config.emailEnabled) {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { email: true } });
        if (!user?.email) {
          results.push({ channel: '邮件', ok: false, msg: '未设置邮箱，请在个人资料中填写' });
        } else {
          const smtp = await prisma.setting.findMany({
            where: { category: 'EMAIL', OR: [{ userId: 'system' }, { userId: req.userId! }] },
          });
          const hasHost = smtp.some(s => ['host', 'smtp_host'].includes(s.key.toLowerCase()));
          const hasPass = smtp.some(s => ['pass', 'password', 'smtp_pass'].includes(s.key.toLowerCase()));
          if (!hasHost || !hasPass) {
            results.push({ channel: '邮件', ok: false, msg: 'SMTP 未配置，请在系统设置→邮件中填写' });
          } else {
            await notificationService.sendTestEmail(user.email, req.userId!);
            results.push({ channel: '邮件', ok: true, msg: `已发送至 ${user.email}` });
          }
        }
      } catch (err) {
        results.push({ channel: '邮件', ok: false, msg: err instanceof Error ? err.message : '发送失败' });
      }
    }

    // 2. Webhook（仅用户勾选的才测，没勾选就跳过）
    if (webhookTargets.length > 0) {
      const setting = await prisma.setting.findFirst({ where: { category: 'NOTIFY', key: 'webhooks' } });
      const allWH: Array<{ name: string; channel: string; url: string }> = setting?.value ? JSON.parse(setting.value) : [];
      for (const targetName of webhookTargets) {
        const wh = allWH.find(w => w.name === targetName);
        if (!wh) {
          results.push({ channel: targetName, ok: false, msg: '目标不存在，请重新配置' });
          continue;
        }
        try {
          const r = await notificationService.sendWebhook(wh.channel, {
            title: `测试: ${job.name}`,
            content: `这是「${job.name}」的推送测试。`,
          }, wh.url);
          results.push({ channel: wh.name, ok: !!r.sent, msg: r.sent ? '推送成功' : '未发送（URL 无效）' });
        } catch (err) {
          results.push({ channel: wh.name, ok: false, msg: err instanceof Error ? err.message : '推送失败' });
        }
      }
    }

    // 没配置任何渠道
    if (results.length === 0) {
      error(res, 'NO_CHANNEL', '未配置通知渠道，请先勾选邮件或推送目标', 400);
      return;
    }

    const allOk = results.every(r => r.ok);
    success(res, { results, allOk }, allOk ? '全部通过' : '部分失败');
  } catch (err) { next(err); }
});

export default router;
