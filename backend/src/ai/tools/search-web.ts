import { ToolDefinition } from './types';
import { prisma } from '../../server';
import { decrypt } from '../../services/encryption.service';

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
    try { apiKey = decrypt(rawKey); } catch { apiKey = rawKey; }
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

// ═══ Tool 定义 ═══

export const searchWebTool: ToolDefinition = {
  name: 'search_web',
  description: `联网搜索外部信息。当用户问题无法仅凭本地数据库回答时调用。

使用时机:
- 用户问技术趋势、行业标准、市场行情、竞品等外部知识
- 用户需要"对比我的情况 vs 行业水平"
- 用户问最新信息（本地数据可能过时）

不使用时机:
- 查项目/任务/客户/成本/目标 → 用对应的 get_xxx 工具
- 纯粹的业务操作 → 用对应的 create_xxx/update_xxx`,
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

    if (cfg.provider === 'none' || !cfg.apiKey) {
      return {
        configured: false,
        message: '未配置搜索 API Key。请在 设置 → 搜索配置 中配置（推荐 Tavily，有免费额度）。',
      };
    }

    // AI 指定的 maxResults 可覆盖用户设置
    const resolvedCfg = { ...cfg, maxResults: overrideMax || cfg.maxResults };

    try {
      const results = cfg.provider === 'serpapi'
        ? await callSerpAPI(query, resolvedCfg)
        : await callTavily(query, resolvedCfg);

      return {
        configured: true,
        provider: cfg.provider,
        query,
        results,
        total: results.length,
        // 告诉 AI 用了什么参数，帮助它理解结果质量
        params: {
          topic: cfg.topic,
          depth: cfg.depth,
          timeRange: cfg.timeRange !== 'none' ? cfg.timeRange : undefined,
          country: cfg.country !== 'none' ? cfg.country : undefined,
          includeDomains: cfg.includeDomains.length > 0 ? cfg.includeDomains : undefined,
          excludeDomains: cfg.excludeDomains.length > 0 ? cfg.excludeDomains : undefined,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '搜索失败';
      return { configured: true, error: message, results: [] };
    }
  },
};
