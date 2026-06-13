# 搜索工具重构说明

> 本次优化目标：将笼统的 `search_web` 拆成独立命名的工具，让 AI 和用户都能清楚看到每次调用了什么。

## 一、当前问题

### 1. search_web 是黑盒

```
AI 调用 search_web("2025 小程序报价")
  → 内部自动选 Tavily / SerpAPI / DuckDuckGo
  → 用户看不到用了哪个引擎
  → 日志只显示 [Search] duckduckgo failed
```

### 2. 工具名称不直观

```
当前：search_web（通用名称，看不出来用什么）
期望：search_duckduckgo / search_tavily / search_google_news（一眼看出来源）
```

### 3. DuckDuckGo VQD 问题已修复

`duck-duck-scrape` 库在国内网络下获取 VQD token 失败，已加了 Lite HTML 兜底通道。但仍然藏在 `search_web` 内部，不透明。

---

## 二、重构方案：工具拆分

### 改名对照表

| 当前文件名 | 当前工具名 | 新工具名 | 说明 |
|-----------|-----------|---------|------|
| search-web.ts | search_web | **拆成两个** ↓ | 通用搜索入口拆分 |
| （从 search-web.ts 拆出） | - | `search_tavily` | Tavily API 付费搜索 |
| （从 search-web.ts 拆出） | - | `search_duckduckgo` | DuckDuckGo 免费搜索 |
| fetch-content.ts | fetch_content | `fetch_web_content` | 网页深读 → Markdown |
| google-news.ts | google_news | `search_google_news` | Google News RSS |
| daily-hot.ts | daily_hot | `search_daily_hot` | 中文 23 平台热点 |
| world-bank.ts | world_bank | `search_world_bank` | 世界银行宏观数据 |

### 最终工具列表（搜索类）

```
search_tavily        → Tavily API（付费，需 Key，质量最高）
search_duckduckgo    → DuckDuckGo（免费，零配置，Lite HTML 兜底）
search_google_news   → Google News RSS（免费，全球新闻）
search_daily_hot     → orz.ai（免费，中文 23 平台热点）
search_world_bank    → 世界银行 API（免费，200+ 国家宏观数据）
fetch_web_content    → Defuddle + Jina（免费，网页 → Markdown）
```

### 保留原有搜索类工具（不改名）

```
github_trending      → GitHub Trending
hacker_news          → Hacker News
npm_search           → npm 包搜索
dev_to               → Dev.to 文章
product_hunt         → Product Hunt
exchange_rate        → 汇率查询
```

---

## 三、AI 调用逻辑（重构后）

```
用户输入
  │
  ├─ "搜索 XXX" / "查一下" / "最新消息"
  │   ├─ 有 Tavily Key → AI 选择 search_tavily（质量最高）
  │   └─ 无 Key → AI 选择 search_duckduckgo（免费兜底）
  │
  ├─ "热点 / 热搜 / 热榜 / 大家讨论什么"
  │   └─ AI 选择 search_daily_hot（中文平台专用）
  │
  ├─ "新闻 / 报道 / 最新进展"
  │   └─ AI 选择 search_google_news（全球新闻专用）
  │
  ├─ "GDP / 人口 / 失业率 / 宏观经济"
  │   └─ AI 选择 search_world_bank（宏观数据专用）
  │
  ├─ 搜索结果有价值，要读全文
  │   └─ AI 选择 fetch_web_content（网页深读）
  │
  └─ 其他业务查询
      └─ AI 选择对应的 get_xxx / create_xxx 工具
```

**关键点**：AI 根据工具的 `description` 自主选择。description 写得越清楚（何时用、何时不用），AI 选得越准。

---

## 四、search-web.ts 拆分细节

### 4.1 搜索配置读取（保留，两个工具共用）

`getSearchConfig(userId)` 读取用户配置的搜索设置（provider、apiKey 等），两个工具都需要用到。保留在 `search-web.ts` 中作为共享函数。

### 4.2 search_tavily 工具

```typescript
// 从 search-web.ts 中拆出
export const searchTavilyTool: ToolDefinition = {
  name: 'search_tavily',
  description: `通过 Tavily API 搜索网页信息（付费，需配置 API Key）。

使用时机:
- 需要高质量、精准的网页搜索结果
- 用户已配置 Tavily API Key（在设置页面）
- 需要搜索深度内容（Tavily 支持 search_depth: advanced）

不使用时机:
- 未配置 API Key → 用 search_duckduckgo
- 中文热点 → 用 search_daily_hot
- 新闻 → 用 search_google_news
- 宏观数据 → 用 search_world_bank

AI 自适应提示: 质量最高的搜索引擎，但需要付费 Key。未配置 Key 时自动不可用，请用 search_duckduckgo 替代。`,
  // ... handler 调用 callTavily()
};
```

### 4.3 search_duckduckgo 工具

```typescript
export const searchDuckDuckGoTool: ToolDefinition = {
  name: 'search_duckduckgo',
  description: `通过 DuckDuckGo 免费搜索网页信息。零配置，永远可用。

使用时机:
- 用户没有配置付费搜索 API Key
- 需要快速搜索网页信息
- 作为其他搜索工具的免费替代

不使用时机:
- 用户有 Tavily Key → 用 search_tavily（质量更高）
- 中文热点 → 用 search_daily_hot
- 新闻 → 用 search_google_news

AI 自适应提示: 免费兜底搜索，永远可用。结果质量不如 Tavily，但零成本。国内网络下会自动使用 Lite HTML 版本。`,
  // ... handler 调用 callDuckDuckGo()（保留 Lite HTML 兜底逻辑）
};
```

### 4.4 共享函数保留

以下函数保留在 `search-web.ts` 中，两个工具共用：
- `getSearchConfig()` — 读取搜索配置
- `callTavily()` — Tavily API 调用
- `callSerpAPI()` — SerpAPI 调用（备用）
- `callDuckDuckGo()` — DuckDuckGo 调用（含 Lite 兜底）
- `dedupByUrl()` — URL 去重
- `getCachedResult()` / `setCachedResult()` — 缓存

---

## 五、fetch-content.ts 改名细节

### 改动

```
文件名：fetch-content.ts（不改）
工具名：fetch_content → fetch_web_content
导出名：fetchContentTool → fetchWebContentTool
```

### description 更新

```typescript
description: `读取网页完整正文内容，返回干净的 Markdown。内置缓存，同一 URL 10 分钟内不重复请求。

使用时机:
- search_tavily 或 search_duckduckgo 的某条结果有价值，需要深读全文
- 用户给了一个 URL，需要提取正文
- 需要网页中的具体数据（表格、列表、详细分析）

不使用时机:
- 搜索结果摘要已经够用
- 用户只是泛泛地问问题

AI 自适应提示: 网页深读器。通常是搜索后的第二步——先用搜索工具找到有价值的结果，再用本工具读取完整内容。`,
```

---

## 六、其他工具改名细节

### google-news.ts

```
工具名：google_news → search_google_news
导出名：googleNewsTool → searchGoogleNewsTool
```

### daily-hot.ts

```
工具名：daily_hot → search_daily_hot
导出名：dailyHotTool → searchDailyHotTool
```

### world-bank.ts

```
工具名：world_bank → search_world_bank
导出名：worldBankTool → searchWorldBankTool
```

---

## 七、registry.ts 更新

```typescript
// 搜索类工具（新）
import { searchTavilyTool, searchDuckDuckGoTool } from './search-web';
import { fetchWebContentTool } from './fetch-content';
import { searchGoogleNewsTool } from './google-news';
import { searchDailyHotTool } from './daily-hot';
import { searchWorldBankTool } from './world-bank';

// 注册
const allTools: ToolDefinition[] = [
  // ... 其他工具 ...

  // 🔍 搜索（命名明确，AI 自主选择）
  searchTavilyTool, searchDuckDuckGoTool,
  searchGoogleNewsTool, searchDailyHotTool, searchWorldBankTool,
  fetchWebContentTool,

  // 原有搜索类（不改名）
  githubTrendingTool, hackerNewsTool, npmSearchTool,
  devToTool, productHuntTool, exchangeRateTool,
];
```

---

## 八、日志效果（重构后）

```
[Tool] AI 调用 search_duckduckgo("2025 小程序开发报价") → 5 条结果
[Tool] AI 调用 fetch_web_content("https://juejin.cn/post/xxx") → 3200 字 Markdown
[Tool] AI 调用 search_daily_hot({ platform: "36kr" }) → 15 条热点
[Tool] AI 调用 search_google_news({ query: "AI 行业" }) → 10 条新闻
[Tool] AI 调用 search_world_bank({ country: "CN", indicator: "NY.GDP.MKTP.CD" }) → GDP 数据
```

---

## 九、注意事项

1. **不要删除搜索配置读取逻辑** — `getSearchConfig()` 是 Tavily/SerpAPI 的基础，两个工具共用
2. **不要删除 callTavily / callSerpAPI 函数** — search_tavily 工具需要调用
3. **DuckDuckGo Lite 兜底逻辑保留** — `callDuckDuckGo()` 内的双通道回退不要改
4. **缓存逻辑保留** — search_tavily 和 search_duckduckgo 各自维护缓存
5. **registry.ts 的 allTools 数组顺序** — 搜索类工具放在一起，便于维护
6. **TypeScript 编译** — 改完后必须 `npx tsc --noEmit` 验证零错误

---

## 十、验证清单

- [ ] `npx tsc --noEmit` 零错误
- [ ] 启动后端 `npm run dev` 无报错
- [ ] AI 能看到 6 个搜索类工具（search_tavily / search_duckduckgo / search_google_news / search_daily_hot / search_world_bank / fetch_web_content）
- [ ] 日志能清晰显示 AI 调用了哪个工具
- [ ] 搜索结果有 URL 去重
- [ ] 搜索结果有 10 分钟缓存
- [ ] DuckDuckGo Lite HTML 兜底正常工作
