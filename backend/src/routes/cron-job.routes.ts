import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import { createCronJobSchema, updateCronJobSchema } from '../validators/cron-job.schema';
import * as cronJobService from '../services/cron-job.service';
import { success } from '../utils/response';

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

export default router;
