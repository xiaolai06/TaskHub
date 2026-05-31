import { Router } from 'express';
import * as schedulerService from '../services/scheduler.service';
import { success } from '../utils/response';

const router = Router();

// GET /project/:projectId - 项目排期视图
router.get('/project/:projectId', async (req, res, next) => {
  try {
    const result = await schedulerService.getSchedule(req.params.projectId);
    success(res, result);
  } catch (err) { next(err); }
});

// POST /suggest - AI 排期建议
router.post('/suggest', async (req, res, next) => {
  try {
    const { projectId } = req.body;
    const result = await schedulerService.suggestSchedule(projectId);
    success(res, result);
  } catch (err) { next(err); }
});

// GET /conflicts - 检测排期冲突
router.get('/conflicts/:projectId', async (req, res, next) => {
  try {
    const result = await schedulerService.detectConflicts(req.params.projectId);
    success(res, result);
  } catch (err) { next(err); }
});

export default router;
