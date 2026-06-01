import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import { notificationFiltersSchema } from '../validators/notification.schema';
import * as notificationService from '../services/notification.service';
import { success } from '../utils/response';

const router = Router();

router.get('/', validate(notificationFiltersSchema, 'query'), async (req: Request, res: Response, next) => {
  try {
    const result = await notificationService.findAll(req.userId!, req.query as any);
    success(res, result);
  } catch (err) { next(err); }
});

router.get('/unread-count', async (req: Request, res: Response, next) => {
  try {
    const count = await notificationService.getUnreadCount(req.userId!);
    success(res, { count });
  } catch (err) { next(err); }
});

router.patch('/:id/read', async (req: Request, res: Response, next) => {
  try {
    const data = await notificationService.markAsRead(req.userId!, String(req.params.id));
    success(res, data);
  } catch (err) { next(err); }
});

router.patch('/read-all', async (_req: Request, res: Response, next) => {
  try {
    const result = await notificationService.markAllAsRead(_req.userId!);
    success(res, result);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    await notificationService.remove(req.userId!, String(req.params.id));
    success(res, null, '已删除');
  } catch (err) { next(err); }
});

export default router;
