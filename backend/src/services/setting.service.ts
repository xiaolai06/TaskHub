import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { EncryptionService } from './encryption.service';
import { ValidationError } from '../utils/errors';

const prisma = new PrismaClient();

// ======================== 读取配置 ========================

/** 获取所有配置（按类别分组） */
export async function getAll(userId = 'system') {
  const settings = await prisma.setting.findMany({
    where: { userId },
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
  });

  // 解密敏感字段
  return settings.map((s: { encrypted: boolean; value: string }) => ({
    ...s,
    value: s.encrypted ? EncryptionService.decrypt(s.value) : s.value,
  }));
}

/** 按类别获取配置 */
export async function getByCategory(category: string, userId = 'system') {
  return prisma.setting.findMany({
    where: { userId, category },
    orderBy: { key: 'asc' },
  });
}

/** 获取单个配置 */
export async function get(category: string, key: string, userId = 'system') {
  const setting = await prisma.setting.findUnique({
    where: {
      userId_category_key: { userId, category, key },
    },
  });

  if (!setting) return null;

  return {
    ...setting,
    value: setting.encrypted ? EncryptionService.decrypt(setting.value) : setting.value,
  };
}

// ======================== 写入配置 ========================

/** 设置单个配置 */
export async function set(
  category: string,
  key: string,
  value: string,
  options: { encrypted?: boolean; userId?: string } = {},
) {
  const { encrypted = false, userId = 'system' } = options;
  const storeValue = encrypted ? EncryptionService.encrypt(value) : value;

  return prisma.setting.upsert({
    where: {
      userId_category_key: { userId, category, key },
    },
    update: { value: storeValue, encrypted },
    create: { userId, category, key, value: storeValue, encrypted },
  });
}

/** 批量设置 */
export async function batchSet(
  settings: Array<{ category: string; key: string; value: string; encrypted?: boolean }>,
  userId = 'system',
) {
  const operations = settings.map((s) =>
    set(s.category, s.key, s.value, { encrypted: s.encrypted, userId }),
  );
  return Promise.all(operations);
}

// ======================== n8n 配置 ========================

/** 获取 n8n 配置 */
export async function getN8nConfig() {
  const baseUrl = await get('N8N', 'BASE_URL');
  const webhookSecret = await get('N8N', 'WEBHOOK_SECRET');
  return {
    baseUrl: baseUrl?.value || config.n8n.baseUrl,
    webhookSecret: webhookSecret?.value || config.n8n.webhookSecret,
  };
}

/** 保存 n8n 配置 */
export async function setN8nConfig(data: { baseUrl?: string; webhookSecret?: string }) {
  const operations: Promise<unknown>[] = [];
  if (data.baseUrl !== undefined) {
    operations.push(set('N8N', 'BASE_URL', data.baseUrl));
  }
  if (data.webhookSecret !== undefined) {
    operations.push(set('N8N', 'WEBHOOK_SECRET', data.webhookSecret, { encrypted: true }));
  }
  return Promise.all(operations);
}

// ======================== AI 配置 ========================

/** 获取 AI 配置（按供应商） */
export async function getAiConfig(provider?: string) {
  const targetProvider = provider || config.ai.provider;
  const apiKey = await get('AI', `${targetProvider}_API_KEY`);
  const baseUrl = await get('AI', `${targetProvider}_BASE_URL`);
  const model = await get('AI', `${targetProvider}_MODEL`);

  return {
    provider: targetProvider,
    apiKey: apiKey?.value || config.ai.apiKey,
    baseUrl: baseUrl?.value || config.ai.baseUrl,
    model: model?.value || config.ai.model,
  };
}

// ======================== 通知渠道配置 ========================

/** 获取所有通知渠道配置 */
export async function getNotifyChannels() {
  const settings = await prisma.setting.findMany({
    where: { userId: 'system', category: 'NOTIFY' },
  });

  const channels: Record<string, { enabled: boolean; webhookUrl?: string }> = {};
  for (const s of settings) {
    const channel = s.key.replace('_WEBHOOK', '').toLowerCase();
    if (!channels[channel]) channels[channel] = { enabled: false };
    if (s.key.endsWith('_WEBHOOK')) {
      channels[channel].webhookUrl = s.encrypted ? EncryptionService.decrypt(s.value) : s.value;
    }
    if (s.key.endsWith('_ENABLED')) {
      channels[channel].enabled = s.value === 'true';
    }
  }

  return channels;
}

/** 测试通知渠道连通 */
export async function testChannel(channel: string) {
  const channels = await getNotifyChannels();
  const channelConfig = channels[channel];

  if (!channelConfig?.webhookUrl) {
    return { success: false, message: `${channel} Webhook URL 未配置` };
  }

  try {
    const testPayload: Record<string, unknown> = {
      msgtype: 'text',
      text: { content: '🧪 TaskFlow+ 通知测试 - 连通性验证成功' },
    };

    const response = await fetch(channelConfig.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    });

    if (response.ok) {
      return { success: true, message: `${channel} 连通测试成功` };
    }
    return { success: false, message: `${channel} 返回 ${response.status}` };
  } catch (err) {
    return { success: false, message: `${channel} 连接失败: ${String(err)}` };
  }
}
