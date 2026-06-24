import { prisma } from '../server';
import logger from '../utils/logger';

// ═══ 代理配置（数据库优先，环境变量兜底）═══
// 存储: Setting 表, category=NETWORK, key=proxy_url
// 健康检查: 多目标探测 + 连续失败阈值 + 后台静默刷新
// 用途: 仅搜索工具（DuckDuckGo / Google News / 被墙内容抓取），AI 对话直连

interface ProxyCacheEntry {
  url: string;
  healthy: boolean;
  checkedAt: number;
  failCount: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;  // 5 分钟
const HEALTH_TIMEOUT_MS = 15_000;     // 单目标超时 15 秒
const FAIL_THRESHOLD = 3;             // 连续失败 3 次才标记不可用

const _cache = new Map<string, ProxyCacheEntry>();

// ─── 健康检查目标（按优先级，走代理访问） ───

const HEALTH_TARGETS = [
  'https://www.google.com/generate_204',   // Google 返回 204，极快
  'https://www.gstatic.com/generate_204',  // Google 静态资源，同样返回 204
  'https://httpbin.org/ip',                // fallback
];

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

// ─── 代理健康检查（多目标，任一成功即为可用） ───

async function checkProxyHealth(proxyUrl: string): Promise<boolean> {
  const { ProxyAgent } = await import('undici');
  const dispatcher = new ProxyAgent(proxyUrl);
  for (const target of HEALTH_TARGETS) {
    try {
      const res = await fetch(target, {
        dispatcher,
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      } as RequestInit);
      if (res.ok || res.status === 204) return true;
    } catch { continue; }
  }
  return false;
}

// ─── 内部：更新缓存 ───

function updateCache(userId: string, url: string, healthy: boolean, prevFailCount: number): void {
  if (healthy) {
    _cache.set(userId, { url, healthy: true, checkedAt: Date.now(), failCount: 0 });
    logger.info({ url }, 'Proxy 代理可用');
  } else {
    const newFailCount = prevFailCount + 1;
    const stillHealthy = newFailCount < FAIL_THRESHOLD;
    _cache.set(userId, { url, healthy: stillHealthy, checkedAt: Date.now(), failCount: newFailCount });
    if (stillHealthy) {
      logger.warn({ failCount: newFailCount, threshold: FAIL_THRESHOLD, url }, 'Proxy 检查失败，暂保持可用');
    } else {
      logger.warn({ failCount: newFailCount, url }, 'Proxy 连续失败，标记不可用');
    }
  }
}

// ─── 对外接口 ───

export interface ProxyStatus {
  url: string | undefined;
  available: boolean;
  message: string;
}

/** 获取代理 URL（带缓存 + 健康检查 + 后台刷新）。返回 undefined 表示无代理或代理不可用。 */
export async function getProxyUrl(userId: string): Promise<string | undefined> {
  const url = await getProxyUrlFromDB(userId);
  if (!url) return undefined;

  const cached = _cache.get(userId);
  const withinTTL = cached && cached.url === url && Date.now() - cached.checkedAt < CACHE_TTL_MS;

  // 缓存有效期内直接返回
  if (withinTTL) {
    // TTL 过半时后台静默刷新（不阻塞调用方）
    if (cached && Date.now() - cached.checkedAt > CACHE_TTL_MS / 2) {
      checkProxyHealth(url).then(healthy => {
        const entry = _cache.get(userId);
        updateCache(userId, url, healthy, healthy ? 0 : (entry?.failCount || 0));
      }).catch(() => {});
    }
    return cached.healthy ? url : undefined;
  }

  // 缓存过期 → 同步检查
  const healthy = await checkProxyHealth(url);
  updateCache(userId, url, healthy, cached?.failCount || 0);

  return _cache.get(userId)?.healthy ? url : undefined;
}

/** 获取代理状态（用于系统提示词注入和前端展示） */
export async function getProxyStatus(userId: string): Promise<ProxyStatus> {
  const url = await getProxyUrlFromDB(userId);
  if (!url) {
    return { url: undefined, available: false, message: '未配置代理' };
  }

  const cached = _cache.get(userId);
  const withinTTL = cached && cached.url === url && Date.now() - cached.checkedAt < CACHE_TTL_MS;

  if (withinTTL) {
    // TTL 过半时后台静默刷新
    if (cached && Date.now() - cached.checkedAt > CACHE_TTL_MS / 2) {
      checkProxyHealth(url).then(healthy => {
        const entry = _cache.get(userId);
        updateCache(userId, url, healthy, healthy ? 0 : (entry?.failCount || 0));
      }).catch(() => {});
    }
    return cached.healthy
      ? { url, available: true, message: `代理可用 (${url})` }
      : { url, available: false, message: `代理已配置但不可用 (${url})` };
  }

  // 缓存过期 → 同步检查
  const healthy = await checkProxyHealth(url);
  updateCache(userId, url, healthy, cached?.failCount || 0);

  return _cache.get(userId)?.healthy
    ? { url, available: true, message: `代理可用 (${url})` }
    : { url, available: false, message: `代理已配置但不可用 (${url})` };
}

/** 测试代理连通性（设置页面调用，返回出口 IP） */
export async function testProxy(proxyUrl: string): Promise<{ success: boolean; message: string; ip?: string }> {
  const { ProxyAgent } = await import('undici');
  const dispatcher = new ProxyAgent(proxyUrl);

  // 优先用 Google 204（快、稳定），fallback httpbin 取 IP
  try {
    const res = await fetch('https://www.google.com/generate_204', {
      dispatcher,
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    } as RequestInit);
    if (res.ok || res.status === 204) {
      // 成功，再用 httpbin 取出口 IP（不阻塞主判定）
      let ip: string | undefined;
      try {
        const ipRes = await fetch('https://httpbin.org/ip', {
          dispatcher,
          signal: AbortSignal.timeout(8_000),
        } as RequestInit);
        if (ipRes.ok) {
          const data = await ipRes.json() as { origin?: string };
          ip = data.origin;
        }
      } catch { /* IP 获取失败不影响主结果 */ }
      return { success: true, message: '代理连接成功', ip };
    }
  } catch { /* Google 不可用，继续 fallback */ }

  // fallback: httpbin
  try {
    const res = await fetch('https://httpbin.org/ip', {
      dispatcher,
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    } as RequestInit);
    if (!res.ok) return { success: false, message: `代理响应异常: HTTP ${res.status}` };
    const data = await res.json() as { origin?: string };
    return { success: true, message: '代理连接成功', ip: data.origin };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '连接失败';
    return { success: false, message: `代理不可用: ${msg}` };
  }
}

/** 清除缓存（用户更新代理配置后调用） */
export function clearProxyCache(userId: string): void {
  _cache.delete(userId);
}
