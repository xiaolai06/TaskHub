import { ToolDefinition } from './types';
import { fetchWithTimeout } from './fetch-with-timeout';

// ═══ 中文平台热点聚合 ═══
// orz.ai API — 免费、无限、无需 Key
// 覆盖 23 个平台：微博/知乎/B站/豆瓣/掘金/虎扑/雪球/36氪/今日头条...

const ORZ_API = 'https://orz.ai/api/v1/dailynews/';

// 支持的平台列表
const PLATFORMS: Record<string, string> = {
  weibo: '微博',
  zhihu: '知乎',
  bilibili: 'B站',
  douban: '豆瓣',
  juejin: '掘金',
  hupu: '虎扑',
  douyin: '抖音',
  v2ex: 'V2EX',
  toutiao: '今日头条',
  '36kr': '36氪',
  xueqiu: '雪球',
  github: 'GitHub',
  hackernews: 'Hacker News',
  stackoverflow: 'StackOverflow',
  baidu: '百度',
  sina: '新浪财经',
  eastmoney: '东方财富',
  tencent: '腾讯新闻',
  douban_group: '豆瓣小组',
  tieba: '百度贴吧',
  ithome: 'IT之家',
  sspai: '少数派',
  cls: '财联社',
};

interface HotItem {
  title: string;
  url: string;
  hot: string | number;
  description?: string;
}

// ═══ Tool 定义 ═══

export const searchDailyHotTool: ToolDefinition = {
  name: 'search_daily_hot',
  description: `获取中文平台今日热点。免费、无限次调用、无需 API Key。
覆盖 23 个平台的实时热搜/热榜。

使用时机:
- "今天有什么热点？"、"最近大家都在讨论什么？"
- "微博热搜"、"知乎热榜"、"B站热门"、"掘金热文"
- "行业动态"、"科技圈热点"、"财经热点"
- 需要了解社会舆论/行业风向

支持平台:
weibo(微博) zhihu(知乎) bilibili(B站) douban(豆瓣) juejin(掘金)
hupu(虎扑) douyin(抖音) v2ex(V2EX) toutiao(今日头条) 36kr(36氪)
xueqiu(雪球) github(GitHub) baidu(百度) sina(新浪财经) eastmoney(东方财富)
ithome(IT之家) sspai(少数派) cls(财联社)

不使用时机:
- 搜索具体问题/事实 → 用 search_searxng 或 search_sogou
- 搜索英文内容 → 用 search_duckduckgo
- 搜索新闻报道 → 用 search_google_news
- 搜索宏观经济数据 → 用 search_world_bank

返回数据: 热点列表含 title/url/hot(热度)，支持 platform+maxResults 参数`,
  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'fast',

  parameters: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        description: `平台标识，默认 weibo。可选值: ${Object.keys(PLATFORMS).join(', ')}`,
        default: 'weibo',
      },
      maxResults: {
        type: 'number',
        description: '返回条数，默认 15，最大 50',
        default: 15,
      },
    },
  },

  handler: async (args) => {
    const platform = ((args.platform as string) || 'weibo').toLowerCase();
    const maxResults = Math.min((args.maxResults as number) || 15, 50);

    if (!PLATFORMS[platform]) {
      return {
        error: `不支持的平台: ${platform}`,
        supportedPlatforms: Object.entries(PLATFORMS).map(([k, v]) => `${k}(${v})`),
      };
    }

    try {
      const url = `${ORZ_API}?platform=${platform}`;
      const res = await fetchWithTimeout(url, {}, 15_000);

      if (!res.ok) throw new Error(`orz.ai HTTP ${res.status}`);
      const data = await res.json() as any;

      const items: HotItem[] = (data.data || data.items || []).slice(0, maxResults).map((r: any) => ({
        title: r.title || r.name || '',
        url: r.url || r.link || '',
        hot: r.hot || r.index || 0,
        description: r.desc || r.description || '',
      }));

      return {
        source: 'orz.ai',
        platform,
        platformName: PLATFORMS[platform],
        total: items.length,
        items,
        note: `数据来源: ${PLATFORMS[platform]} 热榜，免费无限，无需 API Key`,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '热点获取失败';
      return { error: message };
    }
  },
};
