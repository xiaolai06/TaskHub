import { ToolDefinition } from './types';
import { fetchWithTimeout, fetchWithProxy } from './fetch-with-timeout';
import { prisma } from '../../server';
import { decrypt } from '../../services/encryption.service';
import { getProxyUrl } from '../../services/proxy-config';
import { applySearchQualityGate, type RawSearchResult } from './search-quality';

// ═══ 搜索结果缓存（10 分钟 TTL，LRU 淘汰）═══

interface CacheEntry {
  result: unknown;
  ts: number;
}

const SEARCH_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 分钟
const CACHE_MAX_SIZE = 200; // 最多缓存 200 条查询

function getCachedResult(query: string, provider: string): unknown | null {
  const key = `${provider}:${query.trim().toLowerCase()}`;
  const entry = SEARCH_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    SEARCH_CACHE.delete(key);
    return null;
  }
  return entry.result;
}

function setCachedResult(query: string, provider: string, result: unknown): void {
  // LRU 淘汰：超过上限删最旧的
  if (SEARCH_CACHE.size >= CACHE_MAX_SIZE) {
    const oldestKey = SEARCH_CACHE.keys().next().value;
    if (oldestKey !== undefined) SEARCH_CACHE.delete(oldestKey);
  }
  const key = `${provider}:${query.trim().toLowerCase()}`;
  SEARCH_CACHE.set(key, { result, ts: Date.now() });
}

// ═══ 搜索配置读取 ═══

interface SearchConfig {
  provider: string;
  apiKey: string;
  topic: string;
  depth: string;
  maxResults: number;
  timeRange: string;
  country: string;
  includeRaw: string;
  chunksPerSource: number;
  includeDomains: string[];
  excludeDomains: string[];
}

async function getSearchConfig(userId: string): Promise<SearchConfig> {
  const rows = await prisma.setting.findMany({
    where: { userId, category: 'SEARCH' },
  });

  const map = new Map<string, string>();
  for (const r of rows) map.set(r.key, r.value);

  let apiKey = '';
  const rawKey = map.get('api_key');
  if (rawKey) {
    try { apiKey = decrypt(rawKey); } catch { console.warn('[Search] API Key 解密失败，请重新配置'); apiKey = ''; }
  }

  let parsedCfg: Record<string, any> = {};
  const cfgStr = map.get('config');
  if (cfgStr) { try { parsedCfg = JSON.parse(cfgStr); } catch {} }

  return {
    provider: map.get('provider') || 'none',
    apiKey,
    topic: parsedCfg.topic || 'general',
    depth: parsedCfg.depth || 'basic',
    maxResults: parsedCfg.maxResults || 5,
    timeRange: parsedCfg.timeRange || 'none',
    country: parsedCfg.country || 'none',
    includeRaw: parsedCfg.includeRaw || 'none',
    chunksPerSource: parsedCfg.chunksPerSource || 3,
    includeDomains: parsedCfg.includeDomains ? parsedCfg.includeDomains.split('\n').map((s: string) => s.trim()).filter(Boolean) : [],
    excludeDomains: parsedCfg.excludeDomains ? parsedCfg.excludeDomains.split('\n').map((s: string) => s.trim()).filter(Boolean) : [],
  };
}

// ═══ Tavily API ═══

interface TavilyBody {
  api_key: string;
  query: string;
  search_depth: string;
  max_results: number;
  topic?: string;
  time_range?: string;
  include_raw_content?: boolean;
  include_domains?: string[];
  exclude_domains?: string[];
  chunks_per_source?: number;
  country?: string;
}

async function callTavily(query: string, cfg: SearchConfig) {
  const body: TavilyBody = {
    api_key: cfg.apiKey,
    query,
    search_depth: cfg.depth,
    max_results: cfg.maxResults,
    chunks_per_source: cfg.chunksPerSource,
  };

  if (cfg.topic !== 'general') body.topic = cfg.topic;
  if (cfg.timeRange !== 'none') body.time_range = cfg.timeRange;
  if (cfg.includeRaw !== 'none') body.include_raw_content = true;
  if (cfg.country !== 'none') body.country = cfg.country;
  if (cfg.includeDomains.length > 0) body.include_domains = cfg.includeDomains;
  if (cfg.excludeDomains.length > 0) body.exclude_domains = cfg.excludeDomains;

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Tavily HTTP ${res.status}${errBody ? ': ' + errBody.slice(0, 200) : ''}`);
  }
  const data: any = await res.json();
  return (data.results || []).map((r: any) => ({
    title: r.title || '',
    snippet: r.content?.slice(0, 300) || '',
    url: r.url || '',
  }));
}

// ═══ SerpAPI ═══

async function callSerpAPI(query: string, cfg: SearchConfig) {
  const params = new URLSearchParams({ q: query, api_key: cfg.apiKey, num: String(cfg.maxResults), engine: 'google' });

  // SerpAPI time filter: d=day, w=week, m=month, y=year
  const tbsMap: Record<string, string> = { day: 'qdr:d', week: 'qdr:w', month: 'qdr:m', year: 'qdr:y' };
  if (cfg.timeRange !== 'none' && tbsMap[cfg.timeRange]) {
    params.set('tbs', tbsMap[cfg.timeRange]);
  }
  // 排除域名（SerpAPI 用 -site: 语法）
  if (cfg.excludeDomains.length > 0) {
    const exclusion = cfg.excludeDomains.map(d => `-site:${d}`).join(' ');
    params.set('q', `${exclusion} ${query}`);
  }

  const res = await fetch(`https://serpapi.com/search?${params.toString()}`);
  if (!res.ok) throw new Error(`SerpAPI HTTP ${res.status}`);
  const data: any = await res.json();
  return (data.organic_results || []).map((r: any) => ({
    title: r.title || '',
    snippet: r.snippet?.slice(0, 300) || '',
    url: r.link || '',
  }));
}

// ═══ DuckDuckGo（免费兜底，无需 API Key）═══
// 使用 Lite HTML 版本，不需要 VQD token，在国内更稳定

async function callDuckDuckGo(query: string, cfg: SearchConfig, proxyUrl?: string) {
  // 有代理时直接走 Lite HTML（duck-duck-scrape 不支持代理，国内直连必失败）
  if (!proxyUrl) {
    // 无代理时尝试 duck-duck-scrape 库（直连，国内可能失败）
    try {
      const { search } = await import('duck-duck-scrape');
      const results = await search(query, { safeSearch: -1 });
      if (results.results.length > 0) {
        return results.results.slice(0, cfg.maxResults).map(r => ({
          title: r.title || '',
          snippet: r.description?.slice(0, 300) || '',
          url: r.url || '',
        }));
      }
    } catch {
      console.warn('[Search] duck-duck-scrape 直连失败，切换到 Lite 版本');
    }
  }

  // 方案 2: DuckDuckGo Lite HTML（不需要 VQD，通过代理访问）
  const params = new URLSearchParams({ q: query });
  const res = await fetchWithProxy('https://lite.duckduckgo.com/lite/', proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
    body: params.toString(),
    redirect: 'follow',
  }, 15_000);

  if (!res.ok) throw new Error(`DDG Lite HTTP ${res.status}`);

  const html = await res.text();
  const results: Array<{ title: string; snippet: string; url: string }> = [];

  // 解析 Lite 版本的 HTML（表格结构：link + snippet）
  const linkRegex = /<a[^>]+rel="nofollow"[^>]+href="([^"]+)"[^>]*>([^<]*)<\/a>/gi;
  const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

  const links: Array<{ url: string; title: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim();
    // 过滤掉 DuckDuckGo 自身链接和广告
    if (url.startsWith('http') && !url.includes('duckduckgo.com') && !url.includes('duck.co')) {
      links.push({ url, title });
    }
  }

  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(match[1].replace(/<[^>]+>/g, '').trim());
  }

  for (let i = 0; i < Math.min(links.length, cfg.maxResults); i++) {
    results.push({
      title: links[i].title,
      snippet: (snippets[i] || '').slice(0, 300),
      url: links[i].url,
    });
  }

  return results;
}

// ═══ URL 去重 ═══

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

function dedupByUrl(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter(r => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

// ═══ Tool: search_tavily ═══

export const searchTavilyTool: ToolDefinition = {
  name: 'search_tavily',
  description: `通过 Tavily API 搜索网页信息（付费，需配置 API Key）。

使用时机:
- 需要高质量、精准的网页搜索结果
- 用户已配置 Tavily API Key（在设置页面）
- 需要搜索深度内容（Tavily 支持 search_depth: advanced）

不使用时机:
- 未配置 API Key → 用 search_sogou（国内免费）或 search_duckduckgo（需代理）
- 中文热点 → 用 search_daily_hot
- 新闻 → 用 search_google_news
- 宏观数据 → 用 search_world_bank

AI 自适应提示: 质量最高的搜索引擎，但需要付费 Key。未配置 Key 时自动不可用，国内网络用 search_sogou 替代，有代理用 search_duckduckgo 替代。`,

  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'balanced',

  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词。要精确具体：包含时间限定词(2025/最新)、范围限定词(一人公司/小团队)、类型词(报价/案例/对比)，例如"2025小程序外包开发报价行情"而非"报价"',
      },
      maxResults: { type: 'number', description: '返回条数，默认5', default: 5 },
    },
    required: ['query'],
  },

  handler: async (args, userId) => {
    const query = args.query as string;
    const overrideMax = args.maxResults as number | undefined;
    const cfg = await getSearchConfig(userId);
    const resolvedCfg = { ...cfg, maxResults: overrideMax || cfg.maxResults };

    if (!cfg.apiKey) {
      return { error: '未配置 Tavily/SerpAPI API Key，请在设置页面配置，或使用 search_duckduckgo 替代', configured: false };
    }

    // ─── 缓存检查 ───
    const cacheKey = `tavily:${cfg.provider}`;
    const cached = getCachedResult(query, cacheKey);
    if (cached) {
      console.log(`[Search] 缓存命中: "${query.slice(0, 30)}..." (${cacheKey})`);
      return cached;
    }

    let rawResults: SearchResult[] = [];
    let provider = cfg.provider;

    try {
      if (cfg.provider === 'serpapi') {
        rawResults = await callSerpAPI(query, resolvedCfg);
      } else {
        rawResults = await callTavily(query, resolvedCfg);
        provider = 'tavily';
      }
    } catch (err) {
      console.warn(`[Search] ${provider} failed:`, err);
      return { error: `${provider} 请求失败: ${err instanceof Error ? err.message : '未知错误'}`, results: [] };
    }

    if (rawResults.length === 0) {
      return { configured: true, provider, query, results: [], total: 0, meta: { tool: 'search_tavily', query, totalRaw: 0, returned: 0, filtered: 0, avgScore: 0, sourceDistribution: {} } };
    }

    const { results, meta } = applySearchQualityGate(rawResults as RawSearchResult[], query, 'search_tavily');
    const result = { configured: true, provider, query, results, total: results.length, meta, canDeepRead: true, cached: false };
    setCachedResult(query, cacheKey, result);
    return result;
  },
};

// ═══ Tool: search_duckduckgo ═══

export const searchDuckDuckGoTool: ToolDefinition = {
  name: 'search_duckduckgo',
  description: `通过 DuckDuckGo 免费搜索网页信息。需代理才能访问（国内被墙）。

使用时机:
- 用户有代理网络，需要免费搜索
- 需要英文内容搜索（DuckDuckGo 英文结果更好）

不使用时机:
- 用户有 Tavily Key → 用 search_tavily（质量更高）
- 国内网络无代理 → 用 search_sogou（国内直连免费搜索）
- 中文热点 → 用 search_daily_hot
- 新闻 → 用 search_google_news

AI 自适应提示: 免费搜索，但需要代理（国内被墙）。无代理时请用 search_sogou 替代。配置代理后会自动通过代理访问。`,

  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'balanced',

  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词。要精确具体：包含时间限定词(2025/最新)、范围限定词(一人公司/小团队)、类型词(报价/案例/对比)，例如"2025小程序外包开发报价行情"而非"报价"',
      },
      maxResults: { type: 'number', description: '返回条数，默认5', default: 5 },
    },
    required: ['query'],
  },

  handler: async (args, userId) => {
    const query = args.query as string;
    const overrideMax = args.maxResults as number | undefined;
    const resolvedCfg: SearchConfig = {
      provider: 'duckduckgo', apiKey: '', topic: 'general', depth: 'basic',
      maxResults: overrideMax || 5, timeRange: 'none', country: 'none',
      includeRaw: 'none', chunksPerSource: 3, includeDomains: [], excludeDomains: [],
    };

    // ─── 代理配置 ───
    const proxyUrl = await getProxyUrl(userId);

    // ─── 缓存检查 ───
    const cached = getCachedResult(query, 'ddg');
    if (cached) {
      console.log(`[Search] 缓存命中: "${query.slice(0, 30)}..." (ddg)`);
      return cached;
    }

    try {
      const rawResults = await callDuckDuckGo(query, resolvedCfg, proxyUrl);
      if (rawResults.length === 0) {
        return { configured: true, provider: 'duckduckgo', query, results: [], total: 0, meta: { tool: 'search_duckduckgo', query, totalRaw: 0, returned: 0, filtered: 0, avgScore: 0, sourceDistribution: {} } };
      }

      const { results, meta } = applySearchQualityGate(rawResults as RawSearchResult[], query, 'search_duckduckgo');
      const result = { configured: true, provider: 'duckduckgo', query, results, total: results.length, meta, canDeepRead: true, cached: false };
      setCachedResult(query, 'ddg', result);
      return result;
    } catch (err) {
      console.warn('[Search] duckduckgo failed:', err);
      return { error: `DuckDuckGo 搜索失败: ${err instanceof Error ? err.message : '未知错误'}`, results: [] };
    }
  },
};
