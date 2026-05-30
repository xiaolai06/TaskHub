import { Router, Request, Response } from 'express';
import * as greetingService from '../services/greeting.service';
import { success, error } from '../utils/response';

const router = Router();

// GET / - 获取当前时段祝福语
router.get('/', async (req: Request, res: Response) => {
  try {
    const hour = req.query.hour ? Number(req.query.hour) : undefined;
    const greetings = await greetingService.getActive(req.userId!, hour);
    success(res, greetings);
  } catch (err) {
    console.error('获取祝福语失败:', err);
    error(res, 'INTERNAL_ERROR', '获取祝福语失败', 500);
  }
});

// GET /all - 获取所有祝福语
router.get('/all', async (req: Request, res: Response) => {
  try {
    const greetings = await greetingService.getAll(req.userId!);
    success(res, greetings);
  } catch (err) {
    console.error('获取祝福语失败:', err);
    error(res, 'INTERNAL_ERROR', '获取祝福语失败', 500);
  }
});

// POST / - 添加自定义祝福语
router.post('/', async (req: Request, res: Response) => {
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
    console.error('添加祝福语失败:', err);
    error(res, 'INTERNAL_ERROR', '添加祝福语失败', 500);
  }
});

// PUT /:id - 更新祝福语
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const greeting = await greetingService.update(req.userId!, id, req.body);
    if (!greeting) {
      error(res, 'NOT_FOUND', '语录不存在', 404);
      return;
    }
    success(res, greeting);
  } catch (err) {
    console.error('更新祝福语失败:', err);
    error(res, 'INTERNAL_ERROR', '更新祝福语失败', 500);
  }
});

// DELETE /:id - 删除祝福语
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await greetingService.remove(req.userId!, id);
    success(res, { deleted: true });
  } catch (err) {
    console.error('删除祝福语失败:', err);
    error(res, 'INTERNAL_ERROR', '删除祝福语失败', 500);
  }
});

export default router;
