import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import { createPaymentSchema } from '../validators/payment.schema';
import * as paymentService from '../services/payment.service';
import { success } from '../utils/response';

const router = Router();

// GET /api/payments — 列表
router.get('/', async (req: Request, res: Response, next) => {
  try {
    const result = await paymentService.findAll(req.userId!, req.query as Record<string, string>);
    success(res, result);
  } catch (err) { next(err); }
});

// POST /api/payments — 录入回款（同时创建 Transaction）
router.post('/', validate(createPaymentSchema), async (req: Request, res: Response, next) => {
  try {
    const data = await paymentService.create(req.userId!, req.body);
    success(res, data, '回款录入成功', 201);
  } catch (err) { next(err); }
});

// GET /api/payments/receivables — 应收账款汇总
router.get('/receivables', async (req: Request, res: Response, next) => {
  try {
    const data = await paymentService.getReceivables(req.userId!);
    success(res, data);
  } catch (err) { next(err); }
});

// GET /api/payments/aging — 账龄分析
router.get('/aging', async (req: Request, res: Response, next) => {
  try {
    const data = await paymentService.getAgingAnalysis(req.userId!);
    success(res, data);
  } catch (err) { next(err); }
});

export default router;
