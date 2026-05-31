import { Router } from 'express';
import * as notificationService from '../services/notification.service';
import { success } from '../utils/response';

const router = Router();

// GET / - 通知列表（分页，unread 筛选）
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unread === 'true';

    const result = await notificationService.findAll(req.userId!, { page, limit, unreadOnly });
    success(res, result.data, undefined, 200);
  } catch (err) { next(err); }
});

// GET /unread-count - 未读数量
router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await notificationService.getUnreadCount(req.userId!);
    success(res, { count });
  } catch (err) { next(err); }
});

// PUT /:id/read - 标记单条已读
router.put('/:id/read', async (req, res, next) => {
  try {
    const result = await notificationService.markAsRead(req.params.id, req.userId!);
    success(res, result);
  } catch (err) { next(err); }
});

// PUT /read-all - 全部标记已读
router.put('/read-all', async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.userId!);
    success(res, null, '全部已读');
  } catch (err) { next(err); }
});

// DELETE /:id - 删除通知
router.delete('/:id', async (req, res, next) => {
  try {
    await notificationService.remove(req.params.id, req.userId!);
    success(res, null, '删除成功');
  } catch (err) { next(err); }
});

export default router;
