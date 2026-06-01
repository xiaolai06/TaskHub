import { Router, Request, Response, NextFunction } from 'express';
import * as reportService from '../services/report.service';
import { success } from '../utils/response';

const router = Router();

function getParams(req: Request) {
  return {
    period: typeof req.query.period === 'string' ? req.query.period : undefined,
    type: typeof req.query.type === 'string' ? req.query.type : 'month',
  };
}

router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period, type } = getParams(req);
    const data = await reportService.getOverview(req.userId!, period, type);
    success(res, data);
  } catch (err) { next(err); }
});

router.get('/project-ranking', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period, type } = getParams(req);
    const data = await reportService.getProjectRanking(req.userId!, period, type);
    success(res, data);
  } catch (err) { next(err); }
});

router.get('/cost-structure', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period, type } = getParams(req);
    const data = await reportService.getCostStructure(req.userId!, period, type);
    success(res, data);
  } catch (err) { next(err); }
});

router.get('/time-analysis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period, type } = getParams(req);
    const data = await reportService.getTimeAnalysis(req.userId!, period, type);
    success(res, data);
  } catch (err) { next(err); }
});

export default router;
