import { ToolDefinition } from './types';
import { fetchWithTimeout } from './fetch-with-timeout';

// ═══ GitHub Trending 工具（Search API 版） ═══
// GitHub Trending 页面是 JS 动态渲染的，HTML 直接抓取只能拿到空骨架
// 所以改用官方 Search API — 免费，无需 Token（10次/分钟），有 Token 30次/分钟
// 用"近期创建 + 按star排序"模拟 Trending 效果

const GITHUB_API = 'https://api.github.com';

interface GitHubRepo {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  topics: string[];
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  updated_at: string;
  owner: { login: string; avatar_url: string };
}

async function fetchTrending(params: {
  language?: string;
  since?: 'daily' | 'weekly' | 'monthly';
  topN?: number;
}) {
  const { language, since = 'weekly', topN = 10 } = params;

  // 计算时间范围
  const sinceMap: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 };
  const days = sinceMap[since] || 7;
  const dateStr = new Date(new Date().getTime() - days * 86400000).toISOString().split('T')[0];

  // 构造查询: 最近创建的仓库，按 star 排序 → 近似 Trending
  let q = `created:>${dateStr}`;
  if (language && language !== 'all') {
    q += `+language:${encodeURIComponent(language)}`;
  }

  const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${topN}`;

  const res = await fetchWithTimeout(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'TaskFlow-AI/1.0',
    },
  });

  if (!res.ok) {
    if (res.status === 403) throw new Error('GitHub API 限流（10次/分钟），请稍后再试');
    if (res.status === 422) throw new Error(`搜索语法错误: ${q}`);
    throw new Error(`GitHub API HTTP ${res.status}`);
  }

  const data = await res.json() as any;
  const items: GitHubRepo[] = data.items || [];

  return {
    source: 'GitHub Search API',
    since,
    language: language || 'all',
    total: data.total_count || 0,
    // 这个才是"趋势"的核心：
    // star 是累计的，但 star/days 是增速
    repos: items.map(r => ({
      name: r.full_name,
      url: r.html_url,
      description: r.description || '(无描述)',
      stars: r.stargazers_count,
      language: r.language || '未知',
      topics: (r.topics || []).slice(0, 5),
      forks: r.forks_count,
      issues: r.open_issues_count,
      // star 增速 = 趋势热度
      starVelocity: Math.round(r.stargazers_count / days),
      owner: r.owner?.login || '',
      avatar: r.owner?.avatar_url || '',
      createdAt: r.created_at?.slice(0, 10) || '',
    })),
    // 帮助 AI 理解: 这不是真正的 Trending 算法，而是近似模拟
    note: `显示最近${days}天创建、按star数排名的仓库（近似Trending）。star增速=star数/${days}天。`,
  };
}

// ═══ 常用语言 ═══

const POPULAR_LANGUAGES = [
  'python', 'javascript', 'typescript', 'go', 'rust',
  'java', 'kotlin', 'swift', 'c', 'c++', 'c#', 'ruby', 'php',
  'vue', 'html', 'css', 'svelte', 'dart', 'elixir', 'haskell',
  'scala', 'lua', 'zig', 'r', 'shell',
];

export const githubTrendingTool: ToolDefinition = {
  name: 'github_trending',
  description: `查询 GitHub Trending，获取当前热门开源项目。

工作原理: 使用 GitHub 官方 Search API（免费无需 Key，10次/分钟）。
搜索"最近创建 + 按star排序"来近似 GitHub Trending 效果。
返回每项的 star 增速（star/days）作为热度指标。

当用户问以下问题时调用:
- "最近有什么热门项目？"、"现在最火的开源项目是什么？"
- "XXX语言最近有什么好项目？"、"推荐XXX方面的开源工具"
- "GitHub 趋势"、"本周最热的AI项目"`,

  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',

  parameters: {
    type: 'object',
    properties: {
      language: {
        type: 'string',
        description: `编程语言过滤（可选）。常用值: python, javascript, typescript, go, rust, java, swift, vue, c++, ruby`,
      },
      since: {
        type: 'string',
        enum: ['daily', 'weekly', 'monthly'],
        description: '时间范围: daily=今日(默认), weekly=本周, monthly=本月',
      },
      topN: {
        type: 'number',
        description: '返回项目数，默认10，最大30',
        default: 10,
      },
    },
  },

  handler: async (args) => {
    const language = args.language as string | undefined;
    const since = (args.since as 'daily' | 'weekly' | 'monthly') || 'daily';
    const topN = Math.min((args.topN as number) || 10, 30);

    try {
      return await fetchTrending({ language, since, topN });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '获取 Trending 失败';
      return { error: message };
    }
  },
};
