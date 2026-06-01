import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import * as searchService from '../services/search.service';
import { success } from '../utils/response';

const router = Router();

// POST / - 执行搜索
const searchSchema = z.object({
  query: z.string().min(1, '搜索关键词不能为空'),
  source: z.string().optional(),
});

router.post('/', validate(searchSchema), async (req, res, next) => {
  try {
    const result = await searchService.search(req.userId!, req.body.query, req.body.source);
    success(res, result, '搜索成功');
  } catch (err) { next(err); }
});

// GET /history - 搜索历史
router.get('/history', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const history = await searchService.getHistory(req.userId!, limit);
    success(res, history);
  } catch (err) { next(err); }
});

// DELETE /:id - 删除搜索记录
router.delete('/:id', async (req, res, next) => {
  try {
    await searchService.remove(req.params.id, req.userId!);
    success(res, null, '删除成功');
  } catch (err) { next(err); }
});

export default router;
