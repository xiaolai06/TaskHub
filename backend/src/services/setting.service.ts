import { prisma } from '../server';
import { encrypt, decrypt } from './encryption.service';

// ═══ 写死的默认模型列表（仅做 fallback 用） ═══
const AI_MODELS_FALLBACK: Record<string, { id: string; name: string; tier: string }[]> = {
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', tier: 'fast' },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', tier: 'powerful' },
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tier: 'fast' },
    { id: 'gpt-4o', name: 'GPT-4o', tier: 'powerful' },
  ],
  ollama: [
    { id: 'llama3', name: 'Llama 3', tier: 'fast' },
    { id: 'qwen2', name: 'Qwen 2', tier: 'fast' },
  ],
};

const AI_BASE_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  ollama: 'http://localhost:11434/v1',
};

// ═══ AI 厂商官方预置 baseURL（用户也可自定义） ═══
export function getBaseUrl(provider: string): string {
  return AI_BASE_URLS[provider] || '';
}

/** 获取模型列表：优先从官方 API 动态获取，失败则退回写死的列表 */
export function getModels(provider: string) {
  return AI_MODELS_FALLBACK[provider] || [];
}

/**
 * 从官方 API 动态获取模型列表
 * DeepSeek/OpenAI/Ollama 都暴露 GET /models 端点
 */
export async function fetchModelsFromProvider(provider: string, apiKey: string, baseUrl?: string): Promise<{
  models: { id: string; name: string; tier: string }[];
  error?: string;
}> {
  const url = (baseUrl || AI_BASE_URLS[provider] || '') + '/models';
  if (!url.startsWith('http')) return { models: [], error: '未知供应商' };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      // API 不可达 → 退回写死的列表
      return { models: getModels(provider), error: `API 返回 ${res.status}` };
    }

    const data = (await res.json()) as Record<string, unknown>;
    const rawModels: unknown[] = (data?.data as unknown[]) || [];

    // 过滤：只保留 chat 模型
    const chatModels = rawModels
      .map((m: unknown) => {
        const model = m as Record<string, unknown>;
        return { id: String(model.id || ''), name: String(model.id || '') };
      })
      .filter(m => m.id.length > 0 && !m.id.includes('embed') && !m.id.includes('moderation') && !m.id.includes('audio') && !m.id.includes('whisper') && !m.id.includes('dall-e') && !m.id.includes('tts'))
      .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i); // 去重

    if (chatModels.length === 0) return { models: getModels(provider), error: '未找到可用的 chat 模型' };

    return {
      models: chatModels.map(m => {
        let tier = 'fast';
        if (m.id.includes('reasoner') || m.id.includes('gpt-4o') || m.id.includes('r1')) tier = 'powerful';
        else if (m.id.includes('4') || m.id.includes('opus') || m.id.includes('sonnet')) tier = 'balanced';
        return { ...m, tier, name: m.id };
      }),
    };
  } catch (err) {
    // 网络错误 → 退回写死的列表
    return { models: getModels(provider), error: err instanceof Error ? err.message : '获取失败' };
  }
}

/** 获取某分类所有配置 */
export async function getByCategory(userId: string, category: string) {
  const settings = await prisma.setting.findMany({
    where: { OR: [{ userId }, { userId: 'system' }], category },
  });
  const result: Record<string, string> = {};
  for (const s of settings) {
    if (s.encrypted) {
      try { result[s.key] = decrypt(s.value); } catch { result[s.key] = '***'; }
    } else {
      result[s.key] = s.value;
    }
  }
  return result;
}

/** 获取单个配置 */
export async function get(userId: string, category: string, key: string) {
  const setting = await prisma.setting.findFirst({
    where: { OR: [{ userId }, { userId: 'system' }], category, key },
  });
  return setting?.value ?? null;
}

/** 设置单个配置 */
export async function set(userId: string, category: string, key: string, value: string, encrypted = false) {
  const storedValue = encrypted ? encrypt(value) : value;
  return prisma.setting.upsert({
    where: { userId_category_key: { userId, category, key } },
    create: { userId, category, key, value: storedValue, encrypted },
    update: { value: storedValue, encrypted },
  });
}

/** 批量设置 */
export async function batchSet(userId: string, settings: Array<{ category: string; key: string; value: string; encrypted?: boolean }>) {
  return prisma.$transaction(
    settings.map((s) => {
      const storedValue = s.encrypted ? encrypt(s.value) : s.value;
      return prisma.setting.upsert({
        where: { userId_category_key: { userId, category: s.category, key: s.key } },
        create: { userId, category: s.category, key: s.key, value: storedValue, encrypted: s.encrypted ?? false },
        update: { value: storedValue, encrypted: s.encrypted ?? false },
      });
    }),
  );
}

/** 获取登录设备列表 */
export async function getSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, device: true, ip: true, createdAt: true, expiresAt: true },
  });
}

/** 踢出设备 */
export async function deleteSession(userId: string, sessionId: string) {
  await prisma.session.deleteMany({ where: { id: sessionId, userId } });
  return { deleted: true };
}

/** 测试 AI 连接 */
export async function testAiConnection(provider: string, apiKey: string, baseUrl?: string) {
  const url = baseUrl || AI_BASE_URLS[provider];
  if (!url) return { success: false, message: '未知供应商' };
  const models = AI_MODELS_FALLBACK[provider] || [];
  if (models.length === 0) return { success: false, message: '不支持的供应商' };
  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey, baseURL: url });
    await client.chat.completions.create({ model: models[0].id, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 });
    return { success: true, message: `连接成功 (${models[0].id})` };
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : '连接失败' };
  }
}
