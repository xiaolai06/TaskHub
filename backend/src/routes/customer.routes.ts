import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import { createCustomerSchema, updateCustomerSchema } from '../validators/customer.schema';
import * as customerService from '../services/customer.service';
import { success, error } from '../utils/response';

const router = Router();

// GET / - 客户列表（支持搜索、状态筛选、时间范围筛选）
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
    const result = await customerService.findAll(req.userId!, { page, limit, search, status, startDate, endDate });
    success(res, result);
  } catch (err) {
    next(err);
  }
});

// POST / - 创建客户
router.post('/', validate(createCustomerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customer = await customerService.create(req.userId!, req.body);
    success(res, customer, undefined, 201);
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === 'P2003') {
      error(res, 'FOREIGN_KEY_ERROR', '关联数据不存在', 400);
      return;
    }
    next(err);
  }
});

// GET /:id - 客户详情（含关联项目和最近沟通记录）
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const customer = await customerService.findById(req.userId!, id);
    if (!customer) {
      error(res, 'NOT_FOUND', '客户不存在', 404);
      return;
    }
    success(res, customer);
  } catch (err) {
    next(err);
  }
});

// PUT /:id - 更新客户
router.put('/:id', validate(updateCustomerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const customer = await customerService.update(req.userId!, id, req.body);
    if (!customer) {
      error(res, 'NOT_FOUND', '客户不存在', 404);
      return;
    }
    success(res, customer);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - 删除客户
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const result = await customerService.remove(req.userId!, id);
    if (!result.deleted) {
      error(res, 'NOT_FOUND', '客户不存在', 404);
      return;
    }
    success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
