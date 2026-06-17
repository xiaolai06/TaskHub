import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import { createCronJobSchema, updateCronJobSchema } from '../validators/cron-job.schema';
import * as cronJobService from '../services/cron-job.service';
import * as notificationService from '../services/notification.service';
import { executeCustomJob, testCustomJob, refreshCustomJobs } from '../jobs/custom-job.executor';
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

// GET /history — 全部执行历史
router.get('/history', async (req: Request, res: Response, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const data = await cronJobService.getAllExecutionHistory(req.userId!, limit);
    success(res, data);
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
    await refreshCustomJobs();
    success(res, data, '创建成功', 201);
  } catch (err) { next(err); }
});

// GET /:id/history — 执行历史
router.get('/:id/history', async (req: Request, res: Response, next) => {
  try {
    const job = await cronJobService.findById(req.userId!, String(req.params.id));
    if (!job.jobSlug) { success(res, []); return; }
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const history = await cronJobService.getExecutionHistory(job.jobSlug, req.userId!, limit);
    success(res, history);
  } catch (err) { next(err); }
});

// PUT /:id — 更新
router.put('/:id', validate(updateCronJobSchema), async (req: Request, res: Response, next) => {
  try {
    const data = await cronJobService.update(req.userId!, String(req.params.id), req.body);
    await refreshCustomJobs();
    const msg = data.isSystem ? '已保存，重启服务后生效' : '更新成功';
    success(res, data, msg);
  } catch (err) { next(err); }
});

// DELETE /:id
router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    await cronJobService.remove(req.userId!, String(req.params.id));
    await refreshCustomJobs();
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
        const email = await notificationService.getUserEmail(req.userId!);
        if (!email) {
          results.push({ channel: '邮件', ok: false, msg: '未设置邮箱，请在个人资料中填写' });
        } else {
          const smtpCheck = await notificationService.checkSmtpConfigured(req.userId!);
          if (!smtpCheck.configured) {
            results.push({ channel: '邮件', ok: false, msg: smtpCheck.message || 'SMTP 未配置' });
          } else {
            await notificationService.sendTestEmail(email, req.userId!);
            results.push({ channel: '邮件', ok: true, msg: `已发送至 ${email}` });
          }
        }
      } catch (err) {
        results.push({ channel: '邮件', ok: false, msg: err instanceof Error ? err.message : '发送失败' });
      }
    }

    // 2. Webhook（仅用户勾选的才测，没勾选就跳过）
    if (webhookTargets.length > 0) {
      const allWH = await notificationService.getWebhookSettings();
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

// POST /:id/run — 立即执行自定义任务
router.post('/:id/run', async (req: Request, res: Response, next) => {
  try {
    const job = await cronJobService.findById(req.userId!, String(req.params.id));
    if (job.isSystem) {
      error(res, 'FORBIDDEN', '系统任务请通过"执行"按钮触发', 400);
      return;
    }
    const start = Date.now();
    const result = await executeCustomJob(req.userId!, job);
    success(res, { result, durationMs: Date.now() - start }, '执行完成');
  } catch (err) { next(err); }
});

// POST /:id/test — 测试自定义任务（不实际发送）
router.post('/:id/test', async (req: Request, res: Response, next) => {
  try {
    const job = await cronJobService.findById(req.userId!, String(req.params.id));
    if (job.isSystem) {
      error(res, 'FORBIDDEN', '系统任务请使用"测试通知"功能', 400);
      return;
    }
    const result = await testCustomJob(req.userId!, job);
    success(res, result, '测试完成');
  } catch (err) { next(err); }
});

export default router;
