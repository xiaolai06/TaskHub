import { Router, Request, Response } from 'express';
import * as settingService from '../services/setting.service';
import { success, error } from '../utils/response';

const router = Router();

// GET /ai/models?provider=deepseek — 获取供应商模型列表（静态 fallback）
router.get('/ai/models', async (req: Request, res: Response) => {
  try {
    const provider = typeof req.query.provider === 'string' ? req.query.provider : 'deepseek';
    const models = settingService.getModels(provider);
    const baseUrl = settingService.getBaseUrl(provider);
    success(res, { models, baseUrl });
  } catch (err) {
    console.error('获取模型列表失败:', err);
    error(res, 'INTERNAL_ERROR', '获取模型列表失败', 500);
  }
});

// POST /ai/fetch-models — 从官方 API 动态获取模型列表
router.post('/ai/fetch-models', async (req: Request, res: Response) => {
  try {
    const { provider, apiKey, baseUrl } = req.body;
    if (!provider || !apiKey) {
      error(res, 'VALIDATION_ERROR', '请选择供应商并填写 API Key', 400);
      return;
    }
    const result = await settingService.fetchModelsFromProvider(provider, apiKey, baseUrl);
    success(res, result);
  } catch (err) {
    console.error('获取模型列表失败:', err);
    error(res, 'INTERNAL_ERROR', '获取模型列表失败', 500);
  }
});

// POST /ai/test — 测试 AI 连接
router.post('/ai/test', async (req: Request, res: Response) => {
  try {
    const { provider, apiKey, baseUrl } = req.body;
    if (!provider || !apiKey) {
      error(res, 'VALIDATION_ERROR', '请填写供应商和 API Key', 400);
      return;
    }
    const result = await settingService.testAiConnection(provider, apiKey, baseUrl);
    success(res, result);
  } catch (err) {
    console.error('测试连接失败:', err);
    error(res, 'INTERNAL_ERROR', '测试连接失败', 500);
  }
});

// GET /sessions — 获取登录设备列表
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const sessions = await settingService.getSessions(req.userId!);
    success(res, sessions);
  } catch (err) {
    console.error('获取设备列表失败:', err);
    error(res, 'INTERNAL_ERROR', '获取设备列表失败', 500);
  }
});

// DELETE /sessions/:id — 踢出设备
router.delete('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await settingService.deleteSession(req.userId!, id);
    success(res, { deleted: true });
  } catch (err) {
    console.error('踢出设备失败:', err);
    error(res, 'INTERNAL_ERROR', '踢出设备失败', 500);
  }
});

// GET /:category — 获取某分类配置
router.get('/:category', async (req: Request, res: Response) => {
  try {
    const category = String(req.params.category).toUpperCase();
    const settings = await settingService.getByCategory(req.userId!, category);
    success(res, settings);
  } catch (err) {
    console.error('获取配置失败:', err);
    error(res, 'INTERNAL_ERROR', '获取配置失败', 500);
  }
});

// PUT /:category/:key — 更新单个配置
router.put('/:category/:key', async (req: Request, res: Response) => {
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
  } catch (err) {
    console.error('更新配置失败:', err);
    error(res, 'INTERNAL_ERROR', '更新配置失败', 500);
  }
});

// POST /batch — 批量更新配置
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    if (!Array.isArray(settings) || settings.length === 0) {
      error(res, 'VALIDATION_ERROR', '请提供配置列表', 400);
      return;
    }
    await settingService.batchSet(req.userId!, settings);
    success(res, null, '配置已保存');
  } catch (err) {
    console.error('批量更新失败:', err);
    error(res, 'INTERNAL_ERROR', '批量更新失败', 500);
  }
});

export default router;
