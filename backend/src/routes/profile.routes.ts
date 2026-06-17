import { Router, Request, Response, NextFunction } from 'express';
import * as profileService from '../services/profile.service';
import { success } from '../utils/response';
import { validate } from '../middleware/validate';
import { updateProfileSchema } from '../validators/profile.schema';

const router = Router();

// GET / - 获取个人资料
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await profileService.getProfile(req.userId!);
    success(res, data);
  } catch (err) {
    next(err);
  }
});

// PUT / - 更新个人资料
router.put('/', validate(updateProfileSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await profileService.updateProfile(req.userId!, req.body);
    success(res, profile);
  } catch (err) {
    next(err);
  }
});

export default router;
