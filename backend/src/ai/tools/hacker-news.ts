import { ToolDefinition } from './types';
import { fetchWithTimeout } from './fetch-with-timeout';

// ═══ Hacker News API ═══
// 官方 Firebase API: hacker-news.firebaseio.com
// 完全免费，无需 Key，无限调用

const HN_API = 'https://hacker-news.firebaseio.com/v0';

interface HNItem {
  id: number;
  title: string;
  url?: string;
  by: string;
  score: number;
  descendants: number;
  time: number;
  type: 'story' | 'job' | 'poll' | 'comment';
}

async function fetchTopStories(maxResults = 10): Promise<HNItem[]> {
  const ids = await fetchWithTimeout(`${HN_API}/topstories.json`).then(r => r.json()) as number[];
  const topIds = ids.slice(0, maxResults);
  const items = await Promise.all(
    topIds.map(id =>
      fetchWithTimeout(`${HN_API}/item/${id}.json`).then(r => r.json())
    )
  );
  return items as HNItem[];
}

async function fetchCategory(category: 'ask' | 'show' | 'job', maxResults = 10) {
  // askstories, showstories, jobstories
  const ids = await fetchWithTimeout(`${HN_API}/${category}stories.json`).then(r => r.json()) as number[];
  const topIds = ids.slice(0, maxResults);
  const items = await Promise.all(
    topIds.map(id =>
      fetchWithTimeout(`${HN_API}/item/${id}.json`).then(r => r.json())
    )
  );
  return items as HNItem[];
}

function formatItems(items: HNItem[], label: string) {
  const hoursAgo = (ts: number) => Math.round((Date.now() / 1000 - ts) / 3600);
  return {
    source: label,
    total: items.length,
    stories: items.map(item => ({
      title: item.title,
      url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
      by: item.by,
      points: item.score,
      comments: item.descendants || 0,
      hoursAgo: hoursAgo(item.time),
    })),
  };
}

export const hackerNewsTool: ToolDefinition = {
  name: 'hacker_news',
  description: `获取 Hacker News 热门内容。YC 旗下的科技社区，覆盖创业、编程、科技新闻。

完全免费，无需注册。

当用户问以下问题时调用:
- "最近科技圈/创投圈有什么新闻？"
- "Hacker News 上在讨论什么？"
- "最近有什么热门的创业项目？"(Show HN)
- "最近大家在问什么？"(Ask HN)
- "有什么好的招聘信息？"`,

  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',

  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['top', 'ask', 'show', 'job'],
        description: '类别: top=热门排行(默认), ask=问答, show=展示项目, job=招聘',
      },
      topN: {
        type: 'number',
        description: '返回条数，默认10，最大30',
        default: 10,
      },
    },
  },

  handler: async (args) => {
    const category = (args.category as string) || 'top';
    const topN = Math.min((args.topN as number) || 10, 30);

    try {
      if (category === 'top') {
        const items = await fetchTopStories(topN);
        return formatItems(items, 'Hacker News 热门');
      }
      if (category === 'ask' || category === 'show' || category === 'job') {
        const items = await fetchCategory(category, topN);
        const labels: Record<string, string> = { ask: 'Ask HN', show: 'Show HN', job: 'Jobs' };
        return formatItems(items, labels[category]);
      }
      const items = await fetchTopStories(topN);
      return formatItems(items, 'Hacker News 热门');
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : '获取失败' };
    }
  },
};
