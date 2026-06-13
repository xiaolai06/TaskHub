import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import { createSubscriptionSchema, updateSubscriptionSchema } from '../validators/subscription.schema';
import * as subscriptionService from '../services/subscription.service';
import { success } from '../utils/response';

const router = Router();

// GET /api/subscriptions — 列表
router.get('/', async (req: Request, res: Response, next) => {
  try {
    const result = await subscriptionService.findAll(req.userId!, req.query as Record<string, string>);
    success(res, result);
  } catch (err) { next(err); }
});

// POST /api/subscriptions — 添加订阅
router.post('/', validate(createSubscriptionSchema), async (req: Request, res: Response, next) => {
  try {
    const data = await subscriptionService.create(req.userId!, req.body);
    success(res, data, '订阅添加成功', 201);
  } catch (err) { next(err); }
});

// PUT /api/subscriptions/:id — 编辑
router.put('/:id', validate(updateSubscriptionSchema), async (req: Request, res: Response, next) => {
  try {
    const data = await subscriptionService.update(req.userId!, String(req.params.id), req.body);
    success(res, data, '更新成功');
  } catch (err) { next(err); }
});

// PUT /api/subscriptions/:id/pause — 暂停
router.put('/:id/pause', async (req: Request, res: Response, next) => {
  try {
    const data = await subscriptionService.pause(req.userId!, String(req.params.id));
    success(res, data, '已暂停');
  } catch (err) { next(err); }
});

// PUT /api/subscriptions/:id/resume — 恢复
router.put('/:id/resume', async (req: Request, res: Response, next) => {
  try {
    const data = await subscriptionService.resume(req.userId!, String(req.params.id));
    success(res, data, '已恢复');
  } catch (err) { next(err); }
});

// DELETE /api/subscriptions/:id — 删除
router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    await subscriptionService.remove(req.userId!, String(req.params.id));
    success(res, null, '删除成功');
  } catch (err) { next(err); }
});

// GET /api/subscriptions/cost-summary — 月度成本汇总
router.get('/cost-summary', async (req: Request, res: Response, next) => {
  try {
    const data = await subscriptionService.getCostSummary(req.userId!);
    success(res, data);
  } catch (err) { next(err); }
});

export default router;
