import { Router, Request, Response } from 'express';
import * as researchService from '../services/research.service';
import { success, error } from '../utils/response';

const router = Router();

// POST /search — 多源搜索
router.post('/search', async (req: Request, res: Response, _next) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      error(res, 'VALIDATION_ERROR', '请输入搜索关键词', 400);
      return;
    }
    const results = await researchService.search(req.userId!, query.trim());
    success(res, { query, results, total: results.length });
  } catch (err) {
    console.error('搜索失败:', err);
    error(res, 'INTERNAL_ERROR', '搜索失败', 500);
  }
});

// GET /history — 搜索历史
router.get('/history', async (req: Request, res: Response, _next) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 30;
    const data = await researchService.getHistory(req.userId!, limit);
    success(res, data);
  } catch (err) {
    console.error('获取搜索历史失败:', err);
    error(res, 'INTERNAL_ERROR', '获取搜索历史失败', 500);
  }
});

// DELETE /history — 清除搜索历史
router.delete('/history', async (req: Request, res: Response, _next) => {
  try {
    const result = await researchService.clearHistory(req.userId!);
    success(res, result);
  } catch (err) {
    console.error('清除搜索历史失败:', err);
    error(res, 'INTERNAL_ERROR', '清除搜索历史失败', 500);
  }
});

// GET /saved — 收藏列表
router.get('/saved', async (req: Request, res: Response, _next) => {
  try {
    const tag = req.query.tag as string | undefined;
    const data = await researchService.getSaved(req.userId!, tag);
    success(res, data);
  } catch (err) {
    console.error('获取收藏失败:', err);
    error(res, 'INTERNAL_ERROR', '获取收藏失败', 500);
  }
});

// POST /saved — 收藏
router.post('/saved', async (req: Request, res: Response, _next) => {
  try {
    const data = await researchService.saveItem(req.userId!, req.body);
    success(res, data, '已收藏', 201);
  } catch (err) {
    console.error('收藏失败:', err);
    error(res, 'INTERNAL_ERROR', '收藏失败', 500);
  }
});

// DELETE /saved/:id — 取消收藏
router.delete('/saved/:id', async (req: Request, res: Response, _next) => {
  try {
    const result = await researchService.removeSaved(req.userId!, String(req.params.id));
    success(res, result);
  } catch (err) {
    console.error('取消收藏失败:', err);
    error(res, 'INTERNAL_ERROR', '取消收藏失败', 500);
  }
});

export default router;
