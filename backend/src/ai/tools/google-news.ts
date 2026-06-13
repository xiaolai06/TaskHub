import { ToolDefinition } from './types';
import { fetchWithProxy } from './fetch-with-timeout';
import { getProxyUrl } from '../../services/proxy-config';
import { applySearchQualityGate, type RawSearchResult } from './search-quality';

// ═══ Google News RSS 工具 ═══
// 免费、无限、无需 API Key
// RSS 格式，支持按关键词/语言过滤

const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search';

interface NewsItem {
  title: string;
  url: string;
  source: string;
  published: string;
  snippet: string;
}

// 简易 XML 解析（提取 RSS item）
function parseRssItems(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const source = extractTag(block, 'source');
    const pubDate = extractTag(block, 'pubDate');

    // title 通常含 " - 来源"，拆分一下
    const titleParts = title.split(' - ');
    const cleanTitle = titleParts.slice(0, -1).join(' - ') || title;
    const cleanSource = titleParts.length > 1 ? titleParts[titleParts.length - 1] : source;

    items.push({
      title: cleanTitle,
      url: link,
      source: cleanSource,
      published: pubDate,
      snippet: cleanTitle, // RSS 没有摘要，用标题代替
    });
  }

  return items;
}

function extractTag(xml: string, tag: string): string {
  // 处理 CDATA
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

// ═══ Tool 定义 ═══

export const searchGoogleNewsTool: ToolDefinition = {
  name: 'search_google_news',
  description: `通过 Google News 搜索最新新闻资讯。免费、需代理（Google 在国内被墙）。

使用时机:
- 用户问某个行业/话题的最新新闻
- "最近有什么新闻？"、"XXX行业最新动态"
- "帮我搜一下 XXX 的新闻报道"
- 需要了解某个公司/产品/技术的最新进展

不使用时机:
- 无代理/国内网络 → 用 search_sogou 搜索新闻
- 查看中文平台热点 → 用 search_daily_hot
- 查看国家宏观数据 → 用 search_world_bank

AI 自适应提示: 全球新闻专用工具，需代理访问。有代理时优先用本工具，比 search_sogou 更结构化。无代理时用 search_sogou 搜索新闻关键词。中文热点新闻用 search_daily_hot 更好。需要深读某篇新闻时配合 fetch_web_content。`,
  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',

  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词，例如 "AI 项目管理"、"React 2025"',
      },
      language: {
        type: 'string',
        description: '语言代码，默认 zh（中文）。常用: zh=中文, en=英文, ja=日文',
        default: 'zh',
      },
      country: {
        type: 'string',
        description: '国家代码，默认 CN。常用: CN=中国, US=美国, JP=日本',
        default: 'CN',
      },
      maxResults: {
        type: 'number',
        description: '返回条数，默认 10，最大 30',
        default: 10,
      },
    },
    required: ['query'],
  },

  handler: async (args, userId) => {
    const query = args.query as string;
    const lang = (args.language as string) || 'zh';
    const country = (args.country as string) || 'CN';
    const maxResults = Math.min((args.maxResults as number) || 10, 30);

    try {
      const proxyUrl = await getProxyUrl(userId);
      const url = `${GOOGLE_NEWS_RSS}?q=${encodeURIComponent(query)}&hl=${lang}&gl=${country}&ceid=${country}:${lang}`;
      const res = await fetchWithProxy(url, proxyUrl, {}, 15_000);

      if (!res.ok) throw new Error(`Google News HTTP ${res.status}`);
      const xml = await res.text();

      const items = parseRssItems(xml);

      // 质量门：过滤 + 打分 + 排序
      const rawForGate: RawSearchResult[] = items.map(r => ({
        title: r.title, snippet: r.snippet, url: r.url, source: r.source, published: r.published,
      }));
      const { results, meta } = applySearchQualityGate(rawForGate, query, 'search_google_news', maxResults);

      return {
        source: 'Google News RSS',
        query,
        language: lang,
        country,
        total: results.length,
        meta,
        articles: results,
        note: '数据来源: Google News RSS，免费无限，无需 API Key',
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google News 搜索失败';
      return { error: message };
    }
  },
};
