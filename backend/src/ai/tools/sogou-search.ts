import { ToolDefinition } from './types';
import { fetchWithTimeout } from './fetch-with-timeout';
import { applySearchQualityGate, type RawSearchResult } from './search-quality';

// ═══ 搜狗搜索工具 ═══
// 国内直连，免费，无需 API Key
// 抓取 sogou.com 搜索结果 HTML，正则解析

const SOGOU_SEARCH_URL = 'https://www.sogou.com/web';

// ─── 缓存（10 分钟 TTL）───

interface CacheEntry {
  result: unknown;
  ts: number;
}

const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

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
  if (CACHE.size >= 100) {
    const oldestKey = CACHE.keys().next().value;
    if (oldestKey !== undefined) CACHE.delete(oldestKey);
  }
  CACHE.set(key, { result, ts: Date.now() });
}

// ─── HTML 解析 ───

interface RawResult {
  title: string;
  snippet: string;
  url: string;
}

function extractResults(html: string): RawResult[] {
  const results: RawResult[] = [];
  const seen = new Set<string>();

  // 方法 1: 按 vrwrap / rb 容器分块解析（最可靠）
  const blockRegex = /<(?:div|section)[^>]*class="[^"]*(?:vrwrap|rb)[^"]*"[\s\S]*?(?=<(?:div|section)[^>]*class="[^"]*(?:vrwrap|rb)|<\/body)/gi;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const block = blockMatch[0];

    // 提取标题：vrTitle > a，或 h3 > a
    const titleMatch = block.match(/<a[^>]*(?:class="[^"]*(?:vrTitle|og)[^"]*"|href="[^"]*")[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleMatch) continue;
    const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    if (!title || title.includes('搜狗') || title.includes('sogou')) continue;

    // 提取真实 URL：data-url 属性优先，否则从 href 解析
    const dataUrlMatch = block.match(/data-url="([^"]+)"/);
    const hrefMatch = block.match(/<a[^>]+href="([^"]+)"/);
    const rawUrl = dataUrlMatch?.[1] || hrefMatch?.[1] || '';
    const url = decodeSogouUrl(rawUrl);
    if (!url || seen.has(url)) continue;

    // 提取摘要：vrDesc / str_info / space-txt / summary
    const snippetMatch = block.match(/<(?:p|div|span)[^>]*class="[^"]*(?:vrDesc|str[_-]?info|space-txt|desc|summary)[^"]*"[\s\S]*?>([\s\S]*?)<\/(?:p|div|span)>/i);
    const snippet = snippetMatch
      ? snippetMatch[1].replace(/<[^>]+>/g, '').trim()
      : '';

    seen.add(url);
    results.push({ title, snippet: snippet.slice(0, 300), url });
  }

  // 方法 2: 通用兜底 — h3 + href + 摘要
  if (results.length === 0) {
    const genericRegex = /<h3[^>]*>[\s\S]*?<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>([\s\S]*?)(?=<h3|<\/div>\s*<\/div>)/gi;
    let m: RegExpExecArray | null;

    while ((m = genericRegex.exec(html)) !== null) {
      const url = decodeSogouUrl(m[1]);
      const title = m[2].replace(/<[^>]+>/g, '').trim();
      const snippetBlock = m[3];
      const snippetMatch = snippetBlock.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      const snippet = snippetMatch
        ? snippetMatch[1].replace(/<[^>]+>/g, '').trim()
        : '';

      if (title && url && !seen.has(url) && !title.includes('搜狗')) {
        seen.add(url);
        results.push({ title, snippet: snippet.slice(0, 300), url });
      }
    }
  }

  return results;
}

/** 解码搜狗重定向 URL，提取真实地址 */
function decodeSogouUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const decoded = decodeURIComponent(rawUrl);
    // 搜狗重定向: /link?url=xxx 或 https://www.sogou.com/link?url=xxx
    const linkMatch = decoded.match(/(?:sogou\.com)?\/link\?url=([^&"\s]+)/i);
    if (linkMatch) return decodeURIComponent(linkMatch[1]);
    // 直接是真实 URL
    if (/^https?:\/\//i.test(decoded)) return decoded;
  } catch { /* ignore */ }
  return '';
}

// ═══ Tool 定义 ═══

export const searchSogouTool: ToolDefinition = {
  name: 'search_sogou',
  description: `通过搜狗搜索网页信息。免费、国内直连、无需 API Key。

使用时机:
- 国内网络下需要通用网页搜索（DuckDuckGo/Google 不可用时）
- 需要搜索中文内容、国内网站
- 没有配置付费搜索 API Key 时的国内替代方案

不使用时机:
- 用户有 Tavily Key → 用 search_tavily（质量更高）
- 中文热点 → 用 search_daily_hot
- 新闻 → 用 search_google_news（需代理）
- 宏观数据 → 用 search_world_bank

AI 自适应提示: 国内直连免费搜索，零配置。适合中文搜索场景。结果来自搜狗搜索引擎，国内网络下稳定可用。`,

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
        description: '返回条数，默认 5',
        default: 5,
      },
    },
    required: ['query'],
  },

  handler: async (args) => {
    const query = args.query as string;
    const maxResults = (args.maxResults as number) || 5;

    // 缓存检查
    const cacheKey = query.trim().toLowerCase();
    const cached = getCached(cacheKey);
    if (cached) {
      console.log(`[Sogou] 缓存命中: "${query.slice(0, 30)}..."`);
      return cached;
    }

    try {
      const url = `${SOGOU_SEARCH_URL}?query=${encodeURIComponent(query)}`;
      const res = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9',
        },
        redirect: 'follow',
      }, 15_000);

      if (!res.ok) throw new Error(`搜狗 HTTP ${res.status}`);

      const html = await res.text();

      // 检测验证码页面
      if (html.includes('antispider') || html.includes('验证码')) {
        return { error: '搜狗触发了反爬验证，请稍后重试或使用其他搜索工具', results: [] };
      }

      const rawResults = extractResults(html);

      // 质量门：过滤 + 打分 + 排序
      const rawForGate: RawSearchResult[] = rawResults.map(r => ({
        title: r.title, snippet: r.snippet, url: r.url, source: 'sogou',
      }));
      const { results, meta } = applySearchQualityGate(rawForGate, query, 'search_sogou', maxResults);

      if (results.length === 0) {
        return { provider: 'sogou', query, results: [], total: 0, meta, note: '未解析到结果，可能页面结构变化' };
      }

      const result = {
        provider: 'sogou',
        query,
        results,
        total: results.length,
        meta,
        canDeepRead: true,
        cached: false,
      };
      setCache(cacheKey, result);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '搜狗搜索失败';
      console.warn(`[Sogou] failed: ${message}`);
      return { error: message };
    }
  },
};
