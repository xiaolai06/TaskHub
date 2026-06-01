import { Router, Request, Response } from 'express';
import { prisma } from '../server';
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

router.post('/test-email', async (req: Request, res: Response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { email: true },
    });
    if (!user?.email) {
      success(res, null, '当前账号没有可用邮箱');
      return;
    }
    await notificationService.sendTestEmail(user.email, req.userId!);
    success(res, { email: user.email }, '测试邮件已发送');
  } catch (err) { next(err); }
});

router.patch('/:id/read', async (req: Request, res: Response, next) => {
  try {
    const data = await notificationService.markAsRead(req.userId!, String(req.params.id));
    success(res, data);
  } catch (err) { next(err); }
});

router.patch('/read-all', async (req: Request, res: Response, next) => {
  try {
    const result = await notificationService.markAllAsRead(req.userId!);
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
