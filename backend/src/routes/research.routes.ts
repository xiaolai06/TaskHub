import { Router, Request, Response, NextFunction } from 'express';
import * as researchService from '../services/research.service';
import { success, error } from '../utils/response';

const router = Router();

// POST /search — 多源搜索
router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      error(res, 'VALIDATION_ERROR', '请输入搜索关键词', 400);
      return;
    }
    const results = await researchService.search(req.userId!, query.trim());
    success(res, { query, results, total: results.length });
  } catch (err) {
    next(err);
  }
});

// GET /history — 搜索历史
router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 30;
    const data = await researchService.getHistory(req.userId!, limit);
    success(res, data);
  } catch (err) {
    next(err);
  }
});

// DELETE /history — 清除搜索历史
router.delete('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await researchService.clearHistory(req.userId!);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

// GET /saved — 收藏列表
router.get('/saved', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tag = req.query.tag as string | undefined;
    const data = await researchService.getSaved(req.userId!, tag);
    success(res, data);
  } catch (err) {
    next(err);
  }
});

// POST /saved — 收藏
router.post('/saved', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await researchService.saveItem(req.userId!, req.body);
    success(res, data, '已收藏', 201);
  } catch (err) {
    next(err);
  }
});

// DELETE /saved/:id — 取消收藏
router.delete('/saved/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await researchService.removeSaved(req.userId!, String(req.params.id));
    success(res, result);
  } catch (err) {
    next(err);
  }
});

export default router;
