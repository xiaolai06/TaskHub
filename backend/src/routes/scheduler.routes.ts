import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import {
  calculateScheduleSchema,
  insertionSimulationSchema,
  delayQuerySchema,
  conflictQuerySchema,
} from '../validators/scheduler.schema';
import * as schedulerService from '../services/scheduler.service';
import { success } from '../utils/response';

const router = Router();

// ======================== POST /calculate - 计算排期 ========================
router.post(
  '/calculate',
  validate(calculateScheduleSchema),
  async (req: Request, res: Response, next) => {
    try {
      const result = await schedulerService.calculateSchedule(
        req.userId!,
        req.body,
      );
      success(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// ======================== POST /insertion - 插单模拟 ========================
router.post(
  '/insertion',
  validate(insertionSimulationSchema),
  async (req: Request, res: Response, next) => {
    try {
      const result = await schedulerService.insertionSimulation(
        req.userId!,
        req.body,
      );
      success(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// ======================== GET /delays/:pid - 延期任务列表 ========================
router.get(
  '/delays/:pid',
  async (req: Request, res: Response, next) => {
    try {
      const result = await schedulerService.detectDelays(
        req.userId!,
        String(req.params.pid),
      );
      success(res, result);
    } catch (err) {
      next(err);
    }
  },
);

// ======================== GET /conflicts/:pid - 冲突检测 ========================
router.get(
  '/conflicts/:pid',
  async (req: Request, res: Response, next) => {
    try {
      const raw = req.query.dailyHourLimit;
      const dailyHourLimit = raw ? Number(raw) : 8;
      const result = await schedulerService.detectConflicts(req.userId!, {
        projectId: String(req.params.pid),
        dailyHourLimit,
      });
      success(res, result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
