import { Router, Request, Response } from 'express';
import * as dashboardService from '../services/dashboard.service';
import { success } from '../utils/response';

const router = Router();

/** GET /summary — 仪表盘摘要统计 */
router.get('/summary', async (req: Request, res: Response, next) => {
  try {
    const stats = await dashboardService.getStats(req.userId!);
    success(res, { stats });
  } catch (err) {
    next(err);
  }
});

/** GET /recent-activity — 最近任务活动 */
router.get('/recent-activity', async (req: Request, res: Response, next) => {
  try {
    const tasks = await dashboardService.getRecentTasks(req.userId!);
    success(res, { tasks });
  } catch (err) {
    next(err);
  }
});

/** GET /project-stats — 项目统计 */
router.get('/project-stats', async (req: Request, res: Response, next) => {
  try {
    const projects = await dashboardService.getProjectStats(req.userId!);
    success(res, { projects });
  } catch (err) {
    next(err);
  }
});

/** GET /customer-stats — 客户订单概览 */
router.get('/customer-stats', async (req: Request, res: Response, next) => {
  try {
    const customers = await dashboardService.getCustomerStats(req.userId!);
    success(res, { customers });
  } catch (err) {
    next(err);
  }
});


export default router;
