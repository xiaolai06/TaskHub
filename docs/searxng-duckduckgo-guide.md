# SearXNG + DuckDuckGo 搜索集成 — 实施说明

> 目标：将 SearXNG（自托管免费）+ DuckDuckGo（免费兜底）接入项目，替换/补充现有的 Tavily + SerpAPI 付费方案

---

## 一、你需要做什么（Step by Step）

### Step 1：启动 SearXNG（Docker，5 分钟）

SearXNG 是一个自托管的元搜索引擎，聚合 70+ 个搜索引擎的结果，**完全免费、无限调用**。

```bash
# 拉取并启动（Docker 一行命令）
docker run -d \
  --name searxng \
  -p 8888:8080 \
  -v searxng:/etc/searxng \
  searxng/searxng:latest
```

**验证是否启动成功**：
```bash
# 浏览器访问
http://localhost:8888

# 或命令行测试（返回 JSON 格式搜索结果）
curl "http://localhost:8888/search?format=json&q=项目管理&categories=general"
```

**Docker Compose 方式**（如果已有 `docker-compose.yml`）：
```yaml
services:
  searxng:
    image: searxng/searxng:latest
    container_name: searxng
    ports:
      - "8888:8080"
    volumes:
      - ./searxng:/etc/searxng
    restart: unless-stopped
```

---

### Step 2：后端安装 DuckDuckGo npm 包（1 分钟）

```bash
cd backend
npm install duck-duck-scrape
```

无需 API Key、无需注册、无需配置，装完即用。

---

### Step 3：后端代码改造（核心工作）

改造涉及 **3 个文件**，不新增文件，只在现有结构上扩展：

#### 3.1 改造 `backend/src/ai/tools/search-web.ts`

**改动内容**：在现有的 Tavily / SerpAPI 调用之上，增加 SearXNG 和 DuckDuckGo 两个搜索函数，并实现多级回退策略。

**改动要点**：
```typescript
// 新增：SearXNG 搜索函数
async function callSearXNG(query: string, cfg: SearchConfig) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    categories: cfg.topic === 'news' ? 'news' : 'general',
    language: 'auto',
    pageno: '1',
  });

  const res = await fetch(`${process.env.SEARXNG_URL || 'http://localhost:8888'}/search?${params}`);
  if (!res.ok) throw new Error(`SearXNG HTTP ${res.status}`);
  const data = await res.json();

  return (data.results || []).slice(0, cfg.maxResults).map((r: any) => ({
    title: r.title || '',
    snippet: r.content?.slice(0, 300) || '',
    url: r.url || '',
    engine: r.engine || 'searxng',        // 标记来源引擎
    publishedDate: r.publishedDate || null, // 新闻类带日期
  }));
}

// 新增：DuckDuckGo 搜索函数
async function callDuckDuckGo(query: string, cfg: SearchConfig) {
  const { search } = await import('duck-duck-scrape');
  const results = await search(query, { safeSearch: -1 });
  return results.results.slice(0, cfg.maxResults).map(r => ({
    title: r.title || '',
    snippet: r.description?.slice(0, 300) || '',
    url: r.url || '',
    engine: 'duckduckgo',
  }));
}
```

**回退策略**（改动 handler 函数）：
```typescript
handler: async (args, userId) => {
  const cfg = await getSearchConfig(userId);
  const query = args.query as string;
  const resolvedCfg = { ...cfg, maxResults: (args.maxResults as number) || cfg.maxResults };

  // 多级回退：SearXNG → 用户配置的 API → DuckDuckGo
  const strategies = [
    { name: 'searxng',  fn: () => callSearXNG(query, resolvedCfg) },
    ...(cfg.provider === 'serpapi' && cfg.apiKey
      ? [{ name: 'serpapi', fn: () => callSerpAPI(query, resolvedCfg) }]
      : []),
    ...(cfg.provider !== 'serpapi' && cfg.apiKey
      ? [{ name: 'tavily', fn: () => callTavily(query, resolvedCfg) }]
      : []),
    { name: 'duckduckgo', fn: () => callDuckDuckGo(query, resolvedCfg) },
  ];

  for (const s of strategies) {
    try {
      const results = await s.fn();
      if (results.length > 0) return { configured: true, provider: s.name, query, results, total: results.length };
    } catch (err) {
      console.warn(`[Search] ${s.name} failed:`, err);
      continue;  // 失败则尝试下一个
    }
  }

  return { configured: true, error: '所有搜索源均失败', results: [] };
};
```

#### 3.2 改造 `backend/src/services/setting.service.ts`

**改动内容**：在 `AI_PROVIDERS` 列表附近，新增 `SEARCH_PROVIDERS` 配置，让设置页面可以选择 SearXNG / DuckDuckGo。

```typescript
// 在搜索配置中新增两个选项
export const SEARCH_PROVIDERS = [
  { value: 'searxng',     label: 'SearXNG（自托管，免费）', needsKey: false },
  { value: 'duckduckgo',  label: 'DuckDuckGo（免费）',       needsKey: false },
  { value: 'tavily',      label: 'Tavily（付费）',            needsKey: true },
  { value: 'serpapi',     label: 'SerpAPI（付费）',           needsKey: true },
];
```

#### 3.3 `.env` 新增环境变量

```bash
# backend/.env
SEARXNG_URL=http://localhost:8888
```

---

### Step 4：前端改动（可选，很小）

在搜索设置页面增加 SearXNG / DuckDuckGo 选项（如果前端已有搜索配置页面）。改动范围仅限于一个下拉选项的列表，不涉及布局变动。

---

### Step 5：验证（10 分钟）

```bash
# 1. 确认 SearXNG 在线
curl "http://localhost:8888/search?format=json&q=test"

# 2. 重启后端
cd backend && npm run dev

# 3. 在 AI 聊天中触发搜索
#    对话框输入："帮我搜索一下 2025 年项目管理工具对比"
#    观察返回结果中 provider 字段是 searxng 还是 duckduckgo
```

---

## 二、数据获取后如何分析处理

这是你问的第二个问题——搜到了原始数据之后，AI 怎么理解和使用它。

### 当前数据处理流程（完整链路）

```
用户提问
  ↓
AI 模型判断需要搜索（调用 search_web 工具）
  ↓
┌─────────────────────────────────────────────┐
│  Step 1：获取原始数据                          │
│  SearXNG / DuckDuckGo / Tavily / SerpAPI     │
│  返回：[{ title, snippet, url, engine }]       │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│  Step 2：结果截断（ai.service.ts:46）          │
│  truncateResult(result, 500)                  │
│  - 超过 500 字符自动截断                       │
│  - 数组超过 5 条只返回前 5 条                   │
│  - 附带 total 字段告知 AI 实际总数             │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│  Step 3：注入 AI 上下文                        │
│  工具结果作为 tool message 注入到对话中         │
│  AI 模型看到的是：                              │
│  {                                            │
│    provider: "searxng",                       │
│    query: "2025 项目管理工具对比",               │
│    results: [                                 │
│      { title: "...", snippet: "...", url },   │
│      { title: "...", snippet: "...", url },   │
│      ...最多 5 条                              │
│    ],                                         │
│    total: 15                                  │
│  }                                            │
└─────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────┐
│  Step 4：AI 综合分析（模型自主完成）             │
│  AI 读取 snippets，提取关键信息，综合回答         │
│  - 对比多个来源的结果                            │
│  - 引用来源 URL                                │
│  - 结合用户本地数据（项目/任务/成本）做对比       │
│  - 给出建议和下一步行动                          │
└─────────────────────────────────────────────┘
  ↓
用户看到回答（Markdown 渲染）
```

### 每一步在代码中的位置

| 处理阶段 | 文件 | 行号 | 说明 |
|---------|------|------|------|
| **获取** | `ai/tools/search-web.ts` | `callTavily()` / `callSerpAPI()` | 调用外部 API |
| **截断** | `ai.service.ts` | `truncateResult()` L46 | 控制返回给 AI 的数据量 |
| **注入** | `ai.service.ts` | 工具调用循环 | tool result → messages 数组 |
| **分析** | AI 模型内部 | — | 模型读取 snippets 自主分析 |
| **呈现** | 前端 `useAiChat.ts` | SSE 解析 | 流式输出 Markdown |

### 截断策略详情（`ai.service.ts:46`）

```typescript
function truncateResult(result: unknown, maxChars = 500): unknown {
  const str = JSON.stringify(result);
  if (str.length <= maxChars) return result;

  // 数组类型：只保留前 5 条 + 总数提示
  if (Array.isArray(result)) {
    return {
      data: result.slice(0, 5),
      total: result.length,
      showing: 5,
      note: `共 ${result.length} 条，显示前 5 条`,
    };
  }

  // 对象/字符串：截断到 500 字符
  return {
    preview: str.slice(0, maxChars) + '...(已截断)',
    truncated: true,
  };
}
```

**为什么截断**：搜索结果通常有 5-15 条，每条 snippet 300 字符，总数据量 1500-4500 字符。直接全部给 AI 会浪费 token 且可能超过上下文窗口。截断保留关键信息，AI 仍能有效分析。

### AI 如何分析搜索结果（举例）

**场景**：用户问"我的外包报价和行业比怎么样？"

```
AI 思考过程：
1. 需要搜索行业报价数据 → 调用 search_web("2025 小程序外包开发报价行情")
2. 拿到 5 条搜索结果的 snippets：
   - "小程序外包报价 3-8 万，复杂项目 15-30 万..."
   - "2025 年外包开发平均时薪 200-500 元..."
   - ...
3. 同时查询本地数据（调用 get_cost_breakdown）
   - 用户当前项目成本：2.5 万
4. 综合对比分析：
   "根据搜索结果，2025 年小程序外包市场报价在 3-8 万区间，
    您当前项目成本 2.5 万，低于市场平均水平约 30%。
    建议评估是否需要增加功能范围或确认供应商报价是否合理。"
```

### 新增 SearXNG/DuckDuckGo 后，处理链路的变化

**变化点只有 Step 1**（数据获取层），Step 2-4 完全不变：

```
改动前：search-web.ts → Tavily/SerpAPI → 截断 → AI 分析 → 回答
改动后：search-web.ts → SearXNG(首选) → DuckDuckGo(兜底) → 截断 → AI 分析 → 回答
                                              ↑ 失败时回退到 Tavily/SerpAPI
```

搜索结果的返回格式完全一致（`{ title, snippet, url }`），AI 分析逻辑零改动。

---

## 三、改动文件清单

| 文件 | 改动类型 | 工作量 |
|------|---------|--------|
| `backend/.env` | 新增 1 行 | 1 分钟 |
| `backend/src/ai/tools/search-web.ts` | 新增 2 个函数 + 改 handler | 核心工作，约 60 行代码 |
| `backend/src/services/setting.service.ts` | 新增搜索供应商选项 | 约 10 行 |
| `docker-compose.yml`（或手动 docker run） | 新增 SearXNG 容器 | 1 条命令 |

**不改动的文件**：
- `ai.service.ts`（截断和工具循环不变）
- 所有前端文件（搜索配置页面如果已有，只需改下拉选项）
- 所有其他 AI 工具（GitHub/HN/Dev.to 等不变）
- 数据库 Schema（不新增表）

---

## 四、费用对比

| | 改动前 | 改动后 |
|--|-------|-------|
| **主要搜索** | Tavily（$0.01/次） | SearXNG（$0/次） |
| **备用搜索** | SerpAPI（100次/月免费） | DuckDuckGo（$0/次） |
| **月均费用（假设 1000 次搜索）** | ~$10-20 | **$0** |
| **搜索结果质量** | 单一引擎 | 聚合 70+ 引擎 |
| **中文搜索** | 差 | 好（SearXNG 聚合百度/必应） |

---

## 五、注意事项

1. **SearXNG 需要 Docker**：服务器需要安装 Docker，不占太多资源（~100MB 内存）
2. **DuckDuckGo 偶尔被限速**：高频调用可能触发验证码，所以它定位是兜底，不是主力
3. **搜索结果格式兼容**：新增的两个源返回格式与现有 `{ title, snippet, url }` 完全一致，AI 处理层零改动
4. **不影响现有功能**：Tavily/SerpAPI 配置保留，只是优先级降低到 SearXNG 失败之后
5. **生产环境建议**：SearXNG 有速率限制配置（`/etc/searxng/settings.yml`），建议开启 `limiter: true`
