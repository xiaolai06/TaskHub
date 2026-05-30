import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import { createTaskSchema, updateTaskSchema, updateTaskStatusSchema, taskQuerySchema } from '../validators/task.schema';
import * as taskService from '../services/task.service';
import { success, error } from '../utils/response';

const router = Router();

// GET / - 任务列表（支持筛选 + 排序）
router.get('/', async (req: Request, res: Response) => {
  try {
    const parsed = taskQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      error(res, 'INVALID_PARAMS', '参数格式错误', 400);
      return;
    }
    const result = await taskService.findAll(req.userId!, parsed.data);
    success(res, result);
  } catch (err) {
    console.error('获取任务列表失败:', err);
    error(res, 'INTERNAL_ERROR', '获取任务列表失败', 500);
  }
});

// GET /project/:projectId - 获取项目下所有任务
router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params.projectId);
    const tasks = await taskService.getByProject(req.userId!, projectId);
    success(res, tasks);
  } catch (err) {
    console.error('获取项目任务失败:', err);
    error(res, 'INTERNAL_ERROR', '获取项目任务失败', 500);
  }
});

// POST / - 创建任务
router.post('/', validate(createTaskSchema), async (req: Request, res: Response) => {
  try {
    const task = await taskService.create(req.userId!, req.body);
    if (!task) {
      error(res, 'NOT_FOUND', '项目不存在', 404);
      return;
    }
    success(res, task, undefined, 201);
  } catch (err) {
    console.error('创建任务失败:', err);
    error(res, 'INTERNAL_ERROR', '创建任务失败', 500);
  }
});

// GET /:id - 任务详情
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const task = await taskService.findById(req.userId!, id);
    if (!task) {
      error(res, 'NOT_FOUND', '任务不存在', 404);
      return;
    }
    success(res, task);
  } catch (err) {
    console.error('获取任务详情失败:', err);
    error(res, 'INTERNAL_ERROR', '获取任务详情失败', 500);
  }
});

// PUT /:id - 更新任务
router.put('/:id', validate(updateTaskSchema), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const task = await taskService.update(req.userId!, id, req.body);
    if (!task) {
      error(res, 'NOT_FOUND', '任务不存在', 404);
      return;
    }
    success(res, task);
  } catch (err) {
    console.error('更新任务失败:', err);
    error(res, 'INTERNAL_ERROR', '更新任务失败', 500);
  }
});

// PATCH /:id/status - 更新任务状态
router.patch('/:id/status', validate(updateTaskStatusSchema), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const task = await taskService.updateStatus(req.userId!, id, req.body.status, req.body.blockedReason);
    if (!task) {
      error(res, 'NOT_FOUND', '任务不存在', 404);
      return;
    }
    success(res, task);
  } catch (err) {
    console.error('更新任务状态失败:', err);
    error(res, 'INTERNAL_ERROR', '更新任务状态失败', 500);
  }
});

// DELETE /:id - 删除任务
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const result = await taskService.remove(req.userId!, id);
    if (!result) {
      error(res, 'NOT_FOUND', '任务不存在', 404);
      return;
    }
    success(res, result);
  } catch (err) {
    console.error('删除任务失败:', err);
    error(res, 'INTERNAL_ERROR', '删除任务失败', 500);
  }
});

export default router;
