import { Router, Request, Response, NextFunction } from 'express';
import * as settingService from '../services/setting.service';
import * as notificationService from '../services/notification.service';
import { testProxy, getProxyStatus, clearProxyCache } from '../services/proxy-config';
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
    const { name, label, baseUrl, apiKey, defaultModel, powerfulModel } = req.body;
    if (!name || !baseUrl) {
      error(res, 'VALIDATION_ERROR', '请提供供应商名称和 API 地址', 400);
      return;
    }
    const result = await settingService.saveProvider(req.userId!, { name, label, baseUrl, apiKey, defaultModel, powerfulModel });
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

// ═══ 解析 apiKey（'***' 表示使用已保存的 key）═══

async function resolveApiKey(userId: string, provider: string, apiKey: string): Promise<string> {
  if (apiKey !== '***') return apiKey;
  // 从数据库读取已保存的加密 key 并解密
  const row = await settingService.getProviderRaw(userId, provider);
  if (!row?.apiKey) throw new Error('该供应商未保存 API Key，请先输入');
  return row.apiKey;
}

// POST /ai/fetch-models — 从官方 API 动态获取
router.post('/ai/fetch-models', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, apiKey, baseUrl } = req.body;
    if (!provider || !apiKey) {
      error(res, 'VALIDATION_ERROR', '请选择供应商并填写 API Key', 400);
      return;
    }
    const resolvedKey = await resolveApiKey(req.userId!, provider, apiKey);
    const result = await settingService.fetchModelsFromProvider(req.userId!, provider, resolvedKey, baseUrl);
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
    const resolvedKey = await resolveApiKey(req.userId!, provider, apiKey);
    const result = await settingService.testAiConnection(provider, resolvedKey, baseUrl);
    success(res, result);
  } catch (err) { next(err); }
});

// GET /ai/all-models — 从所有已配置供应商批量获取模型
router.get('/ai/all-models', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const providers = await settingService.getProviders(req.userId!);
    const results: Array<{ provider: string; label: string; models: { id: string; name: string; tier: string }[]; error?: string }> = [];

    await Promise.allSettled(
      providers.map(async (p) => {
        // 没有 API Key 的供应商，返回 fallback 模型列表（而不是直接跳过）
        if (!p.apiKey || p.apiKey === '***') {
          const fallback = settingService.getFallbackModelsForProvider(p.name);
          if (fallback.length > 0) {
            results.push({ provider: p.name, label: p.label, models: fallback, error: '未配置 API Key，显示预置模型' });
          }
          return;
        }
        try {
          const result = await settingService.fetchModelsFromProvider(req.userId!, p.name, p.apiKey, p.baseUrl);
          results.push({
            provider: p.name,
            label: p.label,
            models: result.models,
            error: result.error || undefined,
          });
        } catch (err) {
          results.push({
            provider: p.name,
            label: p.label,
            models: [],
            error: err instanceof Error ? err.message : '获取失败',
          });
        }
      }),
    );

    // 按供应商名字排序，保持顺序稳定
    results.sort((a, b) => a.provider.localeCompare(b.provider));
    success(res, results);
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

// ═══ 邮件测试 ═══

// POST /email/test — 发送测试邮件
router.post('/email/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to } = req.body;
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      error(res, 'VALIDATION_ERROR', '请提供有效的收件邮箱地址', 400);
      return;
    }
    const result = await notificationService.sendTestEmail(to.trim(), req.userId!);
    success(res, result, '测试邮件已发送');
  } catch (err) {
    const msg = err instanceof Error ? err.message : '发送失败';
    error(res, 'EMAIL_SEND_FAILED', `邮件发送失败: ${msg}`, 502);
  }
});

// ═══ Webhook 测试 ═══

// POST /webhook/test — 测试群机器人推送（支持直接传 URL 或从 DB 读取）
router.post('/webhook/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channel, url } = req.body;
    if (!channel) {
      error(res, 'VALIDATION_ERROR', '请指定推送渠道', 400);
      return;
    }
    // 优先用传入的 URL，否则从 DB 读取
    const webhookUrl = url || await settingService.getWebhookUrl(channel);
    if (!webhookUrl) {
      error(res, 'WEBHOOK_NOT_CONFIGURED', `${channel} Webhook 未配置，请先填写 URL`, 400);
      return;
    }
    const { sendWebhook } = await import('../services/notification.service');
    const result = await sendWebhook(channel, {
      title: 'TaskFlow 连接测试',
      content: `✅ ${channel} 推送测试成功！\n\n此消息来自 智汇轻营 系统设置。`,
    }, webhookUrl);
    success(res, result, '测试消息已发送');
  } catch (err) {
    const msg = err instanceof Error ? err.message : '发送失败';
    error(res, 'WEBHOOK_TEST_FAILED', msg, 502);
  }
});

// ═══ SearXNG 配置 ═══

// POST /searxng/test — 测试 SearXNG 实例连通性
router.post('/searxng/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      error(res, 'VALIDATION_ERROR', '请提供 SearXNG 实例地址', 400);
      return;
    }
    const baseUrl = url.trim().replace(/\/+$/, '');
    try { new URL(baseUrl); } catch {
      error(res, 'VALIDATION_ERROR', '地址格式不正确，应为 http://host:port', 400);
      return;
    }

    const { fetchWithTimeout } = await import('../ai/tools/fetch-with-timeout');
    const testUrl = `${baseUrl}/search?q=test&format=json&pageno=1`;
    const start = Date.now();

    try {
      const resp = await fetchWithTimeout(testUrl, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'TaskFlow-Backend/1.0' },
      }, 10_000);
      const latency = Date.now() - start;

      if (!resp.ok) {
        success(res, { success: false, message: `HTTP ${resp.status}: ${resp.statusText}`, latency });
        return;
      }

      const data = await resp.json() as { results?: unknown[]; query?: string };
      const resultCount = data.results?.length || 0;
      success(res, {
        success: true,
        message: `连接成功！返回 ${resultCount} 条结果`,
        latency,
        resultCount,
        query: data.query,
      });
    } catch (err) {
      const latency = Date.now() - start;
      const msg = err instanceof Error ? err.message : '连接失败';
      success(res, { success: false, message: `连接失败: ${msg}`, latency });
    }
  } catch (err) { next(err); }
});

// GET /searxng/status — 获取当前 SearXNG 配置状态
router.get('/searxng/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (await import('../server')).prisma.setting.findFirst({
      where: { userId: req.userId!, category: 'SEARCH', key: 'searxng_url' },
    });
    const url = row?.value?.trim() || '';
    const configured = !!url;
    let reachable = false;
    let latency = 0;

    if (configured) {
      try {
        const { fetchWithTimeout } = await import('../ai/tools/fetch-with-timeout');
        const start = Date.now();
        const resp = await fetchWithTimeout(`${url.replace(/\/+$/, '')}/search?q=test&format=json`, {
          headers: { 'Accept': 'application/json' },
        }, 5_000);
        latency = Date.now() - start;
        reachable = resp.ok;
      } catch { /* unreachable */ }
    }

    success(res, { configured, url: url || null, reachable, latency });
  } catch (err) { next(err); }
});

// ═══ 代理配置 ═══

// GET /proxy/status — 获取当前代理状态
router.get('/proxy/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await getProxyStatus(req.userId!);
    success(res, status);
  } catch (err) { next(err); }
});

// POST /proxy/test — 测试代理连通性
router.post('/proxy/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      error(res, 'VALIDATION_ERROR', '请提供代理地址', 400);
      return;
    }
    const result = await testProxy(url.trim());
    success(res, result);
  } catch (err) { next(err); }
});

// PUT /proxy — 保存代理配置（存入数据库）
router.put('/proxy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = req.body;
    if (url !== undefined && url !== '') {
      // 验证 URL 格式
      try { new URL(url); } catch {
        error(res, 'VALIDATION_ERROR', '代理地址格式不正确，应为 http://host:port', 400);
        return;
      }
    }
    await settingService.set(req.userId!, 'NETWORK', 'proxy_url', String(url || ''));
    clearProxyCache(req.userId!);
    success(res, { saved: true, url: url || null }, '代理配置已保存');
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
