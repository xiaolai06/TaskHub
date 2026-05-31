import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import {
  createGoalSchema,
  updateGoalSchema,
  updateProgressSchema,
  createProgressLogSchema,
  createMilestoneSchema,
  updateMilestoneSchema,
} from '../validators/goal.schema';
import * as goalService from '../services/goal.service';
import { success, error } from '../utils/response';
import { AppError } from '../utils/errors';

const router = Router();

// ======================== 目标 CRUD ========================

// GET / - 目标列表
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const result = await goalService.findAll(req.userId!, { page, limit, status, type });
    success(res, result);
  } catch (err) { next(err); }
});

// GET /overview - 目标总览（看板数据）
router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await goalService.getOverview(req.userId!);
    success(res, data);
  } catch (err) { next(err); }
});

// GET /projects - 获取用户项目列表（用于目标关联）
router.get('/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await goalService.getUserProjects(req.userId!);
    success(res, data);
  } catch (err) { next(err); }
});

// GET /customers - 获取用户客户列表（用于目标关联）
router.get('/customers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await goalService.getUserCustomers(req.userId!);
    success(res, data);
  } catch (err) { next(err); }
});

// POST / - 创建目标
router.post('/', validate(createGoalSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await goalService.create(req.userId!, req.body);
    success(res, data, '目标创建成功', 201);
  } catch (err) { next(err); }
});

// GET /:id - 目标详情
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await goalService.findById(req.userId!, String(req.params.id));
    success(res, data);
  } catch (err) {
    if (err instanceof AppError) {
      error(res, err.code, err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

// PUT /:id - 更新目标
router.put('/:id', validate(updateGoalSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await goalService.update(req.userId!, String(req.params.id), req.body);
    success(res, data, '目标更新成功');
  } catch (err) {
    if (err instanceof AppError) {
      error(res, err.code, err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

// DELETE /:id - 删除目标
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await goalService.remove(req.userId!, String(req.params.id));
    success(res, null, '目标删除成功');
  } catch (err) {
    if (err instanceof AppError) {
      error(res, err.code, err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

// PATCH /:id/progress - 手动更新进度
router.patch('/:id/progress', validate(updateProgressSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await goalService.updateProgress(req.userId!, String(req.params.id), req.body);
    success(res, data, '进度更新成功');
  } catch (err) {
    if (err instanceof AppError) {
      error(res, err.code, err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

// POST /:id/calculate - 自动计算进度
router.post('/:id/calculate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await goalService.calculateAutoProgress(req.userId!, String(req.params.id));
    success(res, result, result.message);
  } catch (err) {
    if (err instanceof AppError) {
      error(res, err.code, err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

// ======================== 进度日记管理 ========================

// GET /:id/logs - 获取进度日记列表
router.get('/:id/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await goalService.getProgressLogs(req.userId!, String(req.params.id));
    success(res, data);
  } catch (err) {
    if (err instanceof AppError) {
      error(res, err.code, err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

// POST /:id/logs - 添加进度日记
router.post('/:id/logs', validate(createProgressLogSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await goalService.addProgressLog(req.userId!, String(req.params.id), req.body);
    success(res, data, '进度记录成功', 201);
  } catch (err) {
    if (err instanceof AppError) {
      error(res, err.code, err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

// DELETE /:id/logs/:logId - 删除进度日记
router.delete('/:id/logs/:logId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await goalService.deleteProgressLog(
      req.userId!,
      String(req.params.id),
      String(req.params.logId),
    );
    success(res, data, '进度记录已删除');
  } catch (err) {
    if (err instanceof AppError) {
      error(res, err.code, err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

// ======================== 里程碑管理 ========================

// GET /:id/milestones - 获取里程碑列表
router.get('/:id/milestones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await goalService.getMilestones(req.userId!, String(req.params.id));
    success(res, data);
  } catch (err) {
    if (err instanceof AppError) {
      error(res, err.code, err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

// POST /:id/milestones - 添加里程碑
router.post('/:id/milestones', validate(createMilestoneSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await goalService.createMilestone(req.userId!, String(req.params.id), req.body);
    success(res, data, '里程碑添加成功', 201);
  } catch (err) {
    if (err instanceof AppError) {
      error(res, err.code, err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

// PATCH /:id/milestones/:milestoneId - 更新里程碑状态
router.patch('/:id/milestones/:milestoneId', validate(updateMilestoneSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await goalService.updateMilestone(
      req.userId!,
      String(req.params.id),
      String(req.params.milestoneId),
      req.body,
    );
    success(res, data, '里程碑更新成功');
  } catch (err) {
    if (err instanceof AppError) {
      error(res, err.code, err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

// DELETE /:id/milestones/:milestoneId - 删除里程碑
router.delete('/:id/milestones/:milestoneId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await goalService.deleteMilestone(req.userId!, String(req.params.id), String(req.params.milestoneId));
    success(res, null, '里程碑删除成功');
  } catch (err) {
    if (err instanceof AppError) {
      error(res, err.code, err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

export default router;
