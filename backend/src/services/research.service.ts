import { prisma } from '../server';

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
  ]);

  for (const s of settled) {
    if (s.status === 'fulfilled') results.push(...s.value);
  }

  // 过滤 + 去重 + 排序
  const filtered = results
    .filter(isValidResult)
    .filter((r, i, arr) => arr.findIndex(x => x.url === r.url) === i)
    .sort((a, b) => (b.heat || 0) - (a.heat || 0));

  saveSearchResults(userId, q, filtered.slice(0, 20)).catch(() => {});

  return filtered.slice(0, 20);
}

// ═══ 内容校验 ═══

function isValidResult(item: SearchResultItem): boolean {
  if (!item.title || item.title.length < 2 || item.title.length > 300) return false;
  if (!item.snippet || item.snippet.length < 10) return false;
  if (item.url && !item.url.startsWith('http')) return false;
  // 过滤纯垃圾字符：不可打印字符超过 5% 就丢弃
  const combined = item.title + item.snippet;
  const garbage = combined.match(/[^\x20-\x7E一-鿿　-〿＀-￯\n\r\t]/g);
  if (garbage && garbage.length > combined.length * 0.05) return false;
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
      { headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'TaskFlow-AI/1.0' } },
    );
    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data.items || []).map((r: any) => ({
      title: r.full_name,
      snippet: r.description || '(无描述)',
      url: r.html_url,
      source: 'github',
      heat: Math.min(100, r.stargazers_count / 500),
      extra: `⭐ ${r.stargazers_count?.toLocaleString()}`,
    }));
  } catch { return []; }
}

// ═══ Hacker News (Algolia 搜索 API) ═══

async function searchHNAlgolia(query: string): Promise<SearchResultItem[]> {
  try {
    const res = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=8&tags=story`,
    );
    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data.hits || []).map((h: any) => ({
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
    );
    if (!res.ok) return [];
    const articles = await res.json() as any[];

    // 本地关键词匹配过滤
    const keywords = query.toLowerCase().split(/\s+/);
    return articles
      .filter(a => {
        const text = ((a.title || '') + ' ' + (a.tag_list || []).join(' ') + ' ' + (a.description || '')).toLowerCase();
        return keywords.some(kw => text.includes(kw)) || keywords.length === 1 && text.includes(query.toLowerCase());
      })
      .slice(0, 5)
      .map(a => ({
        title: a.title,
        snippet: (a.description || '').slice(0, 200) || `${a.reading_time_minutes} min read`,
        url: a.url,
        source: 'devto',
        heat: Math.min(100, (a.positive_reactions_count || 0) / 3),
        extra: `❤️ ${a.positive_reactions_count || 0}`,
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

export async function clearHistory(userId: string) {
  await prisma.searchResult.deleteMany({ where: { userId } });
  return { cleared: true };
}

// ═══ 收藏管理 ═══

export async function getSaved(userId: string, tag?: string) {
  const where: Record<string, any> = { userId };
  if (tag) where.tags = { contains: tag };
  return prisma.savedResearch.findMany({ where, orderBy: { createdAt: 'desc' } });
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
