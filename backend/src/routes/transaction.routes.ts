import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import { createTransactionSchema, updateTransactionSchema } from '../validators/transaction.schema';
import * as transactionService from '../services/transaction.service';
import { success } from '../utils/response';

const router = Router();

// GET /api/transactions — 列表（支持分页、筛选、搜索）
router.get('/', async (req: Request, res: Response, next) => {
  try {
    const result = await transactionService.findAll(req.userId!, req.query as Record<string, string>);
    success(res, result);
  } catch (err) { next(err); }
});

// POST /api/transactions — 手动记账
router.post('/', validate(createTransactionSchema), async (req: Request, res: Response, next) => {
  try {
    const data = await transactionService.create(req.userId!, req.body);
    success(res, data, '记账成功', 201);
  } catch (err) { next(err); }
});

// PUT /api/transactions/:id — 编辑（仅手动记录）
router.put('/:id', validate(updateTransactionSchema), async (req: Request, res: Response, next) => {
  try {
    const data = await transactionService.update(req.userId!, String(req.params.id), req.body);
    success(res, data, '更新成功');
  } catch (err) { next(err); }
});

// DELETE /api/transactions/:id — 删除（仅手动记录）
router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    await transactionService.remove(req.userId!, String(req.params.id));
    success(res, null, '删除成功');
  } catch (err) { next(err); }
});

export default router;
