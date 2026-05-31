import { Router, Request, Response } from 'express';
import * as preferenceService from '../services/preference.service';
import { success, error } from '../utils/response';

const router = Router();

// GET / - 获取偏好设置
router.get('/', async (req: Request, res: Response) => {
  try {
    const preferences = await preferenceService.getPreferences(req.userId!);
    success(res, preferences);
  } catch (err) {
    console.error('获取偏好设置失败:', err);
    error(res, 'INTERNAL_ERROR', '获取偏好设置失败', 500);
  }
});

// PUT / - 更新偏好设置
router.put('/', async (req: Request, res: Response) => {
  try {
    const preferences = await preferenceService.updatePreferences(req.userId!, req.body);
    success(res, preferences);
  } catch (err) {
    console.error('更新偏好设置失败:', err);
    error(res, 'INTERNAL_ERROR', '更新偏好设置失败', 500);
  }
});

export default router;
