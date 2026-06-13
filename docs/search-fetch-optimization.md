# 网站信息获取 — 完整优化方案

> 最后更新：2026-06-11
> 范围：搜索能力 + 内容抓取 + 数据处理，全链路优化

---

## 现状分析

### 当前搜索能力

```
AI 聊天 → 需要外部信息 → 调用 search_web 工具
                                    ↓
                          Tavily（付费，$0.01/次）
                          SerpAPI（付费，100次/月免费）
                                    ↓
                          返回：标题 + 一句话摘要 + URL
                                    ↓
                          AI 只能根据一句话摘要回答
```

### 现状问题

| 问题 | 说明 |
|------|------|
| 搜索依赖付费 API | Tavily / SerpAPI 有免费额度限制，用完就要钱 |
| 中文搜索能力弱 | 两个 API 对中文搜索结果质量一般 |
| 无内容深读能力 | 只拿到一句话摘要，AI 无法分析文章全文 |
| 数据单薄 | 每条结果只有 3 个字段（标题/摘要/URL），无评分、无日期、无来源 |
| 无回退机制 | API 挂了或额度用完，搜索直接失败 |

---

## 优化目标

```
优化后：
AI 聊天 → 需要外部信息 → 调用 search_web 工具
                                    ↓
                          SearXNG（免费，聚合 70+ 引擎）  ← 首选
                          DuckDuckGo（免费，无需配置）     ← 兜底
                          Tavily / SerpAPI（保留，最后回退）
                                    ↓
                          返回：标题 + 摘要 + URL + 评分 + 日期 + 来源引擎
                                    ↓
                          AI 觉得某条有价值 → 调用 fetch_content(url)
                                    ↓
                          Defuddle 提取完整 Markdown 正文（几千字）
                                    ↓
                          AI 基于完整文章深度分析、对比、总结
```

---

## 改动清单

### 一共改 4 个文件，新建 1 个文件

| 文件 | 操作 | 改动量 |
|------|------|--------|
| `backend/package.json` | 新增 3 个依赖 | 1 行命令 |
| `backend/.env` | 新增 1 个环境变量 | 1 行 |
| `backend/src/ai/tools/search-web.ts` | 新增 2 个搜索函数 + 回退逻辑 | ~80 行 |
| `backend/src/ai/tools/fetch-content.ts` | **新建**，网页内容提取工具 | ~60 行 |
| `backend/src/ai/tools/registry.ts` | 注册新工具 | +2 行 |

---

## 第一步：安装依赖

```bash
cd backend
npm install duck-duck-scrape defuddle jsdom
```

| 包名 | 用途 | 大小 |
|------|------|------|
| `duck-duck-scrape` | DuckDuckGo 搜索，零配置免费 | ~50KB |
| `defuddle` | 网页正文提取，输出 Markdown | ~100KB |
| `jsdom` | HTML 解析器，Defuddle 需要 | ~3MB |

---

## 第二步：环境变量

```bash
# backend/.env 新增一行（SearXNG 地址，装了就填，没装就留空）
SEARXNG_URL=
# 如果装了 SearXNG：SEARXNG_URL=http://localhost:8888
```

---

## 第三步：改造 search-web.ts

### 改动内容

1. 新增 `callSearXNG()` 函数
2. 新增 `callDuckDuckGo()` 函数
3. 新增数据清洗函数 `cleanResults()`
4. 改造 `handler`，实现多级回退

### 搜索回退策略

```
用户搜索请求
  │
  ├─ 策略 1：SearXNG（如果配置了 SEARXNG_URL）
  │   ↓ 失败或未配置
  ├─ 策略 2：用户配置的 API（Tavily 或 SerpAPI，如果配了 Key）
  │   ↓ 失败或未配置
  └─ 策略 3：DuckDuckGo（永远可用，零配置）
  │   ↓ 全部失败
  └─ 返回错误提示
```

### 新增代码说明

#### callSearXNG 函数

```typescript
const SEARXNG_URL = process.env.SEARXNG_URL || '';

async function callSearXNG(query: string, cfg: SearchConfig) {
  if (!SEARXNG_URL) throw new Error('SearXNG 未配置');

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    categories: cfg.topic === 'news' ? 'news' : 'general',
    language: 'auto',
    pageno: '1',
  });

  const res = await fetch(`${SEARXNG_URL}/search?${params}`, {
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`SearXNG HTTP ${res.status}`);

  const data = await res.json();
  return cleanResults(
    (data.results || []).map((r: any) => ({
      title: r.title || '',
      snippet: r.content?.slice(0, 300) || '',
      url: r.url || '',
      score: r.score || 0,
      date: r.publishedDate || null,
      engines: r.engines?.length || 1,
      source: 'searxng',
    })),
    cfg.maxResults,
  );
}
```

#### callDuckDuckGo 函数

```typescript
async function callDuckDuckGo(query: string, cfg: SearchConfig) {
  const { search } = await import('duck-duck-scrape');
  const results = await search(query, { safeSearch: -1 });

  return results.results.slice(0, cfg.maxResults).map(r => ({
    title: r.title || '',
    snippet: r.description?.slice(0, 300) || '',
    url: r.url || '',
    score: 0,
    date: null,
    engines: 1,
    source: 'duckduckgo',
  }));
}
```

#### 数据清洗函数

```typescript
interface CleanResult {
  title: string;
  snippet: string;
  url: string;
  score: number;
  date: string | null;
  engines: number;
  source: string;
}

function cleanResults(results: CleanResult[], max: number): CleanResult[] {
  return results
    .filter(r => r.title && r.url && r.snippet)         // 去掉空结果
    .filter(r => !r.url.includes('/ad'))                 // 去掉广告
    .reduce((acc, r) => {                                // 按 URL 去重
      if (!acc.some(x => x.url === r.url)) acc.push(r);
      return acc;
    }, [] as CleanResult[])
    .sort((a, b) => (b.score || 0) - (a.score || 0))    // 按评分排序
    .slice(0, max);
}
```

#### 改造后的 handler

```typescript
handler: async (args, userId) => {
  const query = args.query as string;
  const overrideMax = args.maxResults as number | undefined;
  const cfg = await getSearchConfig(userId);
  const resolvedCfg = { ...cfg, maxResults: overrideMax || cfg.maxResults };

  // 构建回退策略列表
  const strategies: Array<{ name: string; fn: () => Promise<CleanResult[]> }> = [];

  // 1. SearXNG（如果配置了地址）
  if (SEARXNG_URL) {
    strategies.push({ name: 'searxng', fn: () => callSearXNG(query, resolvedCfg) });
  }

  // 2. 用户配置的付费 API
  if (cfg.apiKey) {
    if (cfg.provider === 'serpapi') {
      strategies.push({ name: 'serpapi', fn: () => callSerpAPI(query, resolvedCfg) });
    } else {
      strategies.push({ name: 'tavily', fn: () => callTavily(query, resolvedCfg) });
    }
  }

  // 3. DuckDuckGo（兜底，永远加入）
  strategies.push({ name: 'duckduckgo', fn: () => callDuckDuckGo(query, resolvedCfg) });

  // 依次尝试
  for (const s of strategies) {
    try {
      const results = await s.fn();
      if (results.length > 0) {
        return {
          configured: true,
          provider: s.name,
          query,
          results,
          total: results.length,
          canDeepRead: true,  // 告诉 AI 可以用 fetch_content 深读
        };
      }
    } catch (err) {
      console.warn(`[Search] ${s.name} failed:`, err);
      continue;
    }
  }

  return { configured: true, error: '所有搜索源均失败', results: [] };
};
```

---

## 第四步：新建 fetch-content.ts

### 工具定义

```typescript
// backend/src/ai/tools/fetch-content.ts

import { ToolDefinition } from './types';

// ═══ 内容提取（Defuddle + Jina 兜底）═══

interface ExtractedContent {
  title: string;
  content: string;
  author: string | null;
  url: string;
  length: number;
  source: 'defuddle' | 'jina';
}

async function extractWithDefuddle(url: string): Promise<ExtractedContent> {
  const { default: Defuddle } = await import('defuddle');
  const { JSDOM } = await import('jsdom');

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(10_000),
    redirect: 'follow',
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();

  const result = new Defuddle(html, { url }).parse();

  if (!result.content || result.content.length < 100) {
    throw new Error('正文提取失败或内容过短');
  }

  return {
    title: result.title || '',
    content: result.content.slice(0, 10_000),  // 限制最大 10000 字符
    author: result.author || null,
    url,
    length: result.content.length,
    source: 'defuddle',
  };
}

async function extractWithJina(url: string): Promise<ExtractedContent> {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: { 'Accept': 'text/markdown' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`Jina HTTP ${response.status}`);
  const content = await response.text();

  if (!content || content.length < 100) {
    throw new Error('Jina 返回内容过短');
  }

  // Jina 返回的第一行通常是标题
  const lines = content.split('\n');
  const title = lines[0]?.replace(/^#\s*/, '').trim() || '';

  return {
    title,
    content: content.slice(0, 10_000),
    author: null,
    url,
    length: content.length,
    source: 'jina',
  };
}

// ═══ Tool 定义 ═══

export const fetchContentTool: ToolDefinition = {
  name: 'fetch_content',
  description: `读取网页完整正文内容。当 search_web 返回的结果摘要不够详细时调用。

使用时机:
- search_web 某条结果看起来很有价值，需要深入阅读
- 用户需要对比某篇文章的完整数据（表格、列表、详细分析）
- 需要提取网页中的具体数字、报价、评测结论

不使用时机:
- search_web 的摘要已经够用
- 用户只是泛泛地问问题，不需要深读某篇文章
- 搜索结果已经提供了足够的信息`,
  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'balanced',

  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: '要读取的网页 URL',
      },
    },
    required: ['url'],
  },

  handler: async (args) => {
    const url = args.url as string;

    if (!url.startsWith('http')) {
      return { error: '无效的 URL，需要以 http:// 或 https:// 开头' };
    }

    // 策略：Defuddle 本地提取 → Jina API 兜底
    const strategies = [
      { name: 'defuddle', fn: () => extractWithDefuddle(url) },
      { name: 'jina', fn: () => extractWithJina(url) },
    ];

    for (const s of strategies) {
      try {
        const result = await s.fn();
        return {
          success: true,
          ...result,
          note: `提取方式: ${s.name}，正文长度: ${result.length} 字符`,
        };
      } catch (err) {
        console.warn(`[FetchContent] ${s.name} failed for ${url}:`, err);
        continue;
      }
    }

    return {
      success: false,
      error: '网页内容提取失败（Defuddle 和 Jina 均失败），可能原因：网页需要登录、被反爬拦截、或内容为纯 JS 渲染',
      url,
    };
  },
};
```

---

## 第五步：注册新工具

在 `backend/src/ai/tools/registry.ts` 中添加：

```typescript
// 新增 import
import { fetchContentTool } from './fetch-content';

// 在 allTools 数组的 search 区域添加
// 🔍 search
searchWebTool, fetchContentTool, githubTrendingTool, hackerNewsTool, npmSearchTool,
exchangeRateTool, devToTool, productHuntTool,
```

---

## 数据处理全链路

### 完整流程图

```
用户提问："帮我分析一下 2025 年主流项目管理工具的价格"
  │
  ▼
┌─ AI 模型判断：本地数据库没有行业对比数据，需要搜索 ─┐
│                                                      │
│  调用 search_web("2025 项目管理工具 价格对比")         │
└──────────────────────────────────────────────────────┘
  │
  ▼
┌─ 搜索执行（多级回退）───────────────────────────────┐
│  SearXNG → 聚合 Google/Bing/百度 结果               │
│  失败？→ Tavily / SerpAPI                           │
│  失败？→ DuckDuckGo                                 │
└──────────────────────────────────────────────────────┘
  │
  ▼
┌─ 数据清洗（cleanResults）────────────────────────────┐
│  去掉空结果 → 去广告 → 按 URL 去重 → 按评分排序       │
│  返回 5 条，每条包含：                                │
│    { title, snippet(300字), url, score, date, engines }│
└──────────────────────────────────────────────────────┘
  │
  ▼
┌─ 结果截断（ai.service.ts truncateResult）────────────┐
│  超过 500 字符？→ 截断                               │
│  超过 5 条？→ 只返回前 5 条 + total 提示              │
└──────────────────────────────────────────────────────┘
  │
  ▼
┌─ AI 模型分析搜索结果 ────────────────────────────────┐
│  "这 5 条结果的摘要都比较简略，                        │
│   第 1 条看起来是详细评测文章，我需要深读"              │
└──────────────────────────────────────────────────────┘
  │
  ▼
┌─ AI 调用 fetch_content("https://example.com/review")─┐
│                                                      │
│  Defuddle 本地提取                                    │
│  ├─ 请求网页 HTML（10 秒超时）                         │
│  ├─ 剥离导航栏/广告/侧边栏/页脚                       │
│  ├─ 提取正文，转为 Markdown                           │
│  └─ 返回 5000 字正文                                  │
│                                                      │
│  失败？→ Jina API 兜底                                │
│  ├─ 请求 https://r.jina.ai/URL                       │
│  └─ 返回干净 Markdown                                 │
└──────────────────────────────────────────────────────┘
  │
  ▼
┌─ AI 综合分析 ────────────────────────────────────────┐
│  搜索摘要（5 条 × 300 字）+ 完整正文（5000 字）       │
│  + 用户本地数据（项目/成本/任务）                      │
│                                                      │
│  → 输出深度对比分析：                                  │
│    "根据行业评测文章，Jira 价格 $8/人/月，             │
│     您当前项目使用飞书（免费），成本低于市场...          │
│     建议关注 Notion 的协作功能，适合您的团队规模..."     │
└──────────────────────────────────────────────────────┘
```

### 每步数据量变化

| 阶段 | 数据量 | 格式 |
|------|--------|------|
| 搜索返回原始数据 | 30-50 条，每条约 50 字段 | JSON，含冗余和空值 |
| 数据清洗后 | 5-15 条，每条 6 字段 | JSON，干净统一 |
| 截断后（给 AI） | 5 条，每条 300 字摘要 | JSON，精简 |
| 深读后（给 AI） | 1-3 篇，每篇 5000-10000 字 | Markdown 正文 |
| AI 分析后（给用户） | 一段结构化回答 | Markdown 渲染 |

---

## 不需要改动的部分

| 文件 | 为什么不动 |
|------|-----------|
| `ai.service.ts` | 截断逻辑和工具调用循环不变，新工具返回格式兼容 |
| 前端所有文件 | 搜索设置页面如果已有，只需改下拉选项（可选） |
| 数据库 Schema | 不新增表，搜索配置存在现有 Setting 表 |
| 其他 AI 工具 | GitHub/HN/Dev.to 等不变 |
| 定时任务 | 不涉及 |
| `search.service.ts` | 这是业务搜索记录，和 AI 工具搜索无关 |

---

## 费用变化

| | 优化前 | 优化后 |
|--|--------|--------|
| **搜索费用** | Tavily $0.01/次 | SearXNG $0 + DuckDuckGo $0 |
| **内容提取** | 没有这个能力 | Defuddle $0 + Jina 免费 |
| **月均费用（1000 次搜索）** | ~$10-20 | **$0** |
| **深读能力** | ❌ | ✅ 可读取任意网页全文 |
| **中文搜索** | ⚠️ 差 | ✅ 好（SearXNG 聚合百度/必应） |

---

## 效果对比

### 优化前

```
用户："帮我分析 2025 年项目管理工具的价格"

AI 回答（基于一句话摘要）：
"根据搜索结果，2025 年主流项目管理工具包括 Jira、Notion、飞书等。
 具体价格信息建议您访问相关官网查看。"
```

### 优化后

```
用户："帮我分析 2025 年项目管理工具的价格"

AI 回答（基于搜索摘要 + 完整评测文章）：
"根据最新行业评测数据，2025 年主流项目管理工具价格如下：

| 工具 | 价格 | 适合规模 | 您的匹配度 |
|------|------|---------|-----------|
| Jira | $8/人/月 | 中大型团队 | ⭐⭐ |
| Notion | $10/人/月 | 小型团队 | ⭐⭐⭐ |
| 飞书 | 免费-15元/人/月 | 各规模 | ⭐⭐⭐⭐ |
| ClickUp | $7/人/月 | 小型团队 | ⭐⭐⭐ |

您当前使用飞书且团队 5 人以下，成本为零，高于市场平均水平。
如果后续扩展到 10 人以上，建议评估 Notion 的知识库功能..."
```

---

## 后续可扩展（本次不做）

| 方向 | 说明 |
|------|------|
| SearXNG 自托管 | 装 Docker 后一行命令启动，搜索能力再升级 |
| Brave Search API | $5/月，独立搜索引擎，结果质量最高 |
| Daily Hot News API | 23 个中文平台热点聚合，免费 |
| bb-browser | 50+ 平台统一接入，MCP Server |
| 缓存层 | 热门查询结果缓存 10 分钟，减少重复调用 |
