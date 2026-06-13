import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import { financeSummarySchema } from '../validators/finance.schema';
import * as financeService from '../services/finance.service';
import { success } from '../utils/response';

const router = Router();

// GET /api/finance/summary — 统一财务汇总
router.get('/summary', validate(financeSummarySchema, 'query'), async (req: Request, res: Response, next) => {
  try {
    const { period, type } = (req.query as { period?: string; type?: string }) || {};
    const data = await financeService.getFinancialSummary(req.userId!, period, (type as 'day' | 'month' | 'year') || 'month');
    success(res, data);
  } catch (err) { next(err); }
});

// GET /api/finance/trends — 趋势数据
router.get('/trends', async (req: Request, res: Response, next) => {
  try {
    const months = req.query.months ? Number(req.query.months) : 6;
    const data = await financeService.getFinancialTrends(req.userId!, months);
    success(res, data);
  } catch (err) { next(err); }
});

// GET /api/finance/comparison — 同比/环比
router.get('/comparison', async (req: Request, res: Response, next) => {
  try {
    const { period, type } = req.query as { period?: string; type?: string };
    const data = await financeService.getComparison(req.userId!, period, (type as 'day' | 'month' | 'year') || 'month');
    success(res, data);
  } catch (err) { next(err); }
});

export default router;
