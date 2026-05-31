import { Router, Request, Response } from 'express';
import * as settingService from '../services/setting.service';
import { success, error } from '../utils/response';

const router = Router();

// ═══ AI 供应商管理 ═══

// GET /ai/providers — 获取所有可用供应商（已配置 + 预置）
router.get('/ai/providers', async (req: Request, res: Response, _next) => {
  try {
    const providers = await settingService.getAvailableProviders(req.userId!);
    success(res, providers);
  } catch (err) {
    console.error('获取供应商列表失败:', err);
    error(res, 'INTERNAL_ERROR', '获取供应商列表失败', 500);
  }
});

// POST /ai/providers — 添加/更新供应商
router.post('/ai/providers', async (req: Request, res: Response, _next) => {
  try {
    const { name, label, baseUrl, apiKey } = req.body;
    if (!name || !baseUrl) {
      error(res, 'VALIDATION_ERROR', '请提供供应商名称和 API 地址', 400);
      return;
    }
    const result = await settingService.saveProvider(req.userId!, { name, label, baseUrl, apiKey });
    success(res, result, '供应商已保存');
  } catch (err) {
    console.error('保存供应商失败:', err);
    error(res, 'INTERNAL_ERROR', '保存供应商失败', 500);
  }
});

// DELETE /ai/providers/:name — 删除自定义供应商
router.delete('/ai/providers/:name', async (req: Request, res: Response, _next) => {
  try {
    const name = String(req.params.name);
    await settingService.deleteProvider(req.userId!, name);
    success(res, null, '已删除');
  } catch (err) {
    console.error('删除供应商失败:', err);
    error(res, 'INTERNAL_ERROR', '删除供应商失败', 500);
  }
});

// ═══ 模型获取 ═══

// GET /ai/models?provider=xxx — 获取模型列表（fallback + 已保存的）
router.get('/ai/models', async (req: Request, res: Response, _next) => {
  try {
    const provider = typeof req.query.provider === 'string' ? req.query.provider : 'deepseek';
    const baseUrl = await settingService.getBaseUrl(req.userId!, provider);
    // 返回 fallback 静态列表，用户点击"获取模型"可从官方 API 动态拉取
    const fallbackModels = settingService.getFallbackModelsForProvider(provider);
    const models = fallbackModels.map(m => ({
      id: m.id, name: m.name, tier: m.tier,
    }));
    success(res, { models, baseUrl, note: '此为预置列表，点击"获取模型"从官方API动态拉取最新模型' });
  } catch (err) {
    console.error('获取模型列表失败:', err);
    error(res, 'INTERNAL_ERROR', '获取模型列表失败', 500);
  }
});

// POST /ai/fetch-models — 从官方 API 动态获取（任何供应商）
router.post('/ai/fetch-models', async (req: Request, res: Response, _next) => {
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
  } catch (err) {
    console.error('获取模型列表失败:', err);
    error(res, 'INTERNAL_ERROR', '获取模型列表失败', 500);
  }
});

// POST /ai/test — 测试连接（任何供应商）
router.post('/ai/test', async (req: Request, res: Response, _next) => {
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

// ═══ 会话管理 ═══

router.get('/sessions', async (req: Request, res: Response, _next) => {
  try {
    const sessions = await settingService.getSessions(req.userId!);
    success(res, sessions);
  } catch (err) {
    console.error('获取设备列表失败:', err);
    error(res, 'INTERNAL_ERROR', '获取设备列表失败', 500);
  }
});

router.delete('/sessions/:id', async (req: Request, res: Response, _next) => {
  try {
    const id = String(req.params.id);
    await settingService.deleteSession(req.userId!, id);
    success(res, { deleted: true });
  } catch (err) {
    console.error('踢出设备失败:', err);
    error(res, 'INTERNAL_ERROR', '踢出设备失败', 500);
  }
});

// ═══ 通用配置 CRUD ═══

router.get('/:category', async (req: Request, res: Response, _next) => {
  try {
    const category = String(req.params.category).toUpperCase();
    const settings = await settingService.getByCategory(req.userId!, category);
    success(res, settings);
  } catch (err) {
    console.error('获取配置失败:', err);
    error(res, 'INTERNAL_ERROR', '获取配置失败', 500);
  }
});

router.put('/:category/:key', async (req: Request, res: Response, _next) => {
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

router.post('/batch', async (req: Request, res: Response, _next) => {
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
