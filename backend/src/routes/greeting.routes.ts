import { Router, Request, Response, NextFunction } from 'express';
import * as greetingService from '../services/greeting.service';
import { success, error } from '../utils/response';

const router = Router();

// GET / - 获取当前时段祝福语
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hour = req.query.hour ? Number(req.query.hour) : undefined;
    const greetings = await greetingService.getActive(req.userId!, hour);
    success(res, greetings);
  } catch (err) {
    next(err);
  }
});

// GET /all - 获取所有祝福语
router.get('/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const greetings = await greetingService.getAll(req.userId!);
    success(res, greetings);
  } catch (err) {
    next(err);
  }
});

// POST / - 添加自定义祝福语
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, hourStart, hourEnd } = req.body;
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      error(res, 'VALIDATION_ERROR', '语录内容不能为空', 400);
      return;
    }
    const greeting = await greetingService.create(req.userId!, {
      content: content.trim(),
      hourStart,
      hourEnd,
      source: 'custom',
    });
    success(res, greeting, undefined, 201);
  } catch (err) {
    next(err);
  }
});

// PUT /:id - 更新祝福语
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const greeting = await greetingService.update(req.userId!, id, req.body);
    if (!greeting) {
      error(res, 'NOT_FOUND', '语录不存在', 404);
      return;
    }
    success(res, greeting);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - 删除祝福语
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    await greetingService.remove(req.userId!, id);
    success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
