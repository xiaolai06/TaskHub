import { ToolDefinition } from './types';

// ═══ 搜索结果质量门 ═══
// 共享模块：过滤垃圾 → 去重 → 限域名 → 打分 → 排序

// ─── 接口定义 ───

export interface RawSearchResult {
  title: string;
  snippet: string;
  url: string;
  source?: string;
  published?: string;
  publishedDate?: string;
}

export interface ScoredResult extends RawSearchResult {
  score: number;
  sourceType: string;
}

export interface QualityMeta {
  tool: string;
  query: string;
  totalRaw: number;
  returned: number;
  filtered: number;
  avgScore: number;
  sourceDistribution: Record<string, number>;
}

export interface QualityGateOutput {
  results: ScoredResult[];
  meta: QualityMeta;
}

// ─── 垃圾域名黑名单 ───

const AD_DOMAINS = new Set([
  'ad.', 'ads.', 'promo.', 'click.', 'track.',
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'facebook.com/ads', 'amazon.com/gp/redirect',
]);

const SPAM_PATTERNS = [
  /百家号/, /百度推广/, /搜狗推广/, /广告/,
  /ad\.baidu/, /pos\.baidu/,
];

// ─── 来源分类 ───

const AUTHORITY_DOMAINS: Record<string, string> = {
  'gov.cn': '官方', 'gov.': '官方', '.org': '官方',
  'microsoft.com': '官方', 'apple.com': '官方', 'google.com': '官方',
  'github.com': '官方', 'npmjs.com': '官方', 'pypi.org': '官方',
  'reactjs.org': '官方', 'vuejs.org': '官方', 'angular.io': '官方',
  'nodejs.org': '官方', 'typescriptlang.org': '官方',
  'openai.com': '官方', 'anthropic.com': '官方',
};

const MEDIA_DOMAINS: Record<string, string> = {
  '36kr.com': '媒体', 'ithome.com': '媒体', 'sina.com': '媒体',
  'sohu.com': '媒体', '163.com': '媒体', 'qq.com': '媒体',
  'ifeng.com': '媒体', 'thepaper.cn': '媒体', 'jiemian.com': '媒体',
  'bbc.com': '媒体', 'cnn.com': '媒体', 'reuters.com': '媒体',
  'techcrunch.com': '媒体', 'theverge.com': '媒体', 'wired.com': '媒体',
};

const COMMUNITY_DOMAINS: Record<string, string> = {
  'zhihu.com': '社区', 'csdn.net': '社区', 'cnblogs.com': '社区',
  'v2ex.com': '社区', 'segmentfault.com': '社区', 'juejin.cn': '社区',
  'stackoverflow.com': '社区', 'reddit.com': '社区', 'dev.to': '社区',
  'medium.com': '社区', 'hackernews': '社区', 'news.ycombinator.com': '社区',
};

const FORUM_DOMAINS: Record<string, string> = {
  'tieba.baidu.com': '论坛', 'bbs.': '论坛', 'forum.': '论坛',
  'douban.com': '论坛', 'weibo.com': '论坛',
};

// ─── 工具函数 ───

function getDomain(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

function classifySource(url: string): string {
  const domain = getDomain(url);
  if (!domain) return '未知';

  for (const [key, type] of Object.entries(AUTHORITY_DOMAINS)) {
    if (domain.includes(key)) return type;
  }
  for (const [key, type] of Object.entries(MEDIA_DOMAINS)) {
    if (domain.includes(key)) return type;
  }
  for (const [key, type] of Object.entries(COMMUNITY_DOMAINS)) {
    if (domain.includes(key)) return type;
  }
  for (const [key, type] of Object.entries(FORUM_DOMAINS)) {
    if (domain.includes(key)) return type;
  }
  return '博客';
}

function isAdDomain(url: string): boolean {
  const lower = url.toLowerCase();
  for (const ad of AD_DOMAINS) {
    if (lower.includes(ad)) return true;
  }
  return false;
}

function isSpamTitle(title: string): boolean {
  return SPAM_PATTERNS.some(p => p.test(title));
}

function extractQueryKeywords(query: string): string[] {
  // 分词：按空格、标点拆分，过滤太短的词
  return query
    .toLowerCase()
    .split(/[\s,，.。!！?？、;；:：/\\]+/)
    .filter(w => w.length >= 2);
}

function countKeywordHits(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter(kw => lower.includes(kw)).length;
}

// ─── 打分算法（加权模型）───
//
// 每个维度归一化到 0~1，乘以权重，最终加权求和 × 100 = 0~100 分
//
// 权重分配（按重要程度）:
//   标题相关性   0.30  — 最直接的相关性信号
//   来源权威度   0.25  — 信任度/质量保障
//   摘要相关性   0.15  — 二次验证相关性
//   内容页判定   0.10  — 文章页比首页更有价值
//   摘要丰富度   0.10  — 信息量足够才有用
//   时效性       0.05  — 有日期比没有好
//   论坛惩罚    -0.05  — 论坛质量偏低（负权重）

interface WeightConfig {
  titleRelevance: number;  // 标题命中关键词的比率
  sourceAuthority: number; // 来源网站权威度
  snippetRelevance: number;// 摘要命中关键词的比率
  isArticlePage: number;   // URL 是否是文章详情页
  snippetRichness: number; // 摘要信息量
  hasDate: number;         // 是否有发布日期
  forumPenalty: number;    // 论坛/低质量来源惩罚
}

const WEIGHTS: WeightConfig = {
  titleRelevance:  0.30,
  sourceAuthority: 0.25,
  snippetRelevance:0.15,
  isArticlePage:   0.10,
  snippetRichness: 0.10,
  hasDate:         0.05,
  forumPenalty:   -0.05,
};

// 来源权威度评分表（0~1）
function authorityScore(url: string): number {
  const type = classifySource(url);
  switch (type) {
    case '官方': return 1.0;   // gov / 官方文档 / 大厂官网
    case '媒体': return 0.8;   // 36kr / ithome / 新闻媒体
    case '社区': return 0.5;   // 知乎 / csdn / stackoverflow
    case '博客': return 0.4;   // 个人博客、未知域名
    case '论坛': return 0.2;   // 贴吧、论坛
    default:     return 0.3;
  }
}

// 摘要丰富度评分（0~1）
function snippetRichnessScore(len: number): number {
  if (len >= 150) return 1.0;   // 信息量充足
  if (len >= 80)  return 0.7;   // 信息量较好
  if (len >= 40)  return 0.4;   // 基本可用
  if (len >= 20)  return 0.2;   // 勉强有用
  return 0.0;                   // 太短，无价值
}

function scoreResult(result: RawSearchResult, query: string): number {
  const keywords = extractQueryKeywords(query);
  if (keywords.length === 0) return 50; // 无关键词时给中间分

  // 1. 标题相关性（0~1）：命中关键词数 / 总关键词数
  const titleHits = countKeywordHits(result.title, keywords);
  const dTitleRelevance = Math.min(titleHits / keywords.length, 1.0);

  // 2. 来源权威度（0~1）
  const dSourceAuthority = authorityScore(result.url);

  // 3. 摘要相关性（0~1）：命中关键词数 / 总关键词数
  const snippetHits = countKeywordHits(result.snippet, keywords);
  const dSnippetRelevance = Math.min(snippetHits / keywords.length, 1.0);

  // 4. 内容页判定（0 或 1）
  const path = (() => { try { return new URL(result.url).pathname; } catch { return ''; } })();
  const dIsArticlePage = /\/(article|post|p|blog|news|detail|content|doc|guide|tutorial)\//i.test(path) ? 1 : 0;

  // 5. 摘要丰富度（0~1）
  const dSnippetRichness = snippetRichnessScore(result.snippet.length);

  // 6. 时效性（0 或 1）
  const dHasDate = (result.published || result.publishedDate) ? 1 : 0;

  // 7. 论坛惩罚（0 或 1）— 值越高越惩罚
  const sourceType = classifySource(result.url);
  const dForumPenalty = sourceType === '论坛' ? 1 : 0;

  // 加权求和
  const raw =
    dTitleRelevance   * WEIGHTS.titleRelevance +
    dSourceAuthority  * WEIGHTS.sourceAuthority +
    dSnippetRelevance * WEIGHTS.snippetRelevance +
    dIsArticlePage    * WEIGHTS.isArticlePage +
    dSnippetRichness  * WEIGHTS.snippetRichness +
    dHasDate          * WEIGHTS.hasDate +
    dForumPenalty     * WEIGHTS.forumPenalty;  // 负权重，自动扣分

  // raw 范围约 [-0.05, 0.95]，映射到 0~100
  const score = Math.round(Math.max(0, Math.min(1, (raw + 0.05) / 1.0)) * 100);
  return score;
}

// ─── 核心：质量门处理 ───

export function applySearchQualityGate(
  results: RawSearchResult[],
  query: string,
  toolName: string,
  maxResults: number = 6,
): QualityGateOutput {
  const totalRaw = results.length;

  // Step 1: 过滤垃圾
  const filtered = results.filter(r => {
    // 无标题或标题过短
    if (!r.title || r.title.trim().length < 3) return false;
    // 无摘要或摘要过短
    if (!r.snippet || r.snippet.trim().length < 15) return false;
    // 广告域名
    if (isAdDomain(r.url)) return false;
    // 垃圾标题
    if (isSpamTitle(r.title)) return false;
    // 无效 URL
    if (!r.url || !r.url.startsWith('http')) return false;
    return true;
  });

  // Step 2: URL 去重
  const seen = new Set<string>();
  const deduped = filtered.filter(r => {
    const key = r.url.split('?')[0]; // 去掉 query string 去重
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Step 3: 打分
  const scored: ScoredResult[] = deduped.map(r => ({
    ...r,
    score: scoreResult(r, query),
    sourceType: classifySource(r.url),
  }));

  // Step 4: 排序（高分优先）
  scored.sort((a, b) => b.score - a.score);

  // Step 5: 同域名限制（最多 2 条）
  const domainCount = new Map<string, number>();
  const limited: ScoredResult[] = [];
  for (const r of scored) {
    const domain = getDomain(r.url);
    const count = domainCount.get(domain) || 0;
    if (count >= 2) continue;
    domainCount.set(domain, count + 1);
    limited.push(r);
    if (limited.length >= maxResults) break;
  }

  // Step 6: 构建 meta
  const sourceDistribution: Record<string, number> = {};
  for (const r of limited) {
    sourceDistribution[r.sourceType] = (sourceDistribution[r.sourceType] || 0) + 1;
  }

  const avgScore = limited.length > 0
    ? Math.round(limited.reduce((s, r) => s + r.score, 0) / limited.length)
    : 0;

  return {
    results: limited,
    meta: {
      tool: toolName,
      query,
      totalRaw,
      returned: limited.length,
      filtered: totalRaw - limited.length,
      avgScore,
      sourceDistribution,
    },
  };
}
