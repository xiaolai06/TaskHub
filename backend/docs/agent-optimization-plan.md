# Agent 框架优化规划

> 生成时间：2026-06-11
> 状态：待决策
> 目标：提升 AI 数据质量、决策准确性、token 效率

---

## 一、当前框架现状

### 已完成的优化

| 优化项 | 状态 | 效果 |
|--------|------|------|
| 动态工具加载 | ✅ 已完成 | 工具描述 token 减少 70%（48→14个） |
| SearXNG 多引擎搜索 | ✅ 已完成 | 聚合 Google+Bing+百度，搜索质量最高 |
| 搜索降级链 | ✅ 已完成 | searxng → tavily → duckduckgo → sogou |
| fetch-content 三级降级 | ✅ 已完成 | 直连→代理→Jina，覆盖被墙站点 |
| 搜索策略提示词 | ✅ 已完成 | 4 阶段决策协议（评估→选择→深读→决策） |
| 代理配置系统 | ✅ 已完成 | 数据库存储 + 健康检查 + 前端配置 |
| 工具参数校验 | ✅ 已完成 | Zod 校验 + 类型检查 |
| 工具执行日志 | ✅ 已完成 | 每次调用记录到数据库 |
| 工具执行耗时监控 | ✅ 已完成 | 后端计时→SSE→前端显示（绿<10s/黄>10s） |
| 记忆相关性过滤 | ✅ 已完成 | 核心记忆始终注入 + 关键词匹配过滤，20条→8条 |
| 内部工具时间筛选 | ✅ 已完成 | 7个工具增加 month 参数，支持按月查询 |

### 当前框架能力评分

```
┌─────────────────────────┬───────┬───────────────────────────┐
│ 能力                    │ 评分  │ 说明                      │
├─────────────────────────┼───────┼───────────────────────────┤
│ LLM 多供应商切换        │ ⭐⭐⭐⭐⭐│ DeepSeek/GPT/Claude/Ollama│
│ 工具调用 (Function Call) │ ⭐⭐⭐⭐ │ 48个工具，参数校验完整     │
│ 流式输出 (SSE)          │ ⭐⭐⭐⭐⭐│ 实时渲染，体验好           │
│ 错误处理                │ ⭐⭐⭐⭐ │ fallback+截断+日志         │
│ 搜索质量                │ ⭐⭐⭐  │ 多引擎聚合，但无结果过滤   │
│ 工具结果质量            │ ⭐⭐    │ 原始JSON，无元信息标注     │
│ 记忆系统                │ ⭐⭐    │ 全量注入，无相关性过滤     │
│ 知识检索 (RAG)          │ ❌     │ 没有                      │
│ 任务规划                │ ❌     │ 没有                      │
│ 多Agent协作             │ ❌     │ 没有                      │
└─────────────────────────┴───────┴───────────────────────────┘
```

---

## 二、待优化项清单

### 优化 1：搜索结果质量门（优先级：高）

#### 问题描述

搜索工具（SearXNG/Sogou/DuckDuckGo 等）返回的原始结果包含垃圾数据：
- 空标题、空摘要
- 广告内容
- 与查询完全不相关的结果
- 同一网站重复霸屏

AI 看到这些垃圾结果会：
- 误选 fetch 目标（fetch 了广告页）
- 被不相关信息干扰回答
- 浪费 token 在无用结果上

#### 解决方案

在搜索工具的 handler 中，返回结果前加一层"质量门"：

```
原始结果（8条）→ 过滤垃圾 → 去重 → 限制同域名 → 打分 → 排序 → 输出（4-6条）
```

#### 过滤规则

| 规则 | 说明 | 示例 |
|------|------|------|
| 无标题过滤 | 标题为空或 < 5 字 | `{title: "", url: "..."}` → 过滤 |
| 无摘要过滤 | 摘要为空或 < 20 字 | `{snippet: "..."}` → 过滤 |
| 广告域名过滤 | 已知广告域名 | `ad.xxx.com`, `promo.xxx.com` |
| 零相关过滤 | 标题和查询零关键词命中 | 搜"报价"返回"教程" → 过滤 |
| URL 去重 | 同一 URL 只保留一条 | 两个引擎返回同一链接 → 去重 |
| 同域名限制 | 同一域名最多 2 条 | 防止知乎霸屏 |

#### 评分算法

```
score = 基础分(0) + 各维度加分

维度                    加分    判断方式
────────────────────────────────────────
标题命中查询关键词       +30    拆词后命中几个
摘要长度 > 80字          +15    字符数判断
来源是官方/权威网站      +20    域名白名单匹配
URL 是文章页             +15    路径含 /article/ /post/ /p/
有发布日期               +10    结果有 publishedDate 字段
来源是论坛/问答网站      -10    知乎/贴吧/论坛类域名

最终 score 范围：0~100
```

#### 来源分类

```
"官方" — 公司官网、政府网站、官方文档、国家标准
       *.gov.cn, *.org, 官网域名

"媒体" — 新闻网站、行业媒体
       36kr.com, ithome.com, sina.com, sohu.com

"社区" — 技术社区、问答平台
       zhihu.com, csdn.net, cnblogs.com, v2ex.com, segmentfault.com

"论坛" — 论坛、贴吧
       tieba.baidu.com, 各类论坛

"博客" — 个人博客、自媒体
       其他域名
```

#### 涉及文件

```
新建：backend/src/ai/tools/search-quality.ts （共享评分函数）
修改：backend/src/ai/tools/searxng-search.ts （调用评分函数）
修改：backend/src/ai/tools/sogou-search.ts  （调用评分函数）
修改：backend/src/ai/tools/search-web.ts     （调用评分函数）
修改：backend/src/ai/tools/google-news.ts    （调用评分函数）
```

#### 预期效果

```
之前：AI 收到 8 条未过滤结果，可能包含 2-3 条垃圾
之后：AI 收到 4-6 条高质量结果，每条带 score 和 sourceType

token 节省：每条结果约 100 token，过滤 2-3 条省 200-300 token
准确率提升：AI 选择 fetch 目标的准确率预计从 50% → 80%
```

---

### 优化 2：工具结果元信息标注（优先级：高）

#### 问题描述

数据库查询工具（get_profit_analysis、get_client_ranking 等）返回原始数据，AI 不知道：
- 数据覆盖哪个时间段
- 数据库总共有多少条，返回了多少条
- 有没有异常值（亏损项目、延期任务）
- 最关键的数据点是什么

这导致 AI 可能：
- 把去年的数据当成"最近的"
- 遗漏重要信息（没注意到有亏损项目）
- 回答时不知道数据范围

#### 解决方案

每个工具返回时附加 `meta` + `highlights` 字段：

```json
{
  "meta": {
    "tool": "get_profit_analysis",
    "timeRange": "2026-06",
    "startDate": "2026-06-01",
    "endDate": "2026-06-11",
    "totalInDB": 20,
    "returned": 20,
    "hasAnomaly": true,
    "anomalyNote": "存在1个亏损项目",
    "dataFreshness": "real-time"
  },
  "highlights": {
    "totalProfit": 50000,
    "bestProject": "小程序A (¥18,000)",
    "worstProject": "APP-C (¥-5,000)",
    "projectCount": 20,
    "avgMargin": 0.25
  },
  "summary": "本月20个项目，总利润¥50,000，平均利润率25%。小程序A最赚(¥18,000)，APP-C亏损(¥-5,000)",
  "data": [...]
}
```

#### 各工具的 meta 和 highlights 设计

##### get_profit_analysis

```
meta:
  timeRange: "2026-06" (当月)
  totalInDB: 项目总数
  returned: 返回项目数
  hasAnomaly: 是否有亏损项目

highlights:
  totalProfit: 总利润
  bestProject: 利润最高的项目名+金额
  worstProject: 利润最低的项目名+金额
  projectCount: 项目数量
  avgMargin: 平均利润率
```

##### get_cash_flow

```
meta:
  timeRange: 参数指定的月份
  totalInDB: 交易笔数
  returned: 返回笔数

highlights:
  totalIncome: 总收入
  totalExpense: 总支出
  netFlow: 净现金流
  biggestExpense: 最大支出项
```

##### get_client_ranking

```
meta:
  timeRange: "all-time" / "quarter"
  totalInDB: 客户总数
  returned: 返回数量

highlights:
  top3: 前3名客户名+金额
  totalRevenue: 总收入
  clientCount: 客户数量
```

##### get_project_progress

```
meta:
  timeRange: "当前进行中"
  totalInDB: 项目总数
  returned: 返回数量

highlights:
  completed: 已完成数量
  onTrack: 正常进行数量
  delayed: 延期数量
  totalTasks: 总任务数
  completedTasks: 已完成任务数
```

##### get_weekly_review

```
meta:
  timeRange: "本周" (自动计算周一到周日)
  startDate: "2026-06-09"
  endDate: "2026-06-15"

highlights:
  tasksCompleted: 本周完成任务数
  hoursLogged: 本周记录工时
  topProject: 投入最多的项目
  overdueAdded: 新增延期任务数
```

##### get_cost_breakdown

```
meta:
  timeRange: 参数指定的月份
  totalInDB: 成本项总数

highlights:
  totalCost: 总成本
  top3Categories: 前3大成本类别+金额
  avgPerProject: 每项目平均成本
```

##### get_today_focus

```
meta:
  timeRange: "今天"
  date: "2026-06-11"

highlights:
  urgentCount: 紧急任务数
  overdueCount: 延期任务数
  totalToday: 今日待办数
```

##### get_overdue_tasks

```
meta:
  timeRange: "截至今天"
  date: "2026-06-11"

highlights:
  overdueCount: 延期任务数
  mostOverdue: 延期最久的任务
  affectedProjects: 涉及项目数
```

##### search_searxng / search_sogou / search_duckduckgo

```
meta:
  tool: "search_searxng"
  query: "原始查询词"
  searchTime: "2026-06-11T17:00:00"
  engines: ["baidu", "google", "bing"]
  totalRaw: 10 (原始结果数)
  returned: 6 (过滤后返回数)
  filtered: 4 (被过滤的数量)

highlights:
  topSource: 最高分结果的来源
  avgScore: 平均评分
  sourceDistribution: { "官方": 2, "媒体": 2, "社区": 1, "论坛": 1 }
```

##### fetch_web_content

```
meta:
  url: "原始URL"
  extractTime: "2026-06-11T17:00:00"
  strategy: "defuddle-direct" / "defuddle-proxy" / "jina"
  contentLength: 5000

highlights:
  title: 文章标题
  author: 作者
  wordCount: 字数
```

#### 涉及文件

```
修改：backend/src/ai/tools/get-profit-analysis.ts
修改：backend/src/ai/tools/get-cash-flow.ts
修改：backend/src/ai/tools/get-cost-breakdown.ts
修改：backend/src/ai/tools/get-revenue-by-client.ts
修改：backend/src/ai/tools/get-today-focus.ts
修改：backend/src/ai/tools/get-goal-progress.ts
修改：backend/src/ai/tools/get-client-follow-up.ts
修改：backend/src/ai/tools/searxng-search.ts
修改：backend/src/ai/tools/sogou-search.ts
修改：backend/src/ai/tools/search-web.ts
修改：backend/src/ai/tools/fetch-content.ts
修改：backend/src/ai/tools/google-news.ts
```

#### 预期效果

```
之前：AI 收到原始 JSON，需要自己理解和计算
之后：AI 收到结构化数据，meta 告诉数据背景，highlights 告诉关键点

准确率提升：AI 不会遗漏异常值（亏损/延期），不会搞混时间范围
token 影响：每个工具增加约 100-200 token（meta+highlights），可接受
```

---

### 优化 3：记忆相关性过滤（优先级：中）

#### 问题描述

当前记忆注入逻辑：
```typescript
// llm.routes.ts
const memories = await prisma.userMemory.findMany({
  where: { userId: req.userId! },
  orderBy: { confidence: 'desc' },
  take: 20,  // 全部取 20 条
});
// 全部拼进 system prompt
```

问题：
- 全量注入，不管用户问什么都带着全部记忆
- 一次性事件（"用户查了XX"）和持久偏好（"用户是一人公司"）同等对待
- 无过期机制，3 个月前的记忆和今天的一样重
- 无长度限制，单条记忆可能很长

#### 解决方案

##### 分层存储

| 层级 | 类型 | 注入策略 | 示例 |
|------|------|---------|------|
| 核心记忆 | PREFERENCE / RULE | 始终注入 | "用户是一人公司"、"回答简洁" |
| 事实记忆 | FACT | 按关键词匹配注入 | "主要客户是XX"（消息含"客户"时注入） |
| 事件记忆 | INFO | 通常不注入 | "用户查了GitHub项目"（仅相关时注入） |

##### 过滤逻辑

```typescript
function filterRelevantMemories(memories: Memory[], message: string): Memory[] {
  const lower = message.toLowerCase();

  return memories.filter(m => {
    // 核心记忆始终注入
    if (m.category === 'PREFERENCE' || m.category === 'RULE') return true;

    // 事实记忆：关键词匹配
    if (m.category === 'FACT') {
      const keywords = extractKeywords(m.key + ' ' + m.value);
      return keywords.some(kw => lower.includes(kw));
    }

    // 事件记忆：严格匹配
    if (m.category === 'INFO') {
      const keywords = extractKeywords(m.key);
      return keywords.filter(kw => kw.length > 2).some(kw => lower.includes(kw));
    }

    return false;
  });
}
```

##### 长度控制

```typescript
// 单条记忆限制 50 字
function truncateMemory(value: string, maxLen = 50): string {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen) + '...';
}

// 总记忆限制 8 条
const MAX_RELEVANT_MEMORIES = 8;
```

##### 自动衰减（可选）

```
定时任务：每天执行一次
  - 30 天没被引用 → confidence - 0.1
  - 60 天没被引用 → confidence - 0.2
  - confidence < 0.3 → 自动删除
```

#### 涉及文件

```
新建：backend/src/ai/tools/memory-filter.ts （过滤逻辑）
修改：backend/src/routes/llm.routes.ts （调用过滤函数）
修改：backend/src/services/ai.service.ts （可选：加衰减逻辑）
```

#### 预期效果

```
之前：每次注入 20 条记忆，~1000 token
之后：平均注入 5 条相关记忆，~300 token
节省：~700 token/次
额外好处：AI 不被无关记忆干扰，回答更聚焦
```

---

### 优化 4：工具执行耗时监控（优先级：中）

#### 问题描述

当前 `logToolExecution` 只记录工具名、参数、结果，不记录耗时。无法发现：
- 哪些工具经常超时
- 哪些工具 AI 经常调但返回空
- 工具成功率趋势

#### 解决方案

在 `ai.service.ts` 的工具执行处加计时：

```typescript
// 当前代码
result = await tool.handler(args, this.userId);
await logToolExecution(this.userId, tc.function.name, args, result);

// 优化后
const start = Date.now();
result = await tool.handler(args, this.userId);
const duration = Date.now() - start;

await logToolExecution(this.userId, tc.function.name, args, result, duration);

// 超时警告
if (duration > 10_000) {
  console.warn(`[ToolPerf] ⚠️ ${tc.function.name}: ${duration}ms (超时)`);
} else {
  console.log(`[ToolPerf] ✅ ${tc.function.name}: ${duration}ms`);
}
```

#### 数据库扩展

```sql
-- ToolExecutionLog 表加字段
ALTER TABLE ToolExecutionLog ADD COLUMN duration INTEGER;
ALTER TABLE ToolExecutionLog ADD COLUMN success BOOLEAN DEFAULT true;
```

#### 统计查询（可选）

```
前端设置页展示：
  最近 24 小时工具执行统计：
  ┌────────────────────┬──────┬──────┬────────┐
│ 工具               │ 次数 │ 成功率│ 平均耗时│
├────────────────────┼──────┼──────┼────────┤
│ search_searxng     │ 45   │ 98%  │ 2.1秒  │
│ search_duckduckgo  │ 12   │ 25%  │ 8.5秒  │ ← 问题工具
│ fetch_web_content  │ 20   │ 70%  │ 4.2秒  │
│ get_profit_analysis│ 8    │ 100% │ 0.3秒  │
└────────────────────┴──────┴──────┴────────┘
```

#### 涉及文件

```
修改：backend/src/services/ai.service.ts （加计时）
修改：backend/prisma/schema.prisma （加 duration 字段）
新建：backend/src/routes/tool-stats.routes.ts （统计接口，可选）
```

#### 预期效果

```
之前：工具表现是黑盒
之后：每个工具的耗时、成功率都有数据
用途：发现慢工具、优化描述、降级不可靠工具
```

---

### 优化 5：对话摘要压缩（优先级：低）

#### 问题描述

当前对话历史保留最近 10 条消息（5 轮对话）。超过 10 条时直接丢弃早期消息。

用户聊了 15 轮后，前 10 轮的上下文全丢，导致：
- 用户说"按刚才的报价"，AI 不知道"刚才"是多少
- 用户说"继续刚才的话题"，AI 不知道是什么话题

#### 解决方案

超过 10 条消息时，把早期对话压缩成 1 条摘要：

```
原始 20 条消息 → 压缩成：
  1 条摘要（替代前 15 条）
  + 5 条最近完整消息
  = 6 条消息（保留了全部关键信息）
```

##### 压缩方式

方案 A：代码压缩（推荐，零成本）

```typescript
function compressHistory(messages: Message[]): string {
  // 提取每轮对话的关键信息
  const keyPoints = messages
    .filter(m => m.role === 'user')
    .map(m => m.content.slice(0, 50))  // 用户消息前 50 字
    .join('；');

  return `[对话摘要] 用户讨论了：${keyPoints}`;
}
```

方案 B：AI 压缩（更准确但有成本）

```
发给 AI："请用 100 字总结这段对话的核心信息"
额外成本：1 次 API 调用
```

#### 涉及文件

```
修改：backend/src/services/ai.service.ts （trimMessages 函数）
```

#### 预期效果

```
之前：聊 15 轮后，前 10 轮上下文全丢
之后：聊 15 轮后，前 10 轮压缩成 1 条摘要保留
额外成本：0（方案A）或 1 次 API 调用（方案B）
```

---

### 优化 6：工具结果格式统一（优先级：低）

#### 问题描述

当前各工具返回格式不统一：
- 有的返回 `{ data: [...] }`
- 有的返回 `{ results: [...] }`
- 有的返回 `{ projects: [...] }`
- 错误格式也不统一

AI 需要每次都理解不同的格式，增加认知负担。

#### 解决方案

统一返回格式：

```typescript
interface ToolResult {
  // 必填
  success: boolean;
  data: unknown;           // 主数据

  // 可选
  meta?: {
    tool: string;
    timeRange: string;
    totalInDB?: number;
    returned?: number;
  };
  highlights?: Record<string, unknown>;
  summary?: string;        // 一行摘要
  error?: string;          // 失败时的错误信息
  note?: string;           // 补充说明
}
```

#### 涉及文件

```
新建：backend/src/ai/tools/result-formatter.ts （统一格式函数）
修改：所有工具 handler（调用格式化函数）
```

#### 预期效果

```
之前：AI 面对多种格式，需要每次理解
之后：统一格式，AI 可以快速定位 data/highlights/error
```

---

## 三、优化路线图

```
阶段 1（1-2天）：数据质量基础
  ├── 搜索结果质量门（过滤 + 打分）
  └── 搜索结果元信息（meta.searchTime, meta.filtered）

阶段 2（2-3天）：工具结果增强
  ├── 数据库查询工具 meta + highlights
  ├── 工具结果格式统一
  └── fetch_web_content 元信息

阶段 3（1天）：记忆优化
  ├── 记忆分层存储
  ├── 记忆相关性过滤
  └── 记忆长度控制

阶段 4（半天）：监控
  └── 工具执行耗时统计

阶段 5（可选）：对话压缩
  └── 长对话摘要压缩
```

---

## 四、核心设计原则

```
1. 后端做数据准备，AI 做决策和回答
   - 过滤、打分、标注 → 后端代码（确定性）
   - 选择、分析、总结 → AI（需要理解力）

2. 宁可少给，不要多给
   - 搜索结果：过滤掉垃圾，宁可少 2 条
   - 记忆：只带相关的，宁可少 10 条
   - 工具：只加载相关类，宁可少 30 个

3. 元信息必须标注
   - 时间范围：AI 必须知道数据是哪段
   - 数据量：AI 必须知道总共有多少
   - 异常值：AI 必须知道有无亏损/延期

4. 渐进式优化
   - 每个优化独立，可以单独上线
   - 先做收益最大的（搜索质量门）
   - 后做锦上添花的（对话压缩）
```

---

## 五、Token 消耗预估

```
┌────────────────────────┬───────────────┬───────────────┐
│ 优化项                 │ 之前 token    │ 之后 token    │
├────────────────────────┼───────────────┼───────────────┤
│ 工具描述（动态加载后）  │ ~1,800        │ ~1,800        │ ← 已优化
│ 搜索结果（质量门后）    │ ~1,000 (8条)  │ ~600 (5条)    │ ← 优化
│ 工具结果（元信息后）    │ ~500          │ ~700 (+meta)  │ ← 略增
│ 记忆（过滤后）          │ ~1,000 (20条) │ ~300 (5条)    │ ← 优化
│ 历史消息                │ ~1,000        │ ~1,000        │
│ 当前消息                │ ~50           │ ~50           │
├────────────────────────┼───────────────┼───────────────┤
│ 总计                   │ ~5,350        │ ~4,450        │
│ 节省                   │               │ ~900 (17%)    │
└────────────────────────┴───────────────┴───────────────┘
```
