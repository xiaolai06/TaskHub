# 搜索能力扩展 — 开源 Skills 引入评估

> 最后更新：2026-06-11
> 目标：评估可引入的开源搜索 Skills，扩展 TaskFlow+ 的外部数据获取能力

---

## 现状分析

当前项目已集成的搜索/数据源：

| 数据源 | 类型 | 免费？ | 覆盖领域 |
|--------|------|--------|---------|
| Tavily API | Web 搜索 | ❌ 按量付费 | 通用网页搜索 |
| SerpAPI | Google SERP | ❌ 100次/月免费 | 通用网页搜索 |
| GitHub API | 代码仓库 | ✅ 有限频 | 开发者工具 |
| Hacker News | 技术社区 | ✅ | 技术资讯 |
| Dev.to | 技术博客 | ✅ | 开发者文章 |
| npm Registry | 包搜索 | ✅ | 前端生态 |
| Product Hunt | 产品发现 | ❌ 100次/天 | 新产品 |
| 汇率 API | 金融数据 | ✅ | 金融 |

**核心问题**：
1. **搜索过度依赖付费 API**（Tavily/SerpAPI），免费额度有限
2. **中文搜索能力缺失**（无百度/微博/知乎等）
3. **缺乏学术搜索**（无数论文/论文数据库）
4. **信息源分散**，每个数据源独立实现，无统一抽象层
5. **无 URL 内容提取能力**（搜到了但无法抓取正文）

---

## 推荐引入方案（按优先级排序）

### ⭐ 第一优先级：立即价值 + 低成本

#### 1. SearXNG — 自托管元搜索引擎（强烈推荐）

| 项目 | 详情 |
|------|------|
| GitHub | https://github.com/searxng/searxng |
| Stars | 15,000+ |
| 协议 | AGPL-3.0 |
| 部署 | Docker 一键部署 |
| Node.js 集成 | REST API：`/search?format=json&q=...` |
| 费用 | **完全免费**（自托管） |

**核心价值**：聚合 70+ 搜索引擎（Google、Bing、DuckDuckGo 等），一个 API 替代 Tavily + SerpAPI。支持分类搜索（通用/新闻/图片/视频/学术）。

**集成方式**：
```typescript
// backend/src/ai/tools/search-web.ts
async function searchWithSearXNG(query: string, category = 'general') {
  const res = await fetch(
    `${SEARXNG_URL}/search?format=json&q=${encodeURIComponent(query)}&categories=${category}`
  );
  const data = await res.json();
  return data.results.map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
    source: r.engine,
  }));
}
```

**替代方案**：作为 Tavily/SerpAPI 的免费后备，不删除现有集成，优先用 SearXNG，失败时回退到付费 API。

---

#### 2. DuckDuckGo — 零成本后备搜索（强烈推荐）

| 项目 | 详情 |
|------|------|
| npm 包 | `duck-duck-scrape` |
| API Key | **不需要** |
| 费用 | **完全免费** |
| 能力 | 网页、图片、新闻搜索 |

**核心价值**：零配置、零成本的搜索后备。当 SearXNG 和付费 API 都不可用时，保底方案。

**集成方式**：
```typescript
import { search } from 'duck-duck-scrape';

async function searchDuckDuckGo(query: string) {
  const results = await search(query);
  return results.results.map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.description,
  }));
}
```

---

#### 3. Daily Hot News API — 中文平台热点聚合（强烈推荐）

| 项目 | 详情 |
|------|------|
| 端点 | `https://orz.ai/api/v1/dailynews/?platform=PLATFORM` |
| API Key | **不需要** |
| 费用 | **完全免费** |
| 覆盖 | **23 个平台** |

**支持平台一览**：

| 类别 | 平台 |
|------|------|
| 中文社交 | 微博、知乎、B站、豆瓣、虎扑、抖音、小红书 |
| 中文资讯 | 百度、今日头条、36氪、腾讯新闻、微信 |
| 中文金融 | 新浪财经、东方财富、雪球 |
| 中文技术 | 掘金、V2EX、CSDN |
| 国际 | GitHub Trending、Hacker News、StackOverflow |

**集成方式**：
```typescript
// 各平台统一接口
async function getDailyHot(platform: string) {
  const res = await fetch(`https://orz.ai/api/v1/dailynews/?platform=${platform}`);
  return res.json(); // { data: [{ title, url, hot, ... }] }
}

// 使用示例
const weiboHot = await getDailyHot('weibo');
const zhihuHot = await getDailyHot('zhihu');
const githubHot = await getDailyHot('github');
```

**应用场景**：晨间简报、行业资讯推送、AI 聊天的知识补充。

---

#### 4. Brave Search API — 最佳全能替代

| 项目 | 详情 |
|------|------|
| 官网 | https://brave.com/search/api/ |
| npm 包 | `brave-search` |
| 费用 | **$5 免信用额度/月**（约 1,000 次查询） |
| 超出 | $5/1,000 次 |
| MCP 官方 | `@brave/brave-search-mcp-server` |

**覆盖端点**：
- `web_search` — 网页搜索
- `brave_news_search` — 新闻搜索
- `brave_image_search` — 图片搜索
- `brave_video_search` — 视频搜索
- `brave_local_search` — 本地商家
- `brave_place_search` — 地点搜索
- `brave_llm_context` — LLM 优化上下文

**核心价值**：独立搜索引擎（不依赖 Google/Bing），反 SEO 垃圾优化好。一个 API Key 覆盖所有搜索场景。

**集成方式**：
```typescript
// 统一搜索接口
async function searchBrave(query: string, type = 'web') {
  const endpoint = {
    web: '/res/v1/web/search',
    news: '/res/v1/news/search',
    images: '/res/v1/images/search',
  }[type];

  const res = await fetch(`https://api.search.brave.com${endpoint}?q=${encodeURIComponent(query)}`, {
    headers: { 'X-Subscription-Token': BRAVE_API_KEY },
  });
  return res.json();
}
```

---

#### 5. OmniSearch SDK — 统一搜索抽象层（强烈推荐）

| 项目 | 详情 |
|------|------|
| GitHub | https://github.com/PlustOrg/search-sdk |
| npm | `@plust/search-sdk` |
| 协议 | 开源 |
| 语言 | TypeScript |

**统一接口**：一个 `webSearch()` 函数，背后支持 9 个搜索供应商切换：

```
Google Custom Search | SerpAPI | Brave Search | Exa
Tavily | SearXNG | Arxiv | DuckDuckGo | Perplexity
```

**集成价值**：将当前分散的搜索实现统一到一个抽象层，切换供应商只需改配置，不改业务代码。

```typescript
import { OmniSearch } from '@plust/search-sdk';

const search = new OmniSearch({
  provider: 'searxng', // 或 'brave', 'tavily', 'duckduckgo'...
  apiKey: process.env.SEARCH_API_KEY,
  baseUrl: process.env.SEARXNG_URL,
});

// 统一调用，不管底层是哪个供应商
const results = await search.webSearch('项目管理最佳实践');
```

---

### ⭐ 第二优先级：高价值 + 中等成本

#### 6. Jina AI Reader — 网页内容提取

| 项目 | 详情 |
|------|------|
| GitHub | https://github.com/jina-ai/reader |
| Stars | 22,000+ |
| 协议 | Apache-2.0 |
| 费用 | **免费**（基础版无需 API Key） |
| 使用 | 任意 URL 前加 `https://r.jina.ai/` |

**核心价值**：搜索只返回标题和摘要，Jina 可以抓取完整正文并转为 LLM 友好的 Markdown。搜索 + 抓取组合才能实现真正的深度研究。

```typescript
async function fetchAsMarkdown(url: string) {
  const res = await fetch(`https://r.jina.ai/${url}`);
  return res.text(); // 干净的 Markdown 文本
}
```

---

#### 7. bb-browser — 50+ 平台统一接入（瑞士军刀）

| 项目 | 详情 |
|------|------|
| GitHub | https://github.com/epiral/bb-browser |
| Stars | ~5,000 |
| 协议 | MIT |
| MCP | ✅ 内置 MCP Server |

**覆盖平台**：

| 类别 | 平台 |
|------|------|
| 搜索 | Google、百度、Bing、DuckDuckGo、搜狗微信 |
| 社交 | Twitter/X、Reddit、微博、小红书、知乎、LinkedIn、虎扑 |
| 资讯 | BBC、路透社、36氪、今日头条、东方财富 |
| 开发 | GitHub、StackOverflow、HackerNews、CSDN、V2EX、Dev.to、npm、PyPI、arXiv |
| 知识 | Wikipedia、知乎、Open Library |
| 金融 | 雪球、东方财富、Yahoo Finance |

**核心价值**：一个工具接入 50+ 平台，基于浏览器自动化，利用现有 Chrome 登录态。可替代大量独立 API 集成。

---

#### 8. Wikipedia API — 免费知识库

| 项目 | 详情 |
|------|------|
| API | `https://en.wikipedia.org/w/api.php` |
| npm | `wikijs` |
| 费用 | **完全免费** |
| 用途 | 概念解释、背景知识、技术术语查询 |

---

#### 9. StackOverflow API — 开发者 Q&A

| 项目 | 详情 |
|------|------|
| API | `https://api.stackexchange.com/2.3/` |
| npm | `stackexchange` |
| 免费额度 | 300 次/天（无 Key），10,000 次/天（有 Key） |
| 用途 | 技术问题解答、代码示例 |

---

#### 10. Semantic Scholar API — 学术论文搜索

| 项目 | 详情 |
|------|------|
| API | `https://api.semanticscholar.org/graph/v1/` |
| 免费额度 | 100 次/5 分钟（未认证），1 次/秒（认证） |
| 用途 | AI/ML 论文、项目管理研究、引用图谱 |

---

### ⭐ 第三优先级：专业化方向

| 工具 | 用途 | 费用 | 推荐度 |
|------|------|------|--------|
| **Perplexica/Vane** | AI 摘要搜索（带引用） | 免费自托管 | ⭐⭐⭐ |
| **Baidu AI Search Proxy** | 百度搜索接入 | 免费自托管 | ⭐⭐⭐ |
| **arXiv API** | 学术论文 | 免费 | ⭐⭐ |
| **NewsAPI** | 综合新闻 | 100次/天免费 | ⭐⭐ |
| **Firecrawl** | 深度网页抓取 | 自托管免费 | ⭐⭐ |
| **GDELT** | 全球事件数据库 | 免费 | ⭐ |
| **Serper.dev** | Google SERP（最便宜） | $0.30/1K次 | ⭐⭐ |

---

## 集成架构建议

### 统一搜索服务设计

```
backend/src/services/search-engine.service.ts
  │
  ├─ Provider 抽象层（统一接口）
  │   ├─ SearXNG（自托管，免费，首选）
  │   ├─ Brave Search（云端，备用）
  │   ├─ DuckDuckGo（免费，兜底）
  │   ├─ Tavily（现有保留）
  │   └─ SerpAPI（现有保留）
  │
  ├─ 内容提取层
  │   ├─ Jina AI Reader（URL → Markdown）
  │   └─ Firecrawl（深度抓取）
  │
  └─ 平台聚合层
      ├─ Daily Hot News（23 个中文平台）
      ├─ bb-browser（50+ 平台）
      └─ 各平台 API（GitHub/HN/Dev.to/npm...现有）
```

### AI 工具注册扩展

当前 AI 工具系统（`backend/src/ai/tools/`）可扩展：

```typescript
// 新增工具
backend/src/ai/tools/
  ├─ search-web.ts          // 现有 → 改为调用统一搜索服务
  ├─ fetch-content.ts       // 新增：Jina/抓取网页正文
  ├─ daily-hot.ts           // 新增：中文平台热点
  ├─ academic-search.ts     // 新增：学术论文搜索
  ├─ stackoverflow.ts       // 新增：技术 Q&A
  └─ wikipedia.ts           // 新增：知识库查询
```

### 搜索策略（多级回退）

```
用户搜索请求
  │
  ├─ Level 1: SearXNG（自托管，免费，无限制）
  │   ↓ 失败
  ├─ Level 2: Brave Search（$5/月信用额度）
  │   ↓ 失败
  ├─ Level 3: DuckDuckGo（完全免费，无 API Key）
  │   ↓ 失败
  └─ Level 4: Tavily / SerpAPI（现有付费方案）
```

---

## 部署依赖清单

### Docker Compose 新增服务

```yaml
# 需要新增的自托管服务
services:
  searxng:
    image: searxng/searxng:latest
    ports:
      - "8888:8080"
    volumes:
      - ./searxng:/etc/searxng
    # 可选：配合 Brave Search 作为后端引擎

  # 可选：如需深度抓取能力
  firecrawl:
    image: mendableai/firecrawl:latest
    ports:
      - "3002:3002"
    depends_on:
      - redis
      - playwright
```

### npm 依赖新增

```bash
# 后端
npm install duck-duck-scrape    # DuckDuckGo 搜索
npm install wikijs              # Wikipedia
npm install stackexchange       # StackOverflow
npm install brave-search        # Brave Search（如有 API Key）
npm install @plust/search-sdk   # 统一搜索抽象层（可选）

# 前端（如需直接调用）
# 无需新增，通过后端 API 统一获取
```

---

## 费用对比

| 方案 | 月费用 | 搜索量 | 中文支持 | 推荐 |
|------|--------|--------|---------|------|
| 现有（Tavily + SerpAPI） | ~$20-50 | 有限 | ❌ | — |
| SearXNG 自托管 | **$0** | **无限** | ✅ | ⭐⭐⭐ |
| DuckDuckGo | **$0** | 无限 | ⚠️ 一般 | ⭐⭐⭐ |
| Brave Search | **$5** | 1,000次/月 | ✅ | ⭐⭐⭐ |
| Daily Hot News | **$0** | 无限 | ✅✅ | ⭐⭐⭐ |
| bb-browser | **$0** | 无限 | ✅✅ | ⭐⭐ |
| 全部替换后 | **$0-5** | 基本无限 | ✅✅ | — |

---

## 总结

| 优先级 | 工具 | 价值 | 工作量 |
|--------|------|------|--------|
| 🔴 立即做 | SearXNG + DuckDuckGo | 替代付费搜索，零成本 | 1-2 天 |
| 🔴 立即做 | Daily Hot News | 23 个中文平台热点 | 半天 |
| 🟡 尽快做 | OmniSearch SDK | 统一搜索抽象层 | 1 天 |
| 🟡 尽快做 | Brave Search | 全能搜索 + 新闻/图片 | 半天 |
| 🟢 按需做 | Jina AI Reader | 网页内容提取 | 半天 |
| 🟢 按需做 | bb-browser | 50+ 平台接入 | 2-3 天 |
| 🟢 按需做 | StackOverflow + Wikipedia | 知识库补充 | 1 天 |
| 🔵 远期 | Semantic Scholar | 学术搜索 | 1 天 |
| 🔵 远期 | Perplexica | AI 搜索摘要 | 2-3 天 |
