import { Router, Request, Response } from 'express';
import * as costService from '../services/cost.service';
import { success } from '../utils/response';
import { validate } from '../middleware/validate';
import { createCostSchema, costQuerySchema } from '../validators/cost.schema';

const router = Router();

router.get('/project/:projectId', async (req: Request, res: Response, next) => {
  try {
    const queryResult = costQuerySchema.safeParse(req.query);
    const filters = queryResult.success ? queryResult.data : {};
    const result = await costService.findAll(req.userId!, String(req.params.projectId), filters);
    success(res, result);
  } catch (err) { next(err); }
});

router.get('/project/:projectId/summary', async (req: Request, res: Response, next) => {
  try { const result = await costService.getSummaryByProject(req.userId!, String(req.params.projectId)); success(res, result); }
  catch (err) { next(err); }
});

router.post('/project/:projectId', validate(createCostSchema), async (req: Request, res: Response, next) => {
  try { const result = await costService.create(req.userId!, String(req.params.projectId), req.body); success(res, result, '创建成功', 201); }
  catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next) => {
  try { await costService.remove(req.userId!, String(req.params.id)); success(res, null, '删除成功'); }
  catch (err) { next(err); }
});

router.get('/summary', async (req: Request, res: Response, next) => {
  try {
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const result = await costService.getMonthlySummary(req.userId!, month);
    success(res, result);
  } catch (err) { next(err); }
});

export default router;
