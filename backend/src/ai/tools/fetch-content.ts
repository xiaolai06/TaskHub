import { ToolDefinition } from './types';
import { fetchWithProxy, fetchWithTimeout } from './fetch-with-timeout';
import { getProxyUrl } from '../../services/proxy-config';

// ═══ 网页内容提取工具 ═══
// 三级降级策略：
//   1. Defuddle 直连（快速，适合静态页面）
//   2. Defuddle + 代理（被墙或需要代理的站点）
//   3. Jina Reader API（兜底，处理 JS 渲染页面）

interface ExtractedContent {
  title: string;
  content: string;
  author: string | null;
  url: string;
  length: number;
  source: string;
}

// ─── 策略 1：Defuddle 直连 ───

async function extractWithDefuddleDirect(url: string): Promise<ExtractedContent> {
  const { default: Defuddle } = await import('defuddle');
  const { JSDOM } = await import('jsdom');

  const response = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
  }, 12_000);

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();

  // 检测反爬/空页面
  if (html.length < 500) throw new Error('页面内容过少');
  if (html.includes('antispider') || html.includes('验证码') || html.includes('captcha')) {
    throw new Error('触发反爬机制');
  }

  const doc = new JSDOM(html, { url });
  const result = new Defuddle(doc.window.document, { url }).parse();

  if (!result.content || result.content.length < 100) {
    throw new Error('正文提取失败或内容过短');
  }

  return {
    title: result.title || '',
    content: result.content.slice(0, 12_000),
    author: result.author || null,
    url,
    length: result.content.length,
    source: 'defuddle-direct',
  };
}

// ─── 策略 2：Defuddle + 代理 ───

async function extractWithDefuddleProxy(url: string, proxyUrl: string): Promise<ExtractedContent> {
  const { default: Defuddle } = await import('defuddle');
  const { JSDOM } = await import('jsdom');

  const response = await fetchWithProxy(url, proxyUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
  }, 15_000);

  if (!response.ok) throw new Error(`代理 HTTP ${response.status}`);
  const html = await response.text();

  if (html.length < 500) throw new Error('代理页面内容过少');

  const doc = new JSDOM(html, { url });
  const result = new Defuddle(doc.window.document, { url }).parse();

  if (!result.content || result.content.length < 100) {
    throw new Error('代理正文提取失败或内容过短');
  }

  return {
    title: result.title || '',
    content: result.content.slice(0, 12_000),
    author: result.author || null,
    url,
    length: result.content.length,
    source: 'defuddle-proxy',
  };
}

// ─── 策略 3：Jina Reader API ───

async function extractWithJina(url: string, proxyUrl?: string): Promise<ExtractedContent> {
  const response = await fetchWithProxy(`https://r.jina.ai/${url}`, proxyUrl, {
    headers: {
      'Accept': 'text/markdown',
      'X-Return-Format': 'markdown',
      'X-No-Cache': 'true',
    },
  }, 25_000);

  if (!response.ok) throw new Error(`Jina HTTP ${response.status}`);
  const content = await response.text();

  if (!content || content.length < 100) {
    throw new Error('Jina 返回内容过短');
  }

  // 清理 Jina 返回的元数据头
  const lines = content.split('\n');
  let title = '';
  let startIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) {
      title = line.replace(/^#\s*/, '');
      startIdx = i + 1;
      break;
    }
    // 跳过 Jina 的元数据行（Title: / URL: / Published: 等）
    if (/^(Title|URL|Published|Source|Image):/i.test(line)) {
      startIdx = i + 1;
      if (/^Title:/i.test(line)) title = line.replace(/^Title:\s*/, '');
      continue;
    }
    if (line === '---' || line === '') { startIdx = i + 1; continue; }
    break;
  }

  const cleanContent = lines.slice(startIdx).join('\n').trim();

  return {
    title,
    content: cleanContent.slice(0, 12_000),
    author: null,
    url,
    length: cleanContent.length,
    source: 'jina',
  };
}

// ═══ 缓存（同一 URL 10 分钟）═══

interface CacheEntry { result: unknown; ts: number; }
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000;

function getCached(url: string): unknown | null {
  const e = CACHE.get(url);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { CACHE.delete(url); return null; }
  return e.result;
}

function setCache(url: string, result: unknown): void {
  if (CACHE.size >= 150) {
    const oldest = CACHE.keys().next().value;
    if (oldest !== undefined) CACHE.delete(oldest);
  }
  CACHE.set(url, { result, ts: Date.now() });
}

// ═══ 判断是否需要代理 ═══

function needsProxy(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    // 被墙或海外站点，直连大概率失败
    const blocked = [
      'medium.com', 'nytimes.com', 'bbc.com', 'bbc.co.uk',
      'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
      'youtube.com', 'google.com', 'github.com',
      'reddit.com', 'stackoverflow.com', 'dev.to',
      'wikipedia.org', 'bloomberg.com', 'reuters.com',
    ];
    return blocked.some(d => host.includes(d));
  } catch { return false; }
}

// ═══ Tool 定义 ═══

export const fetchWebContentTool: ToolDefinition = {
  name: 'fetch_web_content',
  description: `读取网页完整正文内容，返回干净的 Markdown。内置三级降级策略（直连→代理→Jina），自动处理反爬和被墙站点。

使用时机:
- 搜索结果中某条链接内容有价值，需要深读全文
- 用户给了一个 URL，需要提取正文
- 需要网页中的具体数据（表格、列表、详细分析、报告全文）

不使用时机:
- 搜索结果的摘要/片段已经足够回答问题
- 用户只是泛泛地问问题，不需要具体网页内容
- URL 明显是视频、图片、下载链接（非文章页面）

三级降级策略:
1. Defuddle 直连（最快，适合国内静态页面）
2. Defuddle + 代理（被墙站点、海外网站）
3. Jina Reader（最后兜底，可处理 JS 渲染页面）

常见失败场景及应对:
- 头条/微信公众号等 JS 渲染 → Jina 兜底通常能处理
- 知乎/简书需要登录 → 返回摘要即可，告诉用户需登录查看原文
- 返回"内容过短" → 该页面可能是纯图片/视频/SPA，直接用搜索摘要回答

AI 自适应提示: 通常是搜索后的第二步。如果 fetch 失败，不要反复重试同一个 URL，直接用搜索返回的摘要回答用户。`,

  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',

  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: '要读取的网页 URL（http/https 开头）',
      },
    },
    required: ['url'],
  },

  handler: async (args, userId) => {
    const url = args.url as string;

    if (!url || !url.startsWith('http')) {
      return { error: '无效的 URL，需要以 http:// 或 https:// 开头' };
    }

    // 缓存检查
    const cached = getCached(url);
    if (cached) {
      console.log(`[FetchContent] 缓存命中: ${url.slice(0, 60)}`);
      return { ...(cached as Record<string, unknown>), cached: true };
    }

    const proxyUrl = await getProxyUrl(userId);
    const shouldTryProxy = needsProxy(url) && !!proxyUrl;

    // 构建策略链：根据 URL 特征选择最优顺序
    type Strategy = { name: string; fn: () => Promise<ExtractedContent> };
    const strategies: Strategy[] = [];

    if (shouldTryProxy && proxyUrl) {
      // 被墙站点：先代理直连，再 Jina 代理
      strategies.push(
        { name: 'defuddle-proxy', fn: () => extractWithDefuddleProxy(url, proxyUrl) },
        { name: 'jina-proxy', fn: () => extractWithJina(url, proxyUrl) },
      );
    } else {
      // 国内站点：先直连，再代理（如有），最后 Jina
      strategies.push(
        { name: 'defuddle-direct', fn: () => extractWithDefuddleDirect(url) },
      );
      if (proxyUrl) {
        strategies.push({ name: 'defuddle-proxy', fn: () => extractWithDefuddleProxy(url, proxyUrl) });
      }
      strategies.push(
        { name: 'jina', fn: () => extractWithJina(url, proxyUrl) },
      );
    }

    const errors: string[] = [];
    for (const s of strategies) {
      try {
        console.log(`[FetchContent] 尝试 ${s.name}: ${url.slice(0, 60)}`);
        const result = await s.fn();
        const response = {
          success: true,
          meta: { tool: 'fetch_web_content', url: result.url, strategy: result.source, contentLength: result.length },
          highlights: { title: result.title, author: result.author, wordCount: result.length },
          summary: `提取成功：${result.title || '无标题'}，${result.length}字，策略${result.source}`,
          title: result.title,
          content: result.content,
          author: result.author,
          url: result.url,
          length: result.length,
          source: result.source,
          note: `提取方式: ${result.source}，正文长度: ${result.length} 字符`,
          cached: false,
        };
        setCache(url, response);
        console.log(`[FetchContent] ✅ ${s.name} 成功: ${result.length} 字符`);
        return response;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[FetchContent] ❌ ${s.name} 失败: ${msg}`);
        errors.push(`${s.name}: ${msg}`);
        continue;
      }
    }

    return {
      success: false,
      error: '网页内容提取失败（所有策略均尝试）',
      details: errors,
      url,
      hint: '可能原因：网页需要登录、纯 JS 渲染无法提取、或被反爬拦截。建议直接用搜索摘要回答。',
    };
  },
};
