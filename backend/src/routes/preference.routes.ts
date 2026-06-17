import { Router, Request, Response, NextFunction } from 'express';
import * as preferenceService from '../services/preference.service';
import { success } from '../utils/response';
import { validate } from '../middleware/validate';
import { updatePreferenceSchema } from '../validators/preference.schema';

const router = Router();

// GET / - 获取偏好设置
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const preferences = await preferenceService.getPreferences(req.userId!);
    success(res, preferences);
  } catch (err) {
    next(err);
  }
});

// PUT / - 更新偏好设置
router.put('/', validate(updatePreferenceSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const preferences = await preferenceService.updatePreferences(req.userId!, req.body);
    success(res, preferences);
  } catch (err) {
    next(err);
  }
});

export default router;
