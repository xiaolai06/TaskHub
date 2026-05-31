import { ToolDefinition } from './types';
import { prisma } from '../../server';

// Tavily API 调用封装
async function callTavily(query: string, apiKey: string, maxResults = 5) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: maxResults, search_depth: 'basic' }),
  });
  if (!res.ok) throw new Error(`Tavily 返回 ${res.status}`);
  const data: any = await res.json();
  return (data.results || []).map((r: any) => ({
    title: r.title,
    snippet: r.content?.slice(0, 300) || '',
    url: r.url,
  }));
}

// SerpAPI 调用封装
async function callSerpAPI(query: string, apiKey: string, maxResults = 5) {
  const res = await fetch(`https://serpapi.com/search?q=${encodeURIComponent(query)}&api_key=${apiKey}&num=${maxResults}&engine=google`);
  if (!res.ok) throw new Error(`SerpAPI 返回 ${res.status}`);
  const data: any = await res.json();
  return (data.organic_results || []).map((r: any) => ({
    title: r.title,
    snippet: r.snippet?.slice(0, 300) || '',
    url: r.link,
  }));
}

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
        description: '搜索关键词，要精确具体：包含时间限定词（2025/最新）、范围限定词（一人公司/freelancer/小团队），例如"2025 小程序开发外包报价 行情"而非"报价"',
      },
      maxResults: { type: 'number', description: '返回条数，默认5', default: 5 },
    },
    required: ['query'],
  },

  handler: async (args, userId) => {
    const query = args.query as string;
    const maxResults = (args.maxResults as number) || 5;

    // 读取搜索配置
    const [providerSetting, apiKeySetting] = await Promise.all([
      prisma.setting.findFirst({ where: { userId, category: 'SEARCH', key: 'provider' } }),
      prisma.setting.findFirst({ where: { userId, category: 'SEARCH', key: 'api_key' } }),
    ]);

    if (!providerSetting?.value || !apiKeySetting?.value || providerSetting.value === 'none') {
      return {
        configured: false,
        message: '未配置搜索 API Key。请在 设置 → 搜索配置 中配置（推荐 Tavily，有免费额度）。',
      };
    }

    try {
      const provider = providerSetting.value;
      const apiKey = apiKeySetting.value; // Setting 服务会自动解密

      const results = provider === 'serpapi'
        ? await callSerpAPI(query, apiKey, maxResults)
        : await callTavily(query, apiKey, maxResults);

      return {
        configured: true,
        provider,
        query,
        results,
        total: results.length,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '搜索失败';
      return { configured: true, error: message, results: [] };
    }
  },
};
