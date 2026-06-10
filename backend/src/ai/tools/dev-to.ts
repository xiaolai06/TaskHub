import { ToolDefinition } from './types';
import { fetchWithTimeout } from './fetch-with-timeout';

// ═══ Dev.to API ═══
// 官方 API: dev.to/api
// 完全免费，无需 Key

const DEV_API = 'https://dev.to/api';

interface DevArticle {
  title: string;
  url: string;
  author: string;
  tags: string[];
  positive_reactions_count: number;
  comments_count: number;
  reading_time_minutes: number;
  published_at: string;
}

export const devToTool: ToolDefinition = {
  name: 'dev_to',
  description: `搜索 Dev.to 技术文章。Dev.to 是最大的独立开发者社区之一。

完全免费，无需注册。可以按标签过滤热门/最新文章。

当用户问以下问题时调用:
- "前端开发最近有什么好文章？"
- "Dev.to 上 React 相关的最热文章"
- "有什么关于 TypeScript 的教程？"`,

  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',

  parameters: {
    type: 'object',
    properties: {
      tag: {
        type: 'string',
        description: '标签过滤（如 react, typescript, python, javascript, css, devops）',
      },
      sortBy: {
        type: 'string',
        enum: ['hot', 'top', 'latest'],
        description: '排序方式: hot=热门(默认), top=最佳, latest=最新',
      },
      topN: {
        type: 'number',
        description: '返回条数，默认10',
        default: 10,
      },
    },
  },

  handler: async (args) => {
    const tag = args.tag as string | undefined;
    const sortBy = (args.sortBy as string) || 'hot';
    const topN = Math.min((args.topN as number) || 10, 30);

    try {
      // 按标签搜文章
      const tagParam = tag ? `tag=${encodeURIComponent(tag)}` : '';
      let url = `${DEV_API}/articles?per_page=${topN}`;
      if (tagParam) url += `&${tagParam}`;
      if (tag) url += `&top=1`; // top 文章

      // 排序
      if (sortBy === 'top') {
        url = `${DEV_API}/articles?per_page=${topN}&top=1` + (tagParam ? `&${tagParam}` : '');
      } else if (sortBy === 'latest') {
        url = `${DEV_API}/articles?per_page=${topN}` + (tagParam ? `&${tagParam}` : '');
      }

      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`Dev.to API HTTP ${res.status}`);
      const articles = await res.json() as DevArticle[];

      const sorted = sortBy === 'hot'
        ? articles.sort((a, b) => b.positive_reactions_count - a.positive_reactions_count)
        : articles;

      return {
        source: 'Dev.to',
        tag: tag || '全部',
        sortBy,
        total: sorted.length,
        articles: sorted.slice(0, topN).map(a => ({
          title: a.title,
          url: a.url,
          author: a.author,
          tags: a.tags,
          reactions: a.positive_reactions_count,
          comments: a.comments_count,
          readingTime: a.reading_time_minutes,
          // 热度评分
          heat: a.positive_reactions_count + a.comments_count * 2,
          published: a.published_at ? a.published_at.slice(0, 10) : '',
        })),
      };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : '获取文章失败' };
    }
  },
};
