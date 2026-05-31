import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import * as settingService from '../services/setting.service';
import { success } from '../utils/response';

const router = Router();

// GET / - 获取所有配置
router.get('/', async (req, res, next) => {
  try {
    const settings = await settingService.getAll(req.userId);
    success(res, settings);
  } catch (err) { next(err); }
});

// GET /:category - 按类别获取配置
router.get('/:category', async (req, res, next) => {
  try {
    const settings = await settingService.getByCategory(req.params.category, req.userId);
    success(res, settings);
  } catch (err) { next(err); }
});

// PUT /:category/:key - 更新单个配置
const updateSchema = z.object({
  value: z.string().min(1, '值不能为空'),
  encrypted: z.boolean().optional(),
});

router.put('/:category/:key', validate(updateSchema), async (req, res, next) => {
  try {
    const category = req.params.category as string;
    const key = req.params.key as string;
    const result = await settingService.set(
      category,
      key,
      req.body.value,
      { encrypted: req.body.encrypted, userId: req.userId },
    );
    success(res, result);
  } catch (err) { next(err); }
});

// POST /test-ai - 测试 AI 连接
const testAiSchema = z.object({
  provider: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
});

router.post('/test-ai', validate(testAiSchema), async (req, res, next) => {
  try {
    const { provider, apiKey, baseUrl } = req.body;
    const aiConfig = await settingService.getAiConfig(provider);

    // 使用提供的参数或默认配置
    const testConfig = {
      provider: provider || aiConfig.provider,
      apiKey: apiKey || aiConfig.apiKey,
      baseUrl: baseUrl || aiConfig.baseUrl,
    };

    // 简单测试：尝试调用 API
    const response = await fetch(`${testConfig.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${testConfig.apiKey}` },
    });

    if (response.ok) {
      success(res, { connected: true, provider: testConfig.provider });
    } else {
      success(res, { connected: false, error: `HTTP ${response.status}` });
    }
  } catch (err) {
    success(res, { connected: false, error: String(err) });
  }
});

// POST /test-channel - 测试通知渠道连通
const testChannelSchema = z.object({
  channel: z.string().min(1, '渠道不能为空'),
});

router.post('/test-channel', validate(testChannelSchema), async (req, res, next) => {
  try {
    const result = await settingService.testChannel(req.body.channel);
    success(res, result);
  } catch (err) { next(err); }
});

// POST /test-all-channels - 测试所有已启用渠道
router.post('/test-all-channels', async (req, res, next) => {
  try {
    const channels = await settingService.getNotifyChannels();
    const results: Record<string, unknown> = {};

    for (const [channel, config] of Object.entries(channels)) {
      if (config.enabled) {
        results[channel] = await settingService.testChannel(channel);
      }
    }

    success(res, results);
  } catch (err) { next(err); }
});

export default router;
