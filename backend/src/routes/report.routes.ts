import { Router, Request, Response } from 'express';
import * as reportService from '../services/report.service';
import { success, error } from '../utils/response';

const router = Router();

function getParams(req: Request) {
  return {
    period: typeof req.query.period === 'string' ? req.query.period : undefined,
    type: typeof req.query.type === 'string' ? req.query.type : 'month',
  };
}

router.get('/overview', async (req: Request, res: Response) => {
  try {
    const { period, type } = getParams(req);
    const data = await reportService.getOverview(req.userId!, period, type);
    success(res, data);
  } catch (err) { console.error(err); error(res, 'INTERNAL_ERROR', '获取概览失败', 500); }
});

router.get('/project-ranking', async (req: Request, res: Response) => {
  try {
    const { period, type } = getParams(req);
    const data = await reportService.getProjectRanking(req.userId!, period, type);
    success(res, data);
  } catch (err) { console.error(err); error(res, 'INTERNAL_ERROR', '获取排行失败', 500); }
});

router.get('/cost-structure', async (req: Request, res: Response) => {
  try {
    const { period, type } = getParams(req);
    const data = await reportService.getCostStructure(req.userId!, period, type);
    success(res, data);
  } catch (err) { console.error(err); error(res, 'INTERNAL_ERROR', '获取失败', 500); }
});

router.get('/time-analysis', async (req: Request, res: Response) => {
  try {
    const { period, type } = getParams(req);
    const data = await reportService.getTimeAnalysis(req.userId!, period, type);
    success(res, data);
  } catch (err) { console.error(err); error(res, 'INTERNAL_ERROR', '获取失败', 500); }
});

export default router;
