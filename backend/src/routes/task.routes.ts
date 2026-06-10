import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import { createTaskSchema, updateTaskSchema, updateTaskStatusSchema, taskQuerySchema } from '../validators/task.schema';
import * as taskService from '../services/task.service';
import { success, error } from '../utils/response';
import { prisma } from '../server';

const router = Router();

// GET / - 任务列表（支持筛选 + 排序）
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = taskQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      error(res, 'INVALID_PARAMS', '参数格式错误', 400);
      return;
    }
    const result = await taskService.findAll(req.userId!, parsed.data);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

// GET /project/:projectId - 获取项目下所有任务
router.get('/project/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = String(req.params.projectId);
    const tasks = await taskService.getByProject(req.userId!, projectId);
    success(res, tasks);
  } catch (err) {
    next(err);
  }
});

// GET /stats - 任务统计聚合（SmartDigest 用）
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const now = new Date();
    const [todoCount, overdueCount] = await Promise.all([
      prisma.task.count({ where: { project: { ownerId: userId }, status: { in: ['TODO', 'IN_PROGRESS'] } } }),
      prisma.task.count({ where: { project: { ownerId: userId }, status: { not: 'DONE' }, dueDate: { lt: now } } }),
    ]);
    success(res, { todoCount, overdueCount });
  } catch (err) { next(err); }
});

// POST / - 创建任务
router.post('/', validate(createTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await taskService.create(req.userId!, req.body);
    if (!task) {
      error(res, 'NOT_FOUND', '项目不存在', 404);
      return;
    }
    success(res, task, undefined, 201);
  } catch (err) {
    next(err);
  }
});

// GET /:id - 任务详情
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const task = await taskService.findById(req.userId!, id);
    if (!task) {
      error(res, 'NOT_FOUND', '任务不存在', 404);
      return;
    }
    success(res, task);
  } catch (err) {
    next(err);
  }
});

// PUT /:id - 更新任务
router.put('/:id', validate(updateTaskSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const task = await taskService.update(req.userId!, id, req.body);
    if (!task) {
      error(res, 'NOT_FOUND', '任务不存在', 404);
      return;
    }
    success(res, task);
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/status - 更新任务状态
router.patch('/:id/status', validate(updateTaskStatusSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const task = await taskService.updateStatus(req.userId!, id, req.body.status, req.body.blockedReason);
    if (!task) {
      error(res, 'NOT_FOUND', '任务不存在', 404);
      return;
    }
    success(res, task);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - 删除任务
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const result = await taskService.remove(req.userId!, id);
    if (!result) {
      error(res, 'NOT_FOUND', '任务不存在', 404);
      return;
    }
    success(res, result);
  } catch (err) {
    next(err);
  }
});

export default router;
