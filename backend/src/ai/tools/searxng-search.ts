import { ToolDefinition } from './types';
import { fetchWithTimeout } from './fetch-with-timeout';
import { prisma } from '../../server';
import { applySearchQualityGate, type RawSearchResult } from './search-quality';

// ═══ SearXNG 自托管搜索引擎工具 ═══
// 聚合 Google / Bing / DuckDuckGo / 百度等多个引擎
// JSON API: GET {baseUrl}/search?q={query}&format=json

// ─── 缓存（10 分钟 TTL）───

interface CacheEntry {
  result: unknown;
  ts: number;
}

const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE = 200;

function getCached(key: string): unknown | null {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    CACHE.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key: string, result: unknown): void {
  if (CACHE.size >= MAX_CACHE) {
    const oldestKey = CACHE.keys().next().value;
    if (oldestKey !== undefined) CACHE.delete(oldestKey);
  }
  CACHE.set(key, { result, ts: Date.now() });
}

// ─── SearXNG 响应类型 ───

interface SearXNGResult {
  title: string;
  url: string;
  content?: string;
  engine?: string;
  engines?: string[];
  publishedDate?: string;
  score?: number;
}

interface SearXNGResponse {
  query: string;
  results: SearXNGResult[];
  suggestions?: string[];
  infoboxes?: unknown[];
  number_of_results?: number;
}

// ─── 读取 SearXNG 配置 ───

async function getSearXNGUrl(userId: string): Promise<string | undefined> {
  try {
    const row = await prisma.setting.findFirst({
      where: { userId, category: 'SEARCH', key: 'searxng_url' },
    });
    if (row?.value?.trim()) return row.value.trim().replace(/\/+$/, '');
  } catch { /* ignore */ }

  // 环境变量 fallback
  return process.env.SEARXNG_URL || undefined;
}

// ─── 调用 SearXNG API ───

async function callSearXNG(
  baseUrl: string,
  query: string,
  options: {
    maxResults?: number;
    language?: string;
    timeRange?: string;
    engines?: string;
    categories?: string;
  } = {},
): Promise<{ rawResults: RawSearchResult[]; suggestions: string[] }> {
  const {
    language = 'zh-CN',
    timeRange,
    engines,
    categories,
  } = options;

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    pageno: '1',
    language,
  });

  if (timeRange && timeRange !== 'none') {
    params.set('time_range', timeRange);
  }
  if (engines) {
    params.set('engines', engines);
  }
  if (categories) {
    params.set('categories', categories);
  }

  const url = `${baseUrl}/search?${params.toString()}`;
  console.log(`[SearXNG] 请求: ${url}`);

  const res = await fetchWithTimeout(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'TaskFlow-Backend/1.0',
    },
  }, 20_000);

  if (!res.ok) {
    throw new Error(`SearXNG HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json() as SearXNGResponse;

  // 返回原始结果，质量门在 handler 中处理
  const rawResults: RawSearchResult[] = (data.results || [])
    .filter(r => r.url && r.title)
    .map(r => ({
      title: r.title?.trim() || '',
      snippet: (r.content || '').slice(0, 300),
      url: r.url,
      source: (r.engines || [r.engine || 'unknown']).join('+'),
      publishedDate: r.publishedDate,
    }));

  return {
    rawResults,
    suggestions: data.suggestions || [],
  };
}

// ═══ Tool 定义 ═══

export const searchSearXNGTool: ToolDefinition = {
  name: 'search_searxng',
  description: `通过 SearXNG 自托管搜索引擎搜索，聚合 Google / Bing / DuckDuckGo / 百度等多个引擎结果。

使用时机:
- 需要高质量、多引擎聚合的搜索结果
- 需要 Google/Bing 级别的搜索质量（无需单独配置 API Key）
- 需要同时覆盖国内（百度）和国际（Google/Bing）搜索引擎
- 通用搜索的首选工具（当 SearXNG 已配置时）

不使用时机:
- SearXNG 未部署/未配置 → 用 search_sogou（国内免费）或 search_duckduckgo（需代理）
- 中文热点 → 用 search_daily_hot
- 新闻 → 用 search_google_news（需代理）
- 宏观数据 → 用 search_world_bank
- 技术信息 → 用 search_npm / search_github_trending

AI 自适应提示: SearXNG 聚合多个搜索引擎，质量最高，优先使用。结果实时来自互联网。需要先在设置中配置 SearXNG 实例地址。`,

  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'balanced',

  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词',
      },
      maxResults: {
        type: 'number',
        description: '返回条数，默认 8',
        default: 8,
      },
      language: {
        type: 'string',
        description: '搜索语言，如 zh-CN / en-US / ja，默认 zh-CN',
        default: 'zh-CN',
      },
      timeRange: {
        type: 'string',
        description: '时间范围: day / week / month / year，不填则不限',
      },
      engines: {
        type: 'string',
        description: '指定引擎（逗号分隔），如 google,bing,baidu。不填则使用所有可用引擎',
      },
      categories: {
        type: 'string',
        description: '搜索类别: general / news / science / it。不填则默认 general',
      },
    },
    required: ['query'],
  },

  handler: async (args, userId) => {
    const query = args.query as string;
    const maxResults = (args.maxResults as number) || 8;
    const language = (args.language as string) || 'zh-CN';
    const timeRange = args.timeRange as string | undefined;
    const engines = args.engines as string | undefined;
    const categories = args.categories as string | undefined;

    // 读取 SearXNG 配置
    const baseUrl = await getSearXNGUrl(userId || '');
    if (!baseUrl) {
      return {
        error: 'SearXNG 未配置，请在设置 → 搜索配置中填写 SearXNG 实例地址',
        results: [],
        hint: '部署命令: docker run -d --name searxng -p 8080:8080 searxng/searxng',
      };
    }

    // 缓存检查
    const cacheKey = `${baseUrl}:${query}:${language}:${timeRange || ''}:${engines || ''}:${categories || ''}`;
    const cached = getCached(cacheKey);
    if (cached) {
      console.log(`[SearXNG] 缓存命中: "${query.slice(0, 30)}..."`);
      return cached;
    }

    try {
      const { rawResults, suggestions } = await callSearXNG(baseUrl, query, {
        maxResults,
        language,
        timeRange,
        engines,
        categories,
      });

      // 质量门：过滤 + 打分 + 排序
      const { results, meta } = applySearchQualityGate(rawResults, query, 'search_searxng', maxResults);

      if (results.length === 0) {
        return {
          provider: 'searxng',
          query,
          results: [],
          total: 0,
          meta,
          suggestions,
          note: 'SearXNG 未返回结果，可能是引擎暂时不可用',
        };
      }

      const result = {
        provider: 'searxng',
        query,
        results,
        total: results.length,
        meta,
        suggestions,
        canDeepRead: true,
        cached: false,
      };

      setCache(cacheKey, result);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'SearXNG 搜索失败';
      console.warn(`[SearXNG] failed: ${message}`);
      return { error: message, results: [] };
    }
  },
};
