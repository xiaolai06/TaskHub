import { prisma } from '../server';
import { encrypt, decrypt } from './encryption.service';

// ═══ 供应商存储结构 ═══
// Setting: category=AI_PROVIDER, key={provider_name}
//   value = JSON({ name, label, baseUrl, apiKey(加密), createdAt })

interface ProviderInfo {
  name: string;      // 唯一标识: deepseek / openai / xiaomi / custom_xxx
  label: string;     // 显示名: DeepSeek / OpenAI / 小米MiMo
  baseUrl: string;   // API 地址
  apiKey: string;    // 解密后的 API Key
}

// ═══ 通用供应商预置（仅作初始参考，用户可删可改） ═══

const PRESET_PROVIDERS: Array<{ name: string; label: string; baseUrl: string }> = [
  { name: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com' },
  { name: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { name: 'ollama', label: 'Ollama (本地)', baseUrl: 'http://localhost:11434/v1' },
  { name: 'mistral', label: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1' },
  { name: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
  { name: 'together', label: 'Together AI', baseUrl: 'https://api.together.xyz/v1' },
  { name: 'xai', label: 'xAI (Grok)', baseUrl: 'https://api.x.ai/v1' },
  { name: 'perplexity', label: 'Perplexity', baseUrl: 'https://api.perplexity.ai' },
  { name: 'fireworks', label: 'Fireworks AI', baseUrl: 'https://api.fireworks.ai/inference/v1' },
  { name: 'cerebras', label: 'Cerebras', baseUrl: 'https://api.cerebras.ai/v1' },
  { name: 'cohere', label: 'Cohere', baseUrl: 'https://api.cohere.ai/v1' },
  { name: 'deepinfra', label: 'DeepInfra', baseUrl: 'https://api.deepinfra.com/v1/openai' },
  { name: 'novita', label: 'Novita AI', baseUrl: 'https://api.novita.ai/v3/openai' },
  { name: 'siliconflow', label: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1' },
  { name: 'zhipu', label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { name: 'qwen', label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { name: 'moonshot', label: '月之暗面 Kimi', baseUrl: 'https://api.moonshot.cn/v1' },
  { name: 'baidu', label: '百度文心', baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat' },
  { name: 'minimax', label: 'MiniMax', baseUrl: 'https://api.minimax.chat/v1' },
  { name: 'stepfun', label: '阶跃星辰', baseUrl: 'https://api.stepfun.com/v1' },
  { name: 'doubao', label: '豆包 (字节)', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
  { name: 'yi', label: '零一万物', baseUrl: 'https://api.lingyiwanwu.com/v1' },
];

// ═══ 获取所有已配置的供应商列表 ═══

export async function getProviders(userId: string): Promise<ProviderInfo[]> {
  const rows = await prisma.setting.findMany({
    where: { userId, category: 'AI_PROVIDER' },
  });

  const providers: ProviderInfo[] = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.value);
      let apiKey = '';
      if (parsed.apiKey) {
        try { apiKey = decrypt(parsed.apiKey); } catch { apiKey = parsed.apiKey; }
      }
      providers.push({
        name: row.key,
        label: parsed.label || row.key,
        baseUrl: parsed.baseUrl || '',
        apiKey,
      });
    } catch {}
  }

  return providers;
}

// ═══ 获取已配置 + 预置的可选供应商列表 ═══

export async function getAvailableProviders(userId: string) {
  const configured = await getProviders(userId);
  const configuredNames = new Set(configured.map(p => p.name));

  // 已配置的排在前面，预置的排在后面
  const all = [...configured];
  for (const p of PRESET_PROVIDERS) {
    if (!configuredNames.has(p.name)) {
      all.push({ name: p.name, label: p.label, baseUrl: p.baseUrl, apiKey: '' });
    }
  }

  return all;
}

// ═══ 保存/添加供应商配置 ═══

export async function saveProvider(
  userId: string,
  data: { name: string; label?: string; baseUrl: string; apiKey?: string },
) {
  const value = JSON.stringify({
    label: data.label || data.name,
    baseUrl: data.baseUrl,
    apiKey: data.apiKey ? encrypt(data.apiKey) : undefined,
  });

  await prisma.setting.upsert({
    where: { userId_category_key: { userId, category: 'AI_PROVIDER', key: data.name } },
    create: { userId, category: 'AI_PROVIDER', key: data.name, value, encrypted: false },
    update: { value },
  });

  return { name: data.name, saved: true };
}

// ═══ 删除供应商 ═══

export async function deleteProvider(userId: string, provider: string) {
  // 不能删除预置的，只能删自定义的
  await prisma.setting.deleteMany({
    where: { userId, category: 'AI_PROVIDER', key: provider },
  });
  return { deleted: true };
}

// ═══ 动态获取 baseUrl（从已配置供应商中查找） ═══

export async function getBaseUrl(userId: string, provider: string): Promise<string> {
  const row = await prisma.setting.findFirst({
    where: { userId, category: 'AI_PROVIDER', key: provider },
  });
  if (row) {
    try {
      const parsed = JSON.parse(row.value);
      return parsed.baseUrl || '';
    } catch {}
  }
  // fallback 到预置
  const preset = PRESET_PROVIDERS.find(p => p.name === provider);
  return preset?.baseUrl || '';
}

// 同步版本（用于无需 userId 的快速查询，返回预置值）
export function getPresetBaseUrl(provider: string): string {
  const preset = PRESET_PROVIDERS.find(p => p.name === provider);
  return preset?.baseUrl || '';
}

// ═══ 测试 AI 连接（任何供应商） ═══

export async function testAiConnection(provider: string, apiKey: string, baseUrl?: string) {
  const url = baseUrl || getPresetBaseUrl(provider);
  if (!url) return { success: false, message: `未知供应商: ${provider}，请先添加供应商配置` };

  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey, baseURL: url });

    // 先试 /v1/models 连通性
    const modelRes = await fetch(url.replace(/\/+$/, '') + '/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (modelRes.ok) {
      const modelData = await modelRes.json() as Record<string, unknown>;
      const models = (modelData?.data as unknown[]) || [];
      const modelCount = models.length;
      return {
        success: true,
        message: `连接成功！可用模型: ${modelCount} 个`,
        modelCount,
        url,
      };
    }

    // /models 不可用，试 chat completion
    const completion = await client.chat.completions.create({
      model: 'gpt-3.5-turbo', // 通用的 fallback 模型名
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 5,
    });
    return {
      success: true,
      message: `连接成功 (${completion.model})`,
      url,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '连接失败';
    return { success: false, message: msg, url };
  }
}

// ═══ 动态从官方 API 获取模型列表 ═══
// 所有 OpenAI 兼容的供应商都暴露 GET /models
// 非标准供应商：尝试 /models，失败则尝试 chat completion 推断

export async function fetchModelsFromProvider(
  userId: string,
  provider: string,
  apiKey: string,
  baseUrl?: string,
): Promise<{ models: { id: string; name: string; tier: string }[]; error?: string }> {
  const resolvedUrl = baseUrl || (await getBaseUrl(userId, provider));
  if (!resolvedUrl) return { models: [], error: `未知供应商: ${provider}` };

  const base = resolvedUrl.replace(/\/+$/, '');

  // 尝试多个可能的模型列表端点
  const modelUrls = [
    base + '/models',              // OpenAI 标准
    base.replace(/\/v\d+$/, '') + '/models',  // 去掉 /v1 试试
  ];

  let bestError = '';
  let rawModels: Record<string, unknown>[] = [];

  for (const modelsUrl of modelUrls) {
    try {
      const res = await fetch(modelsUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        bestError = `${provider} /models 返回 HTTP ${res.status}`;
        continue;
      }

      const data = await res.json() as any;

      // 兼容多种返回格式
      let items: Record<string, unknown>[] = [];

      if (Array.isArray(data)) {
        // 格式1: 直接返回数组 [{id, ...}, ...]
        items = data;
      } else if (Array.isArray(data?.data)) {
        // 格式2: OpenAI 格式 { object:"list", data: [...] }
        items = data.data;
      } else if (Array.isArray(data?.models)) {
        // 格式3: { models: [...] }
        items = data.models;
      } else if (Array.isArray(data?.result)) {
        // 格式4: { result: [...] }
        items = data.result;
      } else if (typeof data === 'object') {
        // 格式5: { "model-id": {...}, ... } → 提取 key 作为 model id
        const keys = Object.keys(data).filter(k =>
          !['object', 'data', 'models', 'result'].includes(k) &&
          typeof data[k] === 'object',
        );
        if (keys.length > 0) {
          items = keys.map(k => ({ id: k, ...(data[k] as object) }));
        }
      }

      if (items.length > 0) {
        rawModels = items;
        bestError = '';
        break; // 成功获取，跳出循环
      }
    } catch {
      bestError = `${provider} 网络请求失败`;
    }
  }

  // 如果以上都失败，提供一些常见的模型名作为 fallback
  if (rawModels.length === 0) {
    const fallbackModels = getFallbackModels(provider);
    if (fallbackModels.length > 0) {
      return {
        models: fallbackModels.map(m => ({ id: m, name: m, tier: 'fast' as const })),
        error: bestError || `${provider} 不支持 /models 端点，已提供常见模型名供参考`,
      };
    }
    return { models: [], error: bestError || '该供应商不支持 /models 端点，请手动填写模型名' };
  }

  // 过滤去掉非 chat 模型
  const chatModels = rawModels
    .map((m) => ({ id: String(m.id || ''), name: String(m.id || '') }))
    .filter(m =>
      m.id.length > 0 &&
      !m.id.includes('embed') && !m.id.includes('moderation') &&
      !m.id.includes('audio') && !m.id.includes('whisper') &&
      !m.id.includes('dall-e') && !m.id.includes('tts') &&
      !m.id.includes('image') && !m.id.includes('rerank') &&
      !m.id.includes('bge-') && !m.id.includes('text-embedding'),
    )
    .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i);

  if (chatModels.length === 0) {
    // 不过滤了，全部返回
    const allModels = rawModels.map(m => ({ id: String(m.id || ''), name: String(m.id || ''), tier: 'fast' as const }));
    return { models: allModels, error: '未找到专门的 chat 模型，显示全部模型' };
  }

  // 智能 tier 分级
  const models = chatModels.map(m => {
    let tier: 'fast' | 'balanced' | 'powerful' = 'fast';
    const id = m.id.toLowerCase();
    if (id.includes('reasoner') || id.includes('r1') || id.includes('o1') ||
        id.includes('o3') || id.includes('opus') || id.includes('gpt-5') ||
        id.includes('gemini-2') || id.includes('claude-4') || id.includes('grok-3') ||
        id.includes('deepseek-r1') || id.includes('qwen-max') || id.includes('ernie-4')) {
      tier = 'powerful';
    } else if (id.includes('4o') || id.includes('sonnet') || id.includes('pro') ||
               id.includes('gemini') || id.includes('grok-2') || id.includes('mixtral') ||
               id.includes('qwen-plus') || id.includes('glm-4') || id.includes('kimi')) {
      tier = 'balanced';
    }
    return { id: m.id, name: m.id, tier };
  });

  return { models };
}

// ═══ 常见模型名 fallback（仅当 API 不支持 /models 时用） ═══

function getFallbackModels(provider: string): string[] {
  const fallbacks: Record<string, string[]> = {
    deepseek: ['deepseek-chat', 'deepseek-reasoner'],
    openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    ollama: ['llama3', 'qwen2', 'mistral'],
    mistral: ['mistral-tiny', 'mistral-small', 'mistral-medium'],
    groq: ['llama-3.3-70b', 'mixtral-8x7b', 'gemma2-9b'],
    together: ['mistralai/Mixtral-8x7B', 'meta-llama/Llama-3-70b'],
    xai: ['grok-2', 'grok-2-vision'],
    perplexity: ['llama-3.1-sonar-small', 'llama-3.1-sonar-large'],
    fireworks: ['accounts/fireworks/models/llama-v3p1-70b-instruct'],
    cerebras: ['llama3.1-8b', 'llama3.1-70b'],
    cohere: ['command-r', 'command-r-plus'],
    deepinfra: ['meta-llama/Llama-3.3-70B-Instruct', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
    siliconflow: ['Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V3'],
    zhipu: ['glm-4', 'glm-4-flash'],
    qwen: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
    moonshot: ['moonshot-v1-8k', 'moonshot-v1-32k'],
    baidu: ['ernie-3.5', 'ernie-4.0'],
    minimax: ['abab6.5s-chat', 'abab6.5-chat'],
    stepfun: ['step-1-8k', 'step-1-32k'],
    doubao: ['ep-xxx'],  // 豆包需要自己填 endpoint id
    yi: ['yi-large', 'yi-medium'],
    novita: ['meta-llama/llama-3.1-8b-instruct', 'deepseek/deepseek-r1'],
  };
  return fallbacks[provider] || [];
}

/** 获取某供应商的 fallback 模型列表（带 tier 分级） */
export function getFallbackModelsForProvider(provider: string): { id: string; name: string; tier: string }[] {
  const ids = getFallbackModels(provider);
  return ids.map(id => {
    let tier = 'fast';
    const lower = id.toLowerCase();
    if (lower.includes('reasoner') || lower.includes('r1') || lower.includes('gpt-4o') ||
        lower.includes('gpt-5') || lower.includes('opus') || lower.includes('gemini-2') ||
        lower.includes('claude-4') || lower.includes('grok-3') || lower.includes('qwen-max') ||
        lower.includes('ernie-4') || lower.includes('kimi') || lower.includes('sonar-large')) {
      tier = 'powerful';
    } else if (lower.includes('plus') || lower.includes('medium') || lower.includes('sonar') ||
               lower.includes('command-r') || lower.includes('abab6.5')) {
      tier = 'balanced';
    }
    return { id, name: id, tier };
  });
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
