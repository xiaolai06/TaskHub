import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import { createProjectSchema, updateProjectSchema } from '../validators/project.schema';
import * as projectService from '../services/project.service';
import { success, error } from '../utils/response';

const router = Router();

// GET / - 项目列表
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
    const result = await projectService.findAll(req.userId!, { page, limit, status, startDate, endDate });
    success(res, result);
  } catch (err) {
    next(err);
  }
});

// POST / - 创建项目
router.post('/', validate(createProjectSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await projectService.create(req.userId!, req.body);
    success(res, project, undefined, 201);
  } catch (err) {
    next(err);
  }
});

// GET /:id - 项目详情
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const project = await projectService.findById(req.userId!, id);
    if (!project) {
      error(res, 'NOT_FOUND', '项目不存在', 404);
      return;
    }
    success(res, project);
  } catch (err) {
    next(err);
  }
});

// PUT /:id - 更新项目
router.put('/:id', validate(updateProjectSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const project = await projectService.update(req.userId!, id, req.body);
    if (!project) {
      error(res, 'NOT_FOUND', '项目不存在', 404);
      return;
    }
    success(res, project);
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/archive - 一键归档
router.patch('/:id/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const project = await projectService.archive(req.userId!, id);
    if (!project) {
      error(res, 'NOT_FOUND', '项目不存在', 404);
      return;
    }
    success(res, project);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - 删除项目
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    await projectService.remove(req.userId!, id);
    success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
