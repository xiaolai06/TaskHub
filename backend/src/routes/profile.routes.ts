import { Router, Request, Response } from 'express';
import * as profileService from '../services/profile.service';
import { success, error } from '../utils/response';

const router = Router();

// GET / - 获取个人资料
router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await profileService.getProfile(req.userId!);
    success(res, data);
  } catch (err) {
    console.error('获取个人资料失败:', err);
    error(res, 'INTERNAL_ERROR', '获取个人资料失败', 500);
  }
});

// PUT / - 更新个人资料
router.put('/', async (req: Request, res: Response) => {
  try {
    const profile = await profileService.updateProfile(req.userId!, req.body);
    success(res, profile);
  } catch (err) {
    console.error('更新个人资料失败:', err);
    error(res, 'INTERNAL_ERROR', '更新个人资料失败', 500);
  }
});

export default router;
