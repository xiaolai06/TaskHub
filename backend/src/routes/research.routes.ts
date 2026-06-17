import { Router, Request, Response, NextFunction } from 'express';
import * as researchService from '../services/research.service';
import { success, error } from '../utils/response';
import { validate } from '../middleware/validate';
import { saveResearchSchema, createBriefingSchema, listBriefingsSchema } from '../validators/research.schema';

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

// GET /history — 搜索历史（平铺）
router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 30;
    const data = await researchService.getHistory(req.userId!, limit);
    success(res, data);
  } catch (err) {
    next(err);
  }
});

// GET /history/grouped — 搜索历史（按关键词分组）
router.get('/history/grouped', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 20;
    const data = await researchService.getHistoryGrouped(req.userId!, limit);
    success(res, data);
  } catch (err) {
    next(err);
  }
});

// GET /history/results — 按查询词获取历史搜索结果
router.get('/history/results', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.query as string;
    if (!query) { error(res, 'VALIDATION_ERROR', '缺少 query 参数', 400); return; }
    const data = await researchService.getHistoryByQuery(req.userId!, query);
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
router.post('/saved', validate(saveResearchSchema), async (req: Request, res: Response, next: NextFunction) => {
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

// ═══ 行业简报 ═══

// POST /briefings — 生成并保存简报
router.post('/briefings', validate(createBriefingSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const briefing = await researchService.generateBriefing(req.userId!, req.body);
    success(res, briefing, '简报已生成', 201);
  } catch (err) {
    next(err);
  }
});

// GET /briefings — 简报列表
router.get('/briefings', validate(listBriefingsSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = (req as any).validated?.query || req.query;
    const data = await researchService.listBriefings(req.userId!, filters);
    success(res, data);
  } catch (err) {
    next(err);
  }
});

// GET /briefings/:id — 简报详情
router.get('/briefings/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const briefing = await researchService.getBriefing(req.userId!, String(req.params.id));
    success(res, briefing);
  } catch (err) {
    next(err);
  }
});

// PATCH /briefings/:id/save — 切换简报收藏状态
router.patch('/briefings/:id/save', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await researchService.toggleBriefingSaved(req.userId!, String(req.params.id));
    success(res, result);
  } catch (err) {
    next(err);
  }
});

// DELETE /briefings/:id — 删除简报
router.delete('/briefings/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await researchService.deleteBriefing(req.userId!, String(req.params.id));
    success(res, result);
  } catch (err) {
    next(err);
  }
});

export default router;
