import { ToolDefinition } from './types';
import { fetchWithTimeout } from './fetch-with-timeout';

// ═══ NPM Registry API ═══
// 官方 API: registry.npmjs.org
// 完全免费，无需 Key，无限调用

interface NPMPackage {
  name: string;
  version: string;
  description: string;
  keywords: string[];
  homepage?: string;
  repository?: { url: string };
  weeklyDownloads: number | undefined;
  maintainers: string[];
  updatedAt: string;
}

async function searchPackages(query: string, size = 10): Promise<NPMPackage[]> {
  // npm search API
  const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${size}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`NPM API HTTP ${res.status}`);
  const data = await res.json() as any;
  return (data.objects || []).map((obj: any) => ({
    name: obj.package?.name || '',
    version: obj.package?.version || '',
    description: obj.package?.description || '',
    keywords: obj.package?.keywords || [],
    homepage: obj.package?.links?.homepage,
    repository: obj.package?.links?.repository ? { url: obj.package.links.repository } : undefined,
    weeklyDownloads: obj.downloads?.weekly || 0,
    maintainers: (obj.package?.maintainers || []).map((m: any) => m.username),
    updatedAt: obj.package?.date || '',
  }));
}

export const npmSearchTool: ToolDefinition = {
  name: 'npm_search',
  description: `搜索 npm 包，查看 JavaScript/TypeScript 生态的库和工具。

完全免费，无需注册。从 npm 官方 registry 获取数据。

当用户问以下问题时调用:
- "有没有好用的 React 表单库？"
- "npm 上 XXX 怎么做？有什么包？"
- "推荐一个日期格式化的库"
- "XXX 包的周下载量是多少？"`,

  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',

  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词（如 "react form validation"、"date picker"）',
      },
      topN: {
        type: 'number',
        description: '返回条数，默认10',
        default: 10,
      },
    },
    required: ['query'],
  },

  handler: async (args) => {
    const query = args.query as string;
    const topN = Math.min((args.topN as number) || 10, 20);

    try {
      const packages = await searchPackages(query, topN);
      return {
        query,
        total: packages.length,
        packages: packages.map(p => ({
          name: p.name,
          url: `https://www.npmjs.com/package/${p.name}`,
          version: p.version,
          description: p.description,
          weeklyDownloads: p.weeklyDownloads,
          popularity: (p.weeklyDownloads || 0) > 1000000 ? '🔥 极热' :
                      (p.weeklyDownloads || 0) > 100000 ? '⭐ 热门' :
                      (p.weeklyDownloads || 0) > 10000 ? '✅ 常用' : '🆕 小众',
          keywords: p.keywords.slice(0, 6),
          maintainers: p.maintainers.slice(0, 3),
          updatedAt: p.updatedAt,
        })),
      };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : '搜索失败' };
    }
  },
};
