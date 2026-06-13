import { prisma } from '../server';

// ═══ 代理配置（数据库优先，环境变量兜底）═══
// 存储: Setting 表, category=NETWORK, key=proxy_url
// 健康检查: 通过代理请求 httpbin.org，结果缓存 5 分钟

interface ProxyCacheEntry {
  url: string;
  healthy: boolean;
  checkedAt: number;
}

const CACHE_TTL_MS = 60 * 1000; // 1 分钟（降低缓存时间，避免代理恢复后长时间不可用）
const HEALTH_TIMEOUT_MS = 8_000;

const _cache = new Map<string, ProxyCacheEntry>();

// ─── 从数据库读取代理配置 ───

async function getProxyUrlFromDB(userId: string): Promise<string | undefined> {
  try {
    const row = await prisma.setting.findFirst({
      where: { userId, category: 'NETWORK', key: 'proxy_url' },
    });
    if (row?.value?.trim()) return row.value.trim();
  } catch { /* ignore */ }

  // fallback: 环境变量
  return process.env.PROXY_URL || undefined;
}

// ─── 代理健康检查 ───

async function checkProxyHealth(proxyUrl: string): Promise<boolean> {
  try {
    const { ProxyAgent } = await import('undici');
    const dispatcher = new ProxyAgent(proxyUrl);
    const res = await fetch('https://httpbin.org/ip', {
      dispatcher,
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    } as RequestInit);
    return res.ok;
  } catch {
    return false;
  }
}

// ─── 对外接口 ───

export interface ProxyStatus {
  url: string | undefined;
  available: boolean;
  message: string;
}

/** 获取代理 URL（带缓存 + 健康检查）。返回 undefined 表示无代理或代理不可用。 */
export async function getProxyUrl(userId: string): Promise<string | undefined> {
  const url = await getProxyUrlFromDB(userId);
  if (!url) return undefined;

  const cached = _cache.get(userId);
  if (cached && cached.url === url && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    return cached.healthy ? url : undefined;
  }

  const healthy = await checkProxyHealth(url);
  _cache.set(userId, { url, healthy, checkedAt: Date.now() });

  if (healthy) {
    console.log(`[Proxy] ✅ 代理可用: ${url}`);
  } else {
    console.warn(`[Proxy] ❌ 代理不可用: ${url}`);
  }

  return healthy ? url : undefined;
}

/** 获取代理状态（用于系统提示词注入和前端展示） */
export async function getProxyStatus(userId: string): Promise<ProxyStatus> {
  const url = await getProxyUrlFromDB(userId);
  if (!url) {
    console.log('[Proxy] 未配置代理（数据库和环境变量均无）');
    return { url: undefined, available: false, message: '未配置代理' };
  }

  const cached = _cache.get(userId);
  if (cached && cached.url === url && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    console.log(`[Proxy] 使用缓存: available=${cached.healthy}, url=${url}`);
    return cached.healthy
      ? { url, available: true, message: `代理可用 (${url})` }
      : { url, available: false, message: `代理已配置但不可用 (${url})` };
  }

  console.log(`[Proxy] 健康检查中: ${url}`);
  const healthy = await checkProxyHealth(url);
  _cache.set(userId, { url, healthy, checkedAt: Date.now() });
  console.log(`[Proxy] 健康检查结果: ${healthy ? '✅ 可用' : '❌ 不可用'}`);

  return healthy
    ? { url, available: true, message: `代理可用 (${url})` }
    : { url, available: false, message: `代理已配置但不可用 (${url})` };
}

/** 测试代理连通性（设置页面调用） */
export async function testProxy(proxyUrl: string): Promise<{ success: boolean; message: string; ip?: string }> {
  try {
    const { ProxyAgent } = await import('undici');
    const dispatcher = new ProxyAgent(proxyUrl);
    const res = await fetch('https://httpbin.org/ip', {
      dispatcher,
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    } as RequestInit);

    if (!res.ok) return { success: false, message: `代理响应异常: HTTP ${res.status}` };

    const data = await res.json() as { origin?: string };
    return {
      success: true,
      message: '代理连接成功',
      ip: data.origin,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '连接失败';
    return { success: false, message: `代理不可用: ${msg}` };
  }
}

/** 清除缓存（用户更新代理配置后调用） */
export function clearProxyCache(userId: string): void {
  _cache.delete(userId);
}
