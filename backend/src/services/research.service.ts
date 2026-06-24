import { prisma } from '../server';
import { AIService } from './ai.service';
import { getProxyUrl } from './proxy-config';
import { NotFoundError } from '../utils/errors';
import type { CreateBriefingInput, ListBriefingsInput } from '../validators/research.schema';
import logger from '../utils/logger';

// ═══ 类型 ═══

export interface SearchResultItem {
  title: string;
  snippet: string;
  url: string;
  source: string;
  heat?: number;
  extra?: string;
}

// ═══ 搜索入口 ═══

export async function search(userId: string, query: string): Promise<SearchResultItem[]> {
  const q = query.trim();
  const results: SearchResultItem[] = [];

  const settled = await Promise.allSettled([
    searchGitHub(q),
    searchHNAlgolia(q),
    searchDevToSearch(q),
    searchDuckDuckGo(q, userId),
    searchSearXNG(q, userId),
    searchSogou(q),
  ]);

  for (const s of settled) {
    if (s.status === 'fulfilled') results.push(...s.value);
  }

  // 过滤 + 去重 + 排序
  const filtered = results
    .filter(isValidResult)
    .filter((r, i, arr) => arr.findIndex(x => x.url === r.url) === i)
    .sort((a, b) => (b.heat || 0) - (a.heat || 0));

  saveSearchResults(userId, q, filtered.slice(0, 20)).catch((err) => {
    logger.warn({ err }, 'research 保存搜索结果失败');
  });

  return filtered.slice(0, 20);
}

// ═══ 内容校验 ═══

function isValidResult(item: SearchResultItem): boolean {
  if (!item.title || item.title.length < 2 || item.title.length > 300) return false;
  if (!item.snippet || item.snippet.length < 10) return false;
  if (item.url && !item.url.startsWith('http')) return false;

  const combined = item.title + item.snippet;

  // 1. 过滤乱码：不可打印字符或替换字符
  if (/[�￾￿]/.test(combined)) return false;
  const garbage = combined.match(/[^\x20-\x7E一-鿿　-〿＀-￯\n\r\t -ɏ -⁯⸀-⹿　-〿＀-￯]/g);
  if (garbage && garbage.length > combined.length * 0.03) return false;

  // 2. 过滤纯数字/符号标题（无实际内容）
  if (/^[\d\s\-_.]+$/.test(item.title)) return false;

  // 3. 过滤 PDF 下载 spam
  const pdfSpam = (combined.match(/《[^》]+》/g) || []).length;
  if (pdfSpam >= 3) return false;
  if (combined.includes('PDF下载') && combined.includes('《')) return false;

  // 4. 过滤重复字符
  if (/(.)\1{4,}/.test(combined)) return false;

  // 5. 过滤高熵乱码
  const cjk = combined.match(/[一-鿿]/g) || [];
  if (cjk.length > 20) {
    const unique = new Set(cjk).size;
    if (unique / cjk.length > 0.85) return false;
  }

  // 6. 过滤百度云/网盘 spam
  if (/百度云|网盘|云盘|pan\.baidu|提取码/.test(combined)) return false;

  // 7. 过滤 Base64 或二进制内容混入
  if (/^[A-Za-z0-9+/=]{50,}$/.test(item.snippet.trim())) return false;

  // 8. 过滤标题全是 emoji 或特殊符号
  if (/^[\p{Emoji}\p{Symbol}\p{Punctuation}\s]+$/u.test(item.title)) return false;

  return true;
}

async function saveSearchResults(userId: string, query: string, items: SearchResultItem[]) {
  if (items.length === 0) return;
  await prisma.searchResult.createMany({
    data: items.map(item => ({
      userId, query,
      source: item.source,
      title: item.title,
      content: item.snippet,
      url: item.url || null,
      relevance: (item.heat || 50) / 100,
      saved: false,
    })),
  });
}

// ═══ GitHub ═══

async function searchGitHub(query: string): Promise<SearchResultItem[]> {
  try {
    const res = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=6`,
      { headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'TaskFlow-AI/1.0' }, signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return [];
    interface GitHubSearchResponse {
      items?: Array<{
        full_name?: string;
        description?: string;
        html_url?: string;
        stargazers_count?: number;
      }>;
    }
    const data = await res.json() as GitHubSearchResponse;
    return (data.items || []).map((r) => ({
      title: r.full_name || '',
      snippet: r.description || '(无描述)',
      url: r.html_url || '',
      source: 'github',
      heat: Math.min(100, (r.stargazers_count || 0) / 500),
      extra: `⭐ ${(r.stargazers_count || 0).toLocaleString()}`,
    }));
  } catch { return []; }
}

// ═══ Hacker News (Algolia 搜索 API) ═══

async function searchHNAlgolia(query: string): Promise<SearchResultItem[]> {
  try {
    const res = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=8&tags=story`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return [];
    interface HNHit {
      title?: string;
      story_text?: string;
      comment_text?: string;
      url?: string;
      objectID?: string;
      points?: number;
      num_comments?: number;
    }
    interface HNResponse {
      hits?: HNHit[];
    }
    const data = await res.json() as HNResponse;
    return (data.hits || []).map((h) => ({
      title: h.title || '',
      snippet: (h.story_text || h.comment_text || '').slice(0, 250) || `HN 热门 · ${h.points || 0} 分`,
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      source: 'hackernews',
      heat: Math.min(100, (h.points || 10) / 10),
      extra: `${h.points || 0} pts · ${h.num_comments || 0} 评论`,
    }));
  } catch { return []; }
}

// ═══ Dev.to (搜索 API) ═══

async function searchDevToSearch(query: string): Promise<SearchResultItem[]> {
  try {
    // 尝试用搜索参数，fallback 到 top 文章做本地过滤
    const res = await fetch(
      `https://dev.to/api/articles?per_page=10&top=3`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return [];
    interface DevToArticle {
      title?: string;
      tag_list?: string[];
      description?: string;
      url?: string;
      reading_time_minutes?: number;
      positive_reactions_count?: number;
    }
    const articles = await res.json() as DevToArticle[];

    // 本地关键词匹配过滤
    const keywords = query.toLowerCase().split(/\s+/);
    return articles
      .filter(a => {
        const text = ((a.title || '') + ' ' + (a.tag_list || []).join(' ') + ' ' + (a.description || '')).toLowerCase();
        return keywords.some(kw => text.includes(kw)) || (keywords.length === 1 && text.includes(query.toLowerCase()));
      })
      .slice(0, 5)
      .map(a => ({
        title: a.title || '',
        snippet: (a.description || '').slice(0, 200) || `${a.reading_time_minutes} min read`,
        url: a.url || '',
        source: 'devto',
        heat: Math.min(100, (a.positive_reactions_count || 0) / 3),
        extra: `❤️ ${a.positive_reactions_count || 0}`,
      }));
  } catch { return []; }
}

// ═══ DuckDuckGo（免费，无需 API Key）═══

async function searchDuckDuckGo(query: string, userId: string): Promise<SearchResultItem[]> {
  try {
    const proxyUrl = await getProxyUrl(userId);

    // 有代理走 Lite HTML，无代理先试 duck-duck-scrape
    if (!proxyUrl) {
      try {
        const { search } = await import('duck-duck-scrape');
        const results = await search(query, { safeSearch: -1 });
        if (results.results.length > 0) {
          return results.results.slice(0, 6).map(r => ({
            title: r.title || '',
            snippet: r.description?.slice(0, 300) || '',
            url: r.url || '',
            source: 'duckduckgo',
            heat: 60,
            extra: 'DuckDuckGo',
          }));
        }
      } catch {
        // 直连失败，降级 Lite
      }
    }

    // Lite HTML 版本
    const params = new URLSearchParams({ q: query });
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: params.toString(),
      redirect: 'follow',
    };

    let res: Response;
    if (proxyUrl) {
      const { fetchWithProxy } = await import('../ai/tools/fetch-with-timeout');
      res = await fetchWithProxy('https://lite.duckduckgo.com/lite/', proxyUrl, fetchOptions, 15_000);
    } else {
      res = await fetch('https://lite.duckduckgo.com/lite/', { ...fetchOptions, signal: AbortSignal.timeout(15_000) });
    }

    if (!res.ok) return [];

    const html = await res.text();
    const links: Array<{ url: string; title: string }> = [];
    const snippets: string[] = [];

    const linkRegex = /<a[^>]+rel="nofollow"[^>]+href="([^"]+)"[^>]*>([^<]*)<\/a>/gi;
    const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1];
      const title = match[2].trim();
      if (url.startsWith('http') && !url.includes('duckduckgo.com')) {
        links.push({ url, title });
      }
    }
    while ((match = snippetRegex.exec(html)) !== null) {
      snippets.push(match[1].replace(/<[^>]+>/g, '').trim());
    }

    return links.slice(0, 6).map((l, i) => ({
      title: l.title,
      snippet: (snippets[i] || '').slice(0, 300),
      url: l.url,
      source: 'duckduckgo',
      heat: 55,
      extra: 'DuckDuckGo',
    }));
  } catch { return []; }
}

// ═══ SearXNG（自托管，聚合多引擎）═══

async function searchSearXNG(query: string, userId: string): Promise<SearchResultItem[]> {
  try {
    // 读取 SearXNG 配置
    const row = await prisma.setting.findFirst({
      where: { userId, category: 'SEARCH', key: 'searxng_url' },
    });
    const baseUrl = row?.value?.trim()?.replace(/\/+$/, '') || process.env.SEARXNG_URL || '';
    if (!baseUrl) return [];

    const params = new URLSearchParams({
      q: query,
      format: 'json',
      pageno: '1',
      language: 'zh-CN',
    });

    const res = await fetch(`${baseUrl}/search?${params.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'TaskFlow-Backend/1.0' },
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) return [];

    const data = await res.json() as { results?: Array<{ title: string; url: string; content?: string; engines?: string[]; score?: number }> };
    const results = (data.results || [])
      .filter(r => r.url && r.title)
      .slice(0, 8)
      .map(r => ({
        title: r.title.trim(),
        snippet: (r.content || '').slice(0, 300),
        url: r.url,
        source: 'searxng',
        heat: Math.min(100, (r.score || 1) * 10),
        extra: (r.engines || []).slice(0, 3).join(' + '),
      }));

    return results;
  } catch { return []; }
}

// ═══ 搜狗搜索（国内直连，免费）═══

const SOGOU_SEARCH_URL = 'https://www.sogou.com/web';

function decodeSogouUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const decoded = decodeURIComponent(rawUrl);
    const linkMatch = decoded.match(/(?:sogou\.com)?\/link\?url=([^&"\s]+)/i);
    if (linkMatch) return decodeURIComponent(linkMatch[1]);
    if (/^https?:\/\//i.test(decoded)) return decoded;
  } catch { /* ignore */ }
  return '';
}

function extractSogouResults(html: string): Array<{ title: string; snippet: string; url: string }> {
  const results: Array<{ title: string; snippet: string; url: string }> = [];
  const seen = new Set<string>();

  const blockRegex = /<(?:div|section)[^>]*class="[^"]*(?:vrwrap|rb)[^"]*"[\s\S]*?(?=<(?:div|section)[^>]*class="[^"]*(?:vrwrap|rb)|<\/body)/gi;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockRegex.exec(html)) !== null) {
    const block = blockMatch[0];
    const titleMatch = block.match(/<a[^>]*(?:class="[^"]*(?:vrTitle|og)[^"]*"|href="[^"]*")[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleMatch) continue;
    const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    if (!title || title.includes('搜狗') || title.includes('sogou')) continue;

    const dataUrlMatch = block.match(/data-url="([^"]+)"/);
    const hrefMatch = block.match(/<a[^>]+href="([^"]+)"/);
    const rawUrl = dataUrlMatch?.[1] || hrefMatch?.[1] || '';
    const url = decodeSogouUrl(rawUrl);
    if (!url || seen.has(url)) continue;

    const snippetMatch = block.match(/<(?:p|div|span)[^>]*class="[^"]*(?:vrDesc|str[_-]?info|space-txt|desc|summary)[^"]*"[\s\S]*?>([\s\S]*?)<\/(?:p|div|span)>/i);
    const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    seen.add(url);
    results.push({ title, snippet: snippet.slice(0, 300), url });
  }

  // 通用兜底
  if (results.length === 0) {
    const genericRegex = /<h3[^>]*>[\s\S]*?<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>([\s\S]*?)(?=<h3|<\/div>\s*<\/div>)/gi;
    let m: RegExpExecArray | null;
    while ((m = genericRegex.exec(html)) !== null) {
      const url = decodeSogouUrl(m[1]);
      const title = m[2].replace(/<[^>]+>/g, '').trim();
      const snippetBlock = m[3];
      const snippetMatch = snippetBlock.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      if (title && url && !seen.has(url) && !title.includes('搜狗')) {
        seen.add(url);
        results.push({ title, snippet: snippet.slice(0, 300), url });
      }
    }
  }

  return results;
}

async function searchSogou(query: string): Promise<SearchResultItem[]> {
  try {
    const url = `${SOGOU_SEARCH_URL}?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return [];

    const html = await res.text();
    if (html.includes('antispider') || html.includes('验证码')) return [];

    return extractSogouResults(html).map(r => ({
      ...r,
      source: 'sogou',
      heat: 50,
      extra: '搜狗',
    }));
  } catch { return []; }
}

// ═══ 搜索历史 ═══

export async function getHistory(userId: string, limit = 30) {
  return prisma.searchResult.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getHistoryGrouped(userId: string, limit = 20) {
  // 先用 groupBy 获取去重的查询词 + 计数
  const grouped = await prisma.searchResult.groupBy({
    by: ['query'],
    where: { userId },
    _count: { query: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    take: limit,
  });

  // 批量获取每个 query 的 source 分布
  const results = await Promise.all(
    grouped.map(async (g) => {
      const sources = await prisma.searchResult.groupBy({
        by: ['source'],
        where: { userId, query: g.query },
        _count: { source: true },
      });
      const sourceMap: Record<string, number> = {};
      for (const s of sources) sourceMap[s.source] = s._count.source;
      return {
        query: g.query,
        count: g._count.query,
        sources: sourceMap,
        latestAt: (g._max.createdAt ?? new Date()).toISOString(),
      };
    }),
  );

  return results;
}

export async function clearHistory(userId: string) {
  await prisma.searchResult.deleteMany({ where: { userId } });
  return { cleared: true };
}

export async function getHistoryByQuery(userId: string, query: string) {
  return prisma.searchResult.findMany({
    where: { userId, query },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}

// ═══ 收藏管理 ═══

export async function getSaved(userId: string, tag?: string) {
  if (tag) {
    // tags 是 JSON 字符串如 '["github","前端"]'，内存中做精确匹配
    const all = await prisma.savedResearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return all.filter(r => {
      try {
        const tags = JSON.parse(r.tags) as string[];
        return tags.includes(tag);
      } catch { return false; }
    });
  }
  return prisma.savedResearch.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

export async function saveItem(userId: string, data: {
  title: string; summary: string; content: string; tags?: string; searchResultId?: string;
}) {
  return prisma.savedResearch.create({
    data: {
      userId, title: data.title, summary: data.summary,
      content: data.content, tags: data.tags || '[]', searchResultId: data.searchResultId,
    },
  });
}

export async function removeSaved(userId: string, id: string) {
  await prisma.savedResearch.deleteMany({ where: { id, userId } });
  return { deleted: true };
}

// ═══ 行业简报 ═══

export async function generateBriefing(userId: string, params: CreateBriefingInput) {
  const isSearchMode = params.mode === 'search' && params.items && params.items.length > 0;
  let prompt: string;
  let title: string;

  if (isSearchMode) {
    const context = params.items!.map((r, i) =>
      `${i + 1}. [${r.source}] ${r.title}: ${r.snippet}`,
    ).join('\n');

    prompt = `基于以下搜索结果（关键词: ${params.query}），生成一份行业分析简报：
${context}

要求：
1. 综述这些内容在讨论什么
2. 提炼 3 个关键趋势
3. 给出 2 条可操作建议
用中文，Markdown 格式，200-300字。每段用 ### 标题。`;

    title = `${params.query} · 搜索分析简报`;
  } else {
    prompt = `请生成今日一人公司行业简报（200-300字，Markdown 格式）：
1. 今日科技圈值得关注的趋势
2. 对独立开发者有价值的工具或动态
3. 一条可操作的商业建议
风格：简洁、直接、可行动。每段用 ### 标题。`;

    title = `${new Date().toLocaleDateString('zh-CN')} 行业简报`;
  }

  // 调用 LLM 生成内容
  const content = await callLLM(userId, prompt);

  // 从内容中提取标签（### 标题作为标签）
  const tags = extractTags(content);

  const briefing = await prisma.briefing.create({
    data: {
      userId,
      title,
      content,
      mode: params.mode || 'manual',
      query: params.query || null,
      tags: JSON.stringify(tags),
    },
  });

  return briefing;
}

async function callLLM(userId: string, prompt: string): Promise<string> {
  const ai = new AIService(userId);
  const ok = await ai.init();
  if (!ok) return '⚠️ AI 未配置，请先在设置页面配置 AI API Key。';

  let result = '';
  for await (const event of ai.chat({
    messages: [{ role: 'user', content: prompt }],
  })) {
    if (event.type === 'text') result += event.content;
    if (event.type === 'done') break;
  }
  return result || '⚠️ AI 未返回内容，请稍后重试。';
}

function extractTags(content: string): string[] {
  const headings = content.match(/###\s*(.+)/g) || [];
  return headings
    .map(h => h.replace(/###\s*/, '').trim())
    .filter(t => t.length > 0 && t.length < 20)
    .slice(0, 5);
}

export async function listBriefings(userId: string, filters: ListBriefingsInput & { saved?: boolean }) {
  const { mode, tag, page = 1, limit = 10, saved } = filters;
  const where: Record<string, unknown> = { userId };
  if (mode) where.mode = mode;
  if (saved) where.saved = true;

  const selectFields = {
    id: true, title: true, mode: true, query: true, tags: true, createdAt: true,
    content: true, saved: true,
  };

  if (tag) {
    const all = await prisma.briefing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: selectFields,
    });
    const filtered = all.filter(b => {
      try {
        const tags = JSON.parse(b.tags) as string[];
        return tags.some(t => t.includes(tag));
      } catch { return false; }
    });
    const total = filtered.length;
    const data = filtered.slice((page - 1) * limit, page * limit);
    return { data, total, page, limit };
  }

  const [data, total] = await Promise.all([
    prisma.briefing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: selectFields,
    }),
    prisma.briefing.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getBriefing(userId: string, id: string) {
  const briefing = await prisma.briefing.findFirst({ where: { id, userId } });
  if (!briefing) throw new NotFoundError('简报');
  return briefing;
}

export async function deleteBriefing(userId: string, id: string) {
  await prisma.briefing.deleteMany({ where: { id, userId } });
  return { deleted: true };
}

export async function toggleBriefingSaved(userId: string, id: string) {
  const briefing = await prisma.briefing.findFirst({ where: { id, userId } });
  if (!briefing) throw new NotFoundError('简报');
  return prisma.briefing.update({
    where: { id },
    data: { saved: !briefing.saved },
  });
}
