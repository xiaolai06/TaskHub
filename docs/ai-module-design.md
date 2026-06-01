# TaskFlow+ AI 模块设计说明

> 本文档描述 AI 模块的整体架构、工具体系、提示词策略、定时任务、供应商管理和前端交互。

---

## 一、整体架构

```
用户消息
  ↓
prompt-selector.ts     ← 根据关键词选择系统提示词
  ↓
ai.service.ts          ← OpenAI SDK 调用 + Function Calling 循环
  ↓                       ↕ (最多 5 轮工具调用)
tools/registry.ts      ← 25 个工具的中央注册表
  ↓
tools/*.ts             ← 具体工具执行 (数据库查询 / 外部 API)
  ↓
SSE 流式响应返回前端
```

### 核心设计原则

| 原则 | 说明 |
|------|------|
| **OpenAI 兼容** | 所有 AI 调用走 OpenAI SDK，任何提供 `/v1/chat/completions` 的供应商都可接入 |
| **工具驱动** | AI 不直接操作数据库，必须通过 25 个注册工具完成所有操作 |
| **写操作确认** | 所有 create/update/delete 工具标记 `requiresConfirmation`，前端需用户确认后才执行 |
| **提示词分区** | 根据用户意图自动切换 5 套系统提示词（默认/创建/分析/排期/搜索） |
| **流式优先** | 主聊天接口为 SSE 流式，支持文本片段 + 工具调用事件 + 工具结果事件 |

---

## 二、文件结构

```
backend/src/
├── ai/
│   ├── prompt-selector.ts          ← 关键词 → 提示词路由
│   ├── memory-extractor.ts         ← 对话记忆提取
│   ├── tools/
│   │   ├── types.ts                ← ToolDefinition 接口定义
│   │   ├── registry.ts             ← 25 工具的注册表
│   │   ├── get-profit-analysis.ts  ← 财务分析 (5 工具)
│   │   ├── get-cash-flow.ts
│   │   ├── get-cost-breakdown.ts
│   │   ├── get-revenue-by-client.ts
│   │   ├── get-today-focus.ts      ← 工作管理 (3 工具)
│   │   ├── create-task.ts          ← 任务 CRUD (5 工具)
│   │   ├── create-project.ts       ← 项目 CRUD (2 工具)
│   │   ├── get-client-follow-up.ts ← 客户管理 (6 工具)
│   │   ├── get-goal-progress.ts    ← 目标管理 (4 工具)
│   │   ├── search-web.ts           ← 网页搜索 (Tavily/SerpAPI)
│   │   ├── github-trending.ts      ← GitHub 趋势
│   │   ├── hacker-news.ts          ← Hacker News
│   │   ├── npm-search.ts           ← npm 包搜索
│   │   ├── exchange-rate.ts        ← 汇率查询
│   │   ├── dev-to.ts               ← Dev.to 文章
│   │   └── product-hunt.ts         ← Product Hunt
│   └── capabilities/               ← [TODO] 6 个智能能力模块
├── services/
│   ├── ai.service.ts               ← AI 核心服务
│   ├── setting.service.ts          ← 供应商管理 + 模型获取
│   └── ...
├── routes/
│   └── llm.routes.ts               ← 6 个 AI API 端点
├── prompts/
│   ├── system-default.txt          ← 默认助手
│   ├── system-create.txt           ← 创建模式
│   ├── system-analyze.txt          ← 分析模式
│   ├── system-schedule.txt         ← 排期模式
│   ├── system-search.txt           ← 搜索模式
│   ├── system-morning.txt          ← 晨间简报
│   ├── system-client-radar.txt     ← 客户雷达
│   ├── system-finance-pulse.txt    ← 财务脉搏
│   ├── health-check.txt            ← 业务体检
│   ├── weekly-report.txt           ← 自动周报
│   └── memory-extract.txt          ← 记忆提取
└── jobs/                           ← 8 个定时任务
    ├── index.ts
    ├── due-reminder.job.ts
    ├── morning-briefing.job.ts
    ├── client-radar.job.ts
    ├── cost-alert.job.ts
    ├── finance-pulse.job.ts
    ├── weekly-report.job.ts
    ├── weekly-memory.job.ts
    └── health-check.job.ts
```

---

## 三、AI 工具体系 (25 个工具)

### 3.1 工具分类总览

| 类别 | 数量 | 权限 | 工具列表 |
|------|------|------|----------|
| **财务分析** | 5 | 只读 | `get_profit_analysis` · `get_cash_flow` · `get_cost_breakdown` · `get_revenue_by_client` · `get_project_margin_ranking` |
| **工作管理** | 10 | 3 读 / 7 写 | `get_today_focus` · `get_overdue_tasks` · `get_project_progress` · `create_task` · `update_task_status` · `delete_task` · `log_time` · `get_schedule` · `create_project` · `update_project` |
| **客户管理** | 6 | 2 读 / 4 写 | `get_client_follow_up` · `get_client_insights` · `get_client_ranking` · `create_customer` · `update_customer` · `log_communication` |
| **目标管理** | 4 | 只读 | `get_goal_progress` · `get_weekly_review` · `suggest_weekly_plan` · `get_business_health` |
| **外部搜索** | 7 | 只读 | `search_web` · `github_trending` · `hacker_news` · `npm_search` · `exchange_rate` · `dev_to` · `product_hunt` |

### 3.2 工具接口规范

```typescript
interface ToolDefinition {
  name: string           // 工具名 (snake_case)
  description: string    // 工具用途说明
  category: string       // 分类: finance / work / client / goal / search
  parameters: object     // JSON Schema 参数定义
  handler: (args, userId) => Promise<any>  // 执行函数
  access: 'read' | 'write'  // 权限级别
  requiresConfirmation: boolean  // 是否需要用户确认
}
```

### 3.3 外部搜索工具详情

| 工具 | 数据源 | 需要 API Key | 免费 | 用途 |
|------|--------|:---:|:---:|------|
| `search_web` | Tavily / SerpAPI | ✅ | ❌ | 通用网页搜索，支持深度搜索、时间范围、域名过滤 |
| `github_trending` | GitHub Search API | ❌ | ✅ | 近期高星仓库，按 star 增速排序 |
| `hacker_news` | Firebase API | ❌ | ✅ | HN 热门/Ask/Show/Job |
| `npm_search` | npm Registry | ❌ | ✅ | npm 包搜索，含周下载量和热度标签 |
| `exchange_rate` | open.er-api.com | ❌ | ✅ | 200+ 货币实时汇率 |
| `dev_to` | Dev.to API | ❌ | ✅ | 技术文章搜索，支持标签和排序 |
| `product_hunt` | PH GraphQL | ✅ (免费 token) | ✅ | 新产品发现，按投票排序 |

**搜索工具决策树：**
```
技术选型 / 开源项目 → github_trending
技术文章 / 教程     → dev_to → npm_search
行业新闻 / 竞品     → hacker_news → search_web
产品灵感            → product_hunt
货币汇率            → exchange_rate
通用搜索            → search_web (兜底)
```

---

## 四、提示词策略

### 4.1 提示词路由 (prompt-selector.ts)

```
用户消息
  ├── 包含 "创建/新建/添加/帮我建" → system-create.txt
  ├── 包含 "分析/利润/排名/报表"    → system-analyze.txt
  ├── 包含 "排期/计划/安排/日程"    → system-schedule.txt
  ├── 包含 "搜索/查一下/最新/趋势"  → system-search.txt
  └── 其他                          → system-default.txt
```

### 4.2 交互式提示词 (5 套)

| 提示词 | 触发场景 | 核心能力 |
|--------|----------|----------|
| `system-default` | 默认对话 | 全量工具概览、通用问答、简洁 Markdown |
| `system-create` | 用户要创建数据 | 列出所有可写字段、创建流程、确认机制 |
| `system-analyze` | 用户要分析数据 | 数据驱动回答、风险标注、表格呈现 |
| `system-schedule` | 用户要排期计划 | 优先级排序、8h/天限制、冲突检测 |
| `system-search` | 用户要搜索外部 | 7 个搜索工具的使用指南和决策树 |

### 4.3 定时任务提示词 (6 套)

| 提示词 | 触发时机 | 输出格式 |
|--------|----------|----------|
| `system-morning` | 每天 8:00 | 今日焦点 · 时间建议 · 风险提醒 · 昨日成就 |
| `system-client-radar` | 每天 9:00 | 红/黄/绿客户状态 · 价值分析 · 行动建议 |
| `system-finance-pulse` | 每天 10:00 | 成本异常 · 预算预警 · 省钱建议 |
| `weekly-report` | 每周一 9:00 | 概览 · 项目进展 · 关键指标 · 下周计划 |
| `health-check` | 每周日 10:00 | 四维度评分 (财务/客户/项目/目标) · 最弱项 · 改进建议 |
| `memory-extract` | 每周日 20:00 | PREFERENCE/DECISION/INFO/PATTERN 结构化记忆 |

### 4.4 提示词注入流程

```
1. 用户发送消息
2. prompt-selector 根据关键词选择提示词
3. 加载对应的 .txt 文件内容
4. 在系统提示末尾注入: "以下是你可以使用的工具: {工具列表 JSON}"
5. 加载最近 6 条对话历史
6. 发送给 AI 模型
```

---

## 五、AI 供应商管理

### 5.1 架构设计

```
前端设置页 → POST /settings/ai/providers → Setting 表 (category=AI_PROVIDER)
                                                    ↓
ai.service.ts ← 读取 provider + decrypt(API_KEY) → 创建 OpenAI 客户端
                                                    ↓
                                            任意 OpenAI 兼容 API
```

### 5.2 供应商兼容性

系统通过 OpenAI SDK 统一调用，只要供应商提供标准的 `/v1/chat/completions` 端点即可接入。

**当前支持 22 个预设供应商：**

| 区域 | 供应商 |
|------|--------|
| 海外 | OpenAI · Mistral · Groq · Together · xAI · Perplexity · Fireworks · Cerebras · Cohere · DeepInfra · Novita |
| 国内 | DeepSeek · 硅基流动 · 智谱 GLM · 通义千问 · 月之暗面 · 百度文心 · MiniMax · 阶跃星辰 · 豆包 · 零一万物 |
| 本地 | Ollama |

**支持自定义供应商**：用户可添加任意 OpenAI 兼容的 API 端点。

### 5.3 模型获取策略

```typescript
// 按优先级尝试 5 种响应格式
1. 数组格式: { data: [{ id: "model-name" }] }
2. data 格式: { models: ["model-name"] }
3. models 格式: { models: [{ name: "model-name" }] }
4. result 格式: { result: ["model-name"] }
5. key-value 格式: { "model-name": { ... } }

// 如果都失败 → 使用该供应商的预设模型列表
```

### 5.4 API Key 安全

- 所有 API Key 使用 AES-256-CBC 加密存储
- `Setting` 表 `encrypted=true` 字段自动加解密
- 前端展示时脱敏处理

---

## 六、定时任务体系 (8 个 Job)

### 6.1 任务总览

| 任务 | 调度 | 类型 | 功能 |
|------|------|------|------|
| `due-reminder` | 每天 8:00 | 数据检测 | 逾期任务提醒 |
| `morning-briefing` | 每天 8:00 | AI 分析 | 晨间行动计划 |
| `client-radar` | 每天 9:00 | AI 分析 | 客户关系预警 |
| `cost-alert` | 每天 10:00 | 数据检测 | 成本超支预警 |
| `finance-pulse` | 每天 10:00 | AI 分析 | 财务健康脉搏 |
| `weekly-report` | 每周一 9:00 | AI 分析 | 自动生成周报 |
| `health-check` | 每周日 10:00 | AI 分析 | 业务四维体检 |
| `weekly-memory` | 每周日 20:00 | AI 提取 | 对话记忆沉淀 |

### 6.2 执行流程

```
node-cron 触发
  ↓
遍历所有用户
  ↓
检查用户偏好设置 (taskReminder / systemNotify / projectNotify)
  ↓
收集业务数据 (Prisma 查询)
  ↓
[AiAnalysis 类型] → 调用 AIService + 对应提示词 → 生成分析报告
  ↓
创建 Notification 记录 (TASK_DUE / COST_ALERT / AI_INSIGHT)
  ↓
[如有邮件配置] → 发送邮件通知
```

### 6.3 系统任务管理

- 系统任务 (`isSystem=true`) 在首次启动时自动创建
- 用户可通过前端启用/禁用系统任务
- 用户可创建自定义任务 (自定义 cron 表达式 + action 类型)
- `ensureSystemJobs()` 确保系统任务不被删除，只能修改 enabled 状态

---

## 七、前端交互

### 7.1 AI 聊天 (SSE 流式)

```
POST /llm/chat/stream
  请求: { message, sessionId, model? }
  响应: SSE 事件流
    event: text       → { content: "片段文本" }
    event: tool_call  → { name: "tool_name", args: {...} }
    event: tool_result → { name: "tool_name", result: {...} }
    event: done       → { }
```

### 7.2 定时任务管理页 (`/main/ai`)

- 系统任务列表 (8 个预设，带开关)
- 自定义任务列表 (用户创建)
- 每个任务显示: 名称 · cron 表达式 · 中文描述 · action 类型 · 上次运行时间
- 支持: 启用/禁用 · 编辑 · 删除 · 重置系统任务

### 7.3 设置页 AI 配置

- 供应商选择 (22 个预设 + 自定义)
- API Key 输入 (加密存储)
- 模型获取 (自动拉取可用模型列表)
- 连接测试
- 搜索配置 (Tavily/SerpAPI + 参数调节)

---

## 八、数据模型

### 核心表

| 表 | 用途 |
|---|---|
| `Conversation` | 对话记录 (sessionId + role + content + toolCalls) |
| `Notification` | 通知 (type: TASK_DUE / COST_ALERT / AI_INSIGHT) |
| `CronJob` | 定时任务 (name + cronExpr + action + config + isSystem) |
| `UserMemory` | 用户记忆 (category + content + confidence + source) |
| `Setting` | 配置项 (category + key + value + encrypted) |

### Setting 表中的 AI 相关配置

| category | key | 说明 |
|----------|-----|------|
| `AI_PROVIDER` | `provider` | 当前使用的供应商名 |
| `AI_PROVIDER` | `api_key` | 加密的 API Key |
| `AI_PROVIDER` | `base_url` | API 端点 |
| `AI_PROVIDER` | `chat_model` | 聊天模型名 |
| `AI_PROVIDER` | `analysis_model` | 分析模型名 |
| `SEARCH` | `provider` | 搜索供应商 (tavily/serpapi) |
| `SEARCH` | `api_key` | 加密的搜索 API Key |
| `SEARCH` | `*` | 搜索参数 (topic/depth/timeRange 等) |

---

## 九、API 端点汇总

### LLM 路由 (`/api/llm`)

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/chat/stream` | SSE 流式聊天 |
| `POST` | `/chat` | 同步聊天 |
| `GET` | `/conversations` | 会话列表 |
| `GET` | `/conversations/:sessionId` | 会话详情 |
| `DELETE` | `/conversations/:sessionId` | 删除会话 |
| `GET` | `/tools` | 工具列表 (25 个) |

### 定时任务路由 (`/api/cron-jobs`)

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/` | 任务列表 (自动初始化系统任务) |
| `POST` | `/system/init` | 重置系统任务 |
| `GET` | `/:id` | 任务详情 |
| `POST` | `/` | 创建自定义任务 |
| `PUT` | `/:id` | 更新任务 |
| `DELETE` | `/:id` | 删除任务 |

### 设置路由 (`/api/settings`) AI 相关

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/ai/providers` | 获取所有可用供应商 |
| `POST` | `/ai/providers` | 保存供应商配置 |
| `DELETE` | `/ai/providers/:name` | 删除供应商 |
| `POST` | `/ai/fetch-models` | 获取供应商模型列表 |
| `POST` | `/ai/test` | 测试 AI 连接 |
| `GET` | `/search` | 获取搜索配置 |
| `PUT` | `/search` | 更新搜索配置 |

---

## 十、待实现功能

| 优先级 | 功能 | 说明 |
|--------|------|------|
| P1 | AI 聊天前端页面 | 当前 `/main/ai` 是定时任务管理，缺少独立的聊天界面 |
| P2 | 6 个 Capability 模块 | 任务/项目/客户/财务/时间/决策智能能力 (当前为空 stub) |
| P3 | 4 个 TODO 提示词 | task-parse / schedule-suggest / research-summary / system-template.ts |
| P3 | 对话记忆主动应用 | memory-extractor 已能提取记忆，但聊天时未主动注入用户偏好 |
| P4 | 工具调用权限控制 | 当前所有工具对所有用户开放，未实现细粒度权限 |
