import { Router, Request, Response, NextFunction } from 'express';
import * as reportService from '../services/report.service';
import { success } from '../utils/response';

const router = Router();

function getParams(req: Request) {
  return {
    period: typeof req.query.period === 'string' ? req.query.period : undefined,
    type: typeof req.query.type === 'string' ? req.query.type : 'month',
    endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
  };
}

// ─── 原有路由 ───

router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period, type, endDate } = getParams(req);
    const data = await reportService.getOverview(req.userId!, period, type, endDate);
    success(res, data);
  } catch (err) { next(err); }
});

router.get('/project-ranking', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period, type, endDate } = getParams(req);
    const data = await reportService.getProjectRanking(req.userId!, period, type, endDate);
    success(res, data);
  } catch (err) { next(err); }
});

router.get('/cost-structure', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period, type, endDate } = getParams(req);
    const data = await reportService.getCostStructure(req.userId!, period, type, endDate);
    success(res, data);
  } catch (err) { next(err); }
});

router.get('/cost-details', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period, type, endDate } = getParams(req);
    const data = await reportService.getCostDetails(req.userId!, period, type, endDate);
    success(res, data);
  } catch (err) { next(err); }
});

router.get('/time-analysis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period, type, endDate } = getParams(req);
    const data = await reportService.getTimeAnalysis(req.userId!, period, type, endDate);
    success(res, data);
  } catch (err) { next(err); }
});

// ─── 新增：财务总览 ───

router.get('/receivables', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getReceivables(req.userId!);
    success(res, data);
  } catch (err) { next(err); }
});

router.get('/subscription-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getSubscriptionSummary(req.userId!);
    success(res, data);
  } catch (err) { next(err); }
});

// ─── 新增：项目分析 ───

router.get('/project-stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period, type, endDate } = getParams(req);
    const data = await reportService.getProjectStats(req.userId!, period, type, endDate);
    success(res, data);
  } catch (err) { next(err); }
});

router.get('/project-detail', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period, type, endDate } = getParams(req);
    const data = await reportService.getProjectDetail(req.userId!, period, type, endDate);
    success(res, data);
  } catch (err) { next(err); }
});

// ─── 新增：任务效率 ───

router.get('/task-stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period, type, endDate } = getParams(req);
    const data = await reportService.getTaskStats(req.userId!, period, type, endDate);
    success(res, data);
  } catch (err) { next(err); }
});

router.get('/overdue-tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getOverdueTasks(req.userId!);
    success(res, data);
  } catch (err) { next(err); }
});

router.get('/tasks-by-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period, type, endDate } = getParams(req);
    const data = await reportService.getTasksByStatus(req.userId!, period, type, endDate);
    success(res, data);
  } catch (err) { next(err); }
});

router.get('/tasks-by-priority', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period, type, endDate } = getParams(req);
    const data = await reportService.getTasksByPriority(req.userId!, period, type, endDate);
    success(res, data);
  } catch (err) { next(err); }
});

// ─── 新增：客户洞察 ───

router.get('/customer-ranking', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getCustomerRanking(req.userId!);
    success(res, data);
  } catch (err) { next(err); }
});

router.get('/customer-stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getCustomerStats(req.userId!);
    success(res, data);
  } catch (err) { next(err); }
});

router.get('/follow-up-reminders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getFollowUpReminders(req.userId!);
    success(res, data);
  } catch (err) { next(err); }
});

export default router;
