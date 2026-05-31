import { Router, Request, Response, NextFunction } from 'express';
import * as settingService from '../services/setting.service';
import { success, error } from '../utils/response';

const router = Router();

// ═══ AI 供应商管理 ═══

// GET /ai/providers — 获取所有可用供应商（已配置 + 预置）
router.get('/ai/providers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const providers = await settingService.getAvailableProviders(req.userId!);
    success(res, providers);
  } catch (err) { next(err); }
});

// POST /ai/providers — 添加/更新供应商
router.post('/ai/providers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, label, baseUrl, apiKey } = req.body;
    if (!name || !baseUrl) {
      error(res, 'VALIDATION_ERROR', '请提供供应商名称和 API 地址', 400);
      return;
    }
    const result = await settingService.saveProvider(req.userId!, { name, label, baseUrl, apiKey });
    success(res, result, '供应商已保存');
  } catch (err) { next(err); }
});

// DELETE /ai/providers/:name — 删除自定义供应商
router.delete('/ai/providers/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const name = String(req.params.name);
    await settingService.deleteProvider(req.userId!, name);
    success(res, null, '已删除');
  } catch (err) { next(err); }
});

// ═══ 模型获取 ═══

// GET /ai/models?provider=xxx — 获取模型列表（fallback + 已保存的）
router.get('/ai/models', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const provider = typeof req.query.provider === 'string' ? req.query.provider : 'deepseek';
    const baseUrl = await settingService.getBaseUrl(req.userId!, provider);
    const fallbackModels = settingService.getFallbackModelsForProvider(provider);
    const models = fallbackModels.map(m => ({
      id: m.id, name: m.name, tier: m.tier,
    }));
    success(res, { models, baseUrl, note: '此为预置列表，点击"获取模型"从官方API动态拉取最新模型' });
  } catch (err) { next(err); }
});

// POST /ai/fetch-models — 从官方 API 动态获取
router.post('/ai/fetch-models', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, apiKey, baseUrl } = req.body;
    if (!provider || !apiKey) {
      error(res, 'VALIDATION_ERROR', '请选择供应商并填写 API Key', 400);
      return;
    }
    const result = await settingService.fetchModelsFromProvider(req.userId!, provider, apiKey, baseUrl);
    if (result.models.length === 0 && result.error) {
      success(res, { models: [], error: result.error, note: '该供应商不支持 /models 端点，请在下方手动填写模型名称' });
      return;
    }
    success(res, result);
  } catch (err) { next(err); }
});

// POST /ai/test — 测试连接
router.post('/ai/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, apiKey, baseUrl } = req.body;
    if (!provider || !apiKey) {
      error(res, 'VALIDATION_ERROR', '请填写供应商和 API Key', 400);
      return;
    }
    const result = await settingService.testAiConnection(provider, apiKey, baseUrl);
    success(res, result);
  } catch (err) { next(err); }
});

// ═══ 会话管理 ═══

router.get('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await settingService.getSessions(req.userId!);
    success(res, sessions);
  } catch (err) { next(err); }
});

router.delete('/sessions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    await settingService.deleteSession(req.userId!, id);
    success(res, { deleted: true });
  } catch (err) { next(err); }
});

// ═══ 通用配置 CRUD ═══

router.get('/:category', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = String(req.params.category).toUpperCase();
    const settings = await settingService.getByCategory(req.userId!, category);
    success(res, settings);
  } catch (err) { next(err); }
});

router.put('/:category/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = String(req.params.category).toUpperCase();
    const key = String(req.params.key);
    const { value, encrypted } = req.body;
    if (value === undefined) {
      error(res, 'VALIDATION_ERROR', '请提供配置值', 400);
      return;
    }
    const setting = await settingService.set(req.userId!, category, key, String(value), encrypted);
    success(res, setting);
  } catch (err) { next(err); }
});

router.post('/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { settings } = req.body;
    if (!Array.isArray(settings) || settings.length === 0) {
      error(res, 'VALIDATION_ERROR', '请提供配置列表', 400);
      return;
    }
    await settingService.batchSet(req.userId!, settings);
    success(res, null, '配置已保存');
  } catch (err) { next(err); }
});

export default router;
