import OpenAI from 'openai';
import { prisma } from '../server';
import { decrypt } from './encryption.service';
import { AppError } from '../utils/errors';

// ═══ STT 供应商预置 ═══

export interface SttProviderInfo {
  name: string;
  label: string;
  baseUrl: string;
  model: string;
  language: string;
  apiKey: string;
}

export const STT_PRESETS: Array<Omit<SttProviderInfo, 'apiKey' | 'language'>> = [
  { name: 'groq', label: 'Groq（免费推荐）', baseUrl: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3-turbo' },
  { name: 'openai', label: 'OpenAI Whisper', baseUrl: 'https://api.openai.com/v1', model: 'whisper-1' },
  { name: 'siliconflow', label: '硅基流动（国内免费）', baseUrl: 'https://api.siliconflow.cn/v1', model: 'FunAudioLLM/SenseVoiceSmall' },
  { name: 'ollama', label: 'Ollama（本地）', baseUrl: 'http://localhost:11434/v1', model: 'whisper' },
  { name: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'whisper' },
  { name: 'custom', label: '自定义', baseUrl: '', model: '' },
];

// MIME → 文件扩展名
const MIME_EXT: Record<string, string> = {
  'audio/webm': 'webm', 'audio/webm;codecs=opus': 'webm',
  'audio/ogg': 'ogg', 'audio/ogg;codecs=opus': 'ogg',
  'audio/mp4': 'm4a', 'audio/mpeg': 'mp3',
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/flac': 'flac',
};

// ═══ 获取所有已配置的 STT 供应商 ═══

export async function getSttProviders(userId: string): Promise<SttProviderInfo[]> {
  const rows = await prisma.setting.findMany({
    where: { userId, category: 'STT_PROVIDER' },
  });

  const providers: SttProviderInfo[] = [];
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
        model: parsed.model || '',
        language: parsed.language || 'zh',
        apiKey,
      });
    } catch { /* skip corrupt rows */ }
  }
  return providers;
}

// ═══ 获取可用供应商列表（已配置 + 预置） ═══

export async function getAvailableSttProviders(userId: string) {
  const configured = await getSttProviders(userId);
  const configuredNames = new Set(configured.map(p => p.name));

  const all = configured.map(p => ({
    ...p,
    apiKey: p.apiKey ? '***' : '',
  }));

  for (const p of STT_PRESETS) {
    if (!configuredNames.has(p.name)) {
      all.push({ ...p, apiKey: '', language: 'zh' });
    }
  }

  return all;
}

// ═══ 保存供应商 ═══

export async function saveSttProvider(userId: string, data: {
  name: string;
  label?: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  language?: string;
}) {
  const { encrypt } = await import('./encryption.service');

  // 保留已有加密 key：空 apiKey 或 '***' 不覆盖旧值
  let encryptedKey: string | undefined;
  if (data.apiKey && data.apiKey !== '***') {
    encryptedKey = encrypt(data.apiKey);
  } else {
    const existing = await prisma.setting.findFirst({
      where: { userId, category: 'STT_PROVIDER', key: data.name },
    });
    if (existing) {
      try {
        const parsed = JSON.parse(existing.value);
        encryptedKey = parsed.apiKey;
      } catch { /* 无旧值 */ }
    }
  }

  const value = JSON.stringify({
    label: data.label || data.name,
    baseUrl: data.baseUrl,
    apiKey: encryptedKey,
    model: data.model,
    language: data.language || 'zh',
  });

  await prisma.setting.upsert({
    where: { userId_category_key: { userId, category: 'STT_PROVIDER', key: data.name } },
    create: { userId, category: 'STT_PROVIDER', key: data.name, value, encrypted: false },
    update: { value },
  });

  return { name: data.name, saved: true };
}

// ═══ 删除供应商 ═══

export async function deleteSttProvider(userId: string, provider: string) {
  await prisma.setting.deleteMany({
    where: { userId, category: 'STT_PROVIDER', key: provider },
  });
  // 如果删除的是当前激活的，清空激活
  const active = await prisma.setting.findFirst({
    where: { userId, category: 'STT', key: 'provider' },
  });
  if (active?.value === provider) {
    await prisma.setting.deleteMany({ where: { userId, category: 'STT', key: 'provider' } });
  }
  return { deleted: true };
}

// ═══ 获取当前激活的 STT 配置 ═══

async function getActiveSttConfig(userId: string): Promise<SttProviderInfo> {
  // 读取激活的供应商名
  const activeRow = await prisma.setting.findFirst({
    where: { userId, category: 'STT', key: 'provider' },
  });
  const providerName = activeRow?.value || '';

  if (providerName) {
    // 从已配置供应商中读取
    const providers = await getSttProviders(userId);
    const found = providers.find(p => p.name === providerName);
    if (found && found.apiKey) return found;
  }

  // 降级：尝试用第一个已配置的供应商
  const providers = await getSttProviders(userId);
  const first = providers.find(p => p.apiKey);
  if (first) return first;

  // 降级：仅当 AI 供应商就是 Groq 时，复用其 key（同供应商 key 通用）
  // 其他供应商（DeepSeek/Ollama 等）的 key 不能用于 Groq STT
  const aiProviderRow = await prisma.setting.findFirst({
    where: { userId, category: 'AI', key: 'provider' },
  });
  const aiProvider = aiProviderRow?.value || 'deepseek';

  if (aiProvider === 'groq') {
    let aiApiKey = '';
    const aiProviderConfig = await prisma.setting.findFirst({
      where: { userId, category: 'AI_PROVIDER', key: 'groq' },
    });
    if (aiProviderConfig) {
      try {
        const parsed = JSON.parse(aiProviderConfig.value);
        if (parsed.apiKey) {
          try { aiApiKey = decrypt(parsed.apiKey); } catch { aiApiKey = parsed.apiKey; }
        }
      } catch { /* ignore */ }
    }
    if (aiApiKey) {
      const preset = STT_PRESETS[0]; // Groq
      return {
        name: preset.name,
        label: preset.label,
        baseUrl: preset.baseUrl,
        model: preset.model,
        language: 'zh',
        apiKey: aiApiKey,
      };
    }
  }

  // 无可用 STT 配置 — 返回空 key，由调用方抛出明确错误
  const preset = STT_PRESETS[0];
  return {
    name: preset.name,
    label: preset.label,
    baseUrl: preset.baseUrl,
    model: preset.model,
    language: 'zh',
    apiKey: '',
  };
}

// ═══ 创建 OpenAI 客户端（STT 直连，不走代理）═══

async function createSttClient(config: SttProviderInfo, _userId: string, timeout = 30_000): Promise<OpenAI> {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    timeout,
  });
}

// ═══ 语音转文字 ═══

export async function transcribeAudio(
  userId: string,
  audioBuffer: Buffer,
  mimeType: string,
): Promise<{ text: string; durationMs: number }> {
  const config = await getActiveSttConfig(userId);

  if (!config.apiKey) {
    throw new AppError(
      '未配置语音识别服务，请在系统设置 → 语音识别中添加供应商并配置 API Key',
      400,
      'STT_NOT_CONFIGURED',
    );
  }

  const ext = MIME_EXT[mimeType] || 'webm';
  const client = await createSttClient(config, userId, 30_000);

  const file = new File([new Uint8Array(audioBuffer)], `audio.${ext}`, { type: mimeType });

  try {
    const start = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transcribeParams: any = { file, model: config.model, language: config.language || 'zh' };
    const response = await client.audio.transcriptions.create(transcribeParams);
    const durationMs = Date.now() - start;

    const text = typeof response === 'string' ? response : (response as unknown as { text: string }).text;
    return { text: text.trim(), durationMs };
  } catch (err: unknown) {
    // OpenAI SDK 错误：提取状态码和信息
    const statusCode = (err as { status?: number })?.status || 0;
    const apiMessage = (err as { message?: string })?.message || String(err);

    if (statusCode === 401 || statusCode === 403) {
      throw new AppError(
        `语音识别供应商 "${config.label}" 认证失败（${statusCode}），请检查 API Key 是否正确。当前使用: ${config.baseUrl}`,
        400,
        'STT_AUTH_FAILED',
      );
    }
    if (statusCode === 429) {
      throw new AppError('语音识别请求过于频繁，请稍后再试', 429, 'STT_RATE_LIMIT');
    }
    throw new AppError(
      `语音识别失败（${config.label}）: ${apiMessage.slice(0, 200)}`,
      502,
      'STT_API_ERROR',
    );
  }
}

// ═══ 测速 ═══

export async function testSttConnection(userId: string, providerName?: string): Promise<{
  success: boolean;
  latencyMs: number;
  message: string;
  provider: string;
  model: string;
}> {
  let config: SttProviderInfo;

  if (providerName) {
    const providers = await getSttProviders(userId);
    const found = providers.find(p => p.name === providerName);
    if (!found) {
      const preset = STT_PRESETS.find(p => p.name === providerName);
      if (!preset) {
        return { success: false, latencyMs: -1, message: `未知供应商: ${providerName}`, provider: providerName, model: '' };
      }
      config = { ...preset, apiKey: '', language: 'zh' };
    } else {
      config = found;
    }
  } else {
    config = await getActiveSttConfig(userId);
  }

  if (!config.apiKey) {
    return {
      success: false,
      latencyMs: -1,
      message: '未配置 API Key，请先填写并保存',
      provider: config.name,
      model: config.model,
    };
  }

  // 生成 1 秒静音 WAV 用于测试连通性（太短的部分 API 会拒绝）
  const silentWav = generateSilentWav(16000);
  const client = await createSttClient(config, userId, 15_000);

  const file = new File([new Uint8Array(silentWav)], 'test.wav', { type: 'audio/wav' });

  try {
    const start = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const testParams: any = { file, model: config.model, language: config.language || 'zh' };
    await client.audio.transcriptions.create(testParams);
    const latencyMs = Date.now() - start;
    return {
      success: true,
      latencyMs,
      message: `连接正常，延迟 ${latencyMs}ms`,
      provider: config.name,
      model: config.model,
    };
  } catch (err) {
    const statusCode = (err as { status?: number })?.status || 0;
    const msg = err instanceof Error ? err.message : String(err);

    let hint = '';
    if (statusCode === 401 || statusCode === 403) {
      hint = ` → API Key 无效或与供应商 "${config.label}" 不匹配，请检查是否填写了正确的 Key（不同供应商的 Key 不通用）`;
    } else if (statusCode === 429) {
      hint = ' → 请求过于频繁，请稍后再试';
    } else if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
      hint = ` → 无法连接到 ${config.baseUrl}，请检查网络或 Base URL 是否正确`;
    }

    return {
      success: false,
      latencyMs: -1,
      message: `连接失败（${statusCode || '网络错误'}）: ${msg.slice(0, 150)}${hint}`,
      provider: config.name,
      model: config.model,
    };
  }
}

// ═══ 生成静音 WAV ═══

function generateSilentWav(numSamples: number): Buffer {
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * blockAlign;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  return buf;
}
