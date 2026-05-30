# AI 模块开发规范文档

> TaskFlow+ AI 智能助手完整开发规范  
> 最后更新：2026-05-30

---

## 目录

1. [模块概述](#1-模块概述)
2. [技术栈与依赖](#2-技术栈与依赖)
3. [整体架构](#3-整体架构)
4. [文件结构](#4-文件结构)
5. [AIService 核心设计](#5-aiservice-核心设计)
6. [多供应商 API 调用规范](#6-多供应商-api-调用规范)
7. [工具系统设计](#7-工具系统设计)
8. [20 个工具完整定义](#8-20-个工具完整定义)
9. [Token 优化规范](#9-token-优化规范)
10. [写操作规范](#10-写操作规范)
11. [SSE 流式对话规范](#11-sse-流式对话规范)
12. [Prompt 模板规范](#12-prompt-模板规范)
13. [会话与记忆管理](#13-会话与记忆管理)
14. [前端开发规范](#14-前端开发规范)
15. [设置页 AI 配置规范](#15-设置页-ai-配置规范)
16. [实现顺序](#16-实现顺序)
17. [验收标准](#17-验收标准)

---

## 1. 模块概述

### 1.1 定位

AI 模块是 TaskFlow+ 的智能对话助手，通过自然语言与系统交互，帮助一人公司老板管理项目、任务、客户和财务。

### 1.2 核心能力

- **自然语言理解**：用户说人话，AI 理解意图
- **Function Calling**：AI 调用 20 个工具查询/操作数据库
- **流式输出**：SSE 逐字返回，用户体验流畅
- **多供应商适配**：支持 DeepSeek / OpenAI / Claude / Ollama
- **Mock 降级**：无 API Key 时功能不中断

### 1.3 与传统 AI 聊天的区别

```
传统 AI 聊天：
  用户提问 → AI 凭空回答（不知道你有什么项目）

TaskFlow+ AI：
  用户提问 → AI 调用工具查数据库 → 基于真实数据回答 → 还能执行操作
```

### 1.4 已就绪的基础

| 组件 | 状态 | 说明 |
|------|------|------|
| `openai` SDK | ✅ 已安装 | ^4.104.0，兼容 DeepSeek/OpenAI/Ollama |
| Header AI 按钮 | ✅ 已实现 | `onOpenAi` prop 已接入 |
| AiPanel.tsx | ✅ 已实现 | 419 行 UI，需替换 mock 数据 |
| Prisma AI 表 | ✅ 已定义 | Conversation / UserMemory / AiInsight |
| 9 个业务 Service | ✅ 已实现 | AI 工具可直接调用 |
| `/llm` 路由注册 | ✅ 已注册 | routes/index.ts 已挂载 |

---

## 2. 技术栈与依赖

### 2.1 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| openai | ^4.104.0 | AI API 调用（兼容多供应商） |
| express | ^5.1.0 | SSE 流式响应 |
| prisma | ^6.9.0 | 数据库操作 |
| zod | ^3.25.23 | 参数校验 |

### 2.2 前端

| 技术 | 用途 |
|------|------|
| EventSource / fetch + ReadableStream | SSE 流式接收 |
| @tanstack/react-query | 状态管理 |
| shadcn/ui | UI 组件 |

### 2.3 外部 API

| 供应商 | baseURL | 模型 | 特点 |
|--------|---------|------|------|
| DeepSeek | `https://api.deepseek.com` | deepseek-chat / deepseek-reasoner | 便宜，中文好 |
| OpenAI | `https://api.openai.com/v1` | gpt-4o / gpt-4o-mini | 全面，生态好 |
| Claude | `https://api.anthropic.com/v1` | claude-sonnet-4-20250514 | 推理强 |
| Ollama | `http://localhost:11434/v1` | llama3 / qwen2 | 本地免费 |

---

## 3. 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│  前端                                                        │
│  useAiChat hook → ChatPanel → SSE 流式渲染                   │
│  useSettings hook → SettingsPage → AI 配置卡片                │
├─────────────────────────────────────────────────────────────┤
│  API 层（llm.routes.ts）                                     │
│  POST /llm/chat/stream  — SSE 流式对话                       │
│  POST /llm/parse-task   — 自然语言解析任务                    │
│  GET  /llm/conversations — 会话列表                          │
│  GET  /llm/conversations/:sid — 会话详情                     │
│  DELETE /llm/conversations/:sid — 删除会话                   │
├─────────────────────────────────────────────────────────────┤
│  AI 引擎层                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐│
│  │ AIService    │ │ TokenGuard   │ │ ModelSelector        ││
│  │ 多供应商适配  │ │ 预处理/截断   │ │ 模型选择             ││
│  └──────┬───────┘ └──────────────┘ └──────────────────────┘│
│         ↓                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Tool Registry（20 个工具）                             │   │
│  │ 💰 经营分析(5) 📋 工作管理(7) 👥 客户经营(4) 🎯 目标(4) │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  会话管理层                                                  │
│  Conversation 表（对话记录）                                  │
│  UserMemory 表（长期记忆）                                    │
│  memory-extractor.ts（记忆提炼）                              │
├─────────────────────────────────────────────────────────────┤
│  基础设施层                                                  │
│  Setting 表（AI 配置）                                        │
│  EncryptionService（API Key 加密）                            │
│  config.ts（环境变量）                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 文件结构

```
backend/src/
├── config.ts                          # 环境变量统一管理
├── services/
│   ├── ai.service.ts                  # AI 核心服务（多供应商 + 流式 + Mock）
│   ├── encryption.service.ts          # AES 加密解密
│   ├── setting.service.ts             # 配置读写
│   └── cost.service.ts                # 成本查询（AI 工具依赖）
├── ai/
│   ├── token-guard.ts                 # Token 守门员（预处理/截断/模型选择）
│   ├── model-config.ts                # 供应商与模型配置
│   ├── memory-extractor.ts            # 对话记忆提炼
│   └── tools/
│       ├── types.ts                   # 工具标准接口定义
│       ├── registry.ts                # 工具注册中心（注册/查找/执行）
│       ├── get-profit-analysis.ts     # 💰 项目利润分析
│       ├── get-cash-flow.ts           # 💰 现金流查询
│       ├── get-cost-breakdown.ts      # 💰 成本明细
│       ├── get-revenue-by-client.ts   # 💰 客户收入排名
│       ├── get-project-margin.ts      # 💰 项目利润排名
│       ├── get-today-focus.ts         # 📋 今日焦点
│       ├── get-overdue-tasks.ts       # 📋 延期任务
│       ├── get-project-progress.ts    # 📋 项目进度
│       ├── create-task.ts             # 📋 创建任务（写）
│       ├── update-task-status.ts      # 📋 更新状态（写）
│       ├── log-time.ts                # 📋 记录工时（写）
│       ├── get-schedule.ts            # 📋 排期查询
│       ├── get-client-follow-up.ts    # 👥 待跟进客户
│       ├── get-client-insights.ts     # 👥 客户详情
│       ├── log-communication.ts       # 👥 记录沟通（写）
│       ├── get-client-ranking.ts      # 👥 客户价值排名
│       ├── get-goal-progress.ts       # 🎯 目标进度
│       ├── get-weekly-review.ts       # 🎯 周报
│       ├── suggest-weekly-plan.ts     # 🎯 周计划建议
│       └── get-business-health.ts     # 🎯 业务健康度
├── prompts/
│   ├── system-template.txt            # 系统提示模板
│   ├── task-parse.txt                 # 任务解析提示
│   ├── schedule-suggest.txt           # 排期建议提示
│   └── weekly-report.txt              # 周报生成提示
├── routes/
│   ├── llm.routes.ts                  # AI 对话路由
│   └── setting.routes.ts              # 设置路由（AI 配置）
├── validators/
│   └── llm.schema.ts                  # Zod 校验
└── middleware/
    └── (已有 auth / validate / errorHandler / rateLimit)

frontend/src/
├── hooks/
│   ├── useAiChat.ts                   # AI 对话 hook（SSE 流式）
│   └── useSettings.ts                 # 设置读写 hook
├── components/features/ai/
│   ├── ChatPanel.tsx                  # 对话面板主组件
│   ├── ChatInput.tsx                  # 输入组件
│   ├── ToolCallCard.tsx               # 工具调用展示卡片
│   └── ModelSelector.tsx              # 模型选择器
└── app/main/settings/
    └── page.tsx                       # 设置页（含 AI 配置卡片）
```

---

## 5. AIService 核心设计

### 5.1 类结构

```typescript
export class AIService {
  private client: OpenAI | null = null;
  private config: AIConfig | null = null;
  private userId: string;

  constructor(userId: string);

  // 初始化：从 Setting 表读取配置
  async init(): Promise<boolean>;

  // 流式对话（带工具调用循环）
  async *chat(options: {
    messages: Message[];
    model?: string;
  }): AsyncGenerator<StreamEvent>;

  // Mock 模式（无 API Key 时）
  private async *mockChat(messages: Message[]): AsyncGenerator<StreamEvent>;

  // 测试连接
  async testConnection(): Promise<{ success: boolean; message: string }>;
}
```

### 5.2 初始化流程

```
AIService.init(userId)
  ↓
读 Setting 表 WHERE userId AND category='AI'
  ↓
有配置？
  ├─ 是 → 解密 API Key → 创建 OpenAI 客户端 → return true
  └─ 否 → client = null → 后续走 Mock 模式 → return false
```

### 5.3 工具调用循环

```
用户消息 → AI 第 1 次调用
  ↓
AI 返回 tool_calls?
  ├─ 否 → 直接输出文字 → 结束
  └─ 是 → 执行工具 → 结果发回 AI → AI 第 2 次调用
                                ↓
                          AI 再次返回 tool_calls?
                            ├─ 否 → 输出文字 → 结束
                            └─ 是 → 继续循环（最多 5 轮）
```

### 5.4 StreamEvent 类型

```typescript
type StreamEvent =
  | { type: 'text'; content: string }           // AI 逐字输出
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }  // 调用工具
  | { type: 'tool_result'; name: string; result: unknown }              // 工具结果
  | { type: 'confirmation_required'; tool: string; args: any; message: string }  // 需要确认
  | { type: 'done' };                           // 流结束
```

---

## 6. 多供应商 API 调用规范

### 6.1 统一使用 openai SDK

所有供应商通过 OpenAI SDK 统一调用，只需切换 `baseURL` + `apiKey` + `model`。

```typescript
const client = new OpenAI({
  apiKey: 'sk-xxxxxxxx',
  baseURL: 'https://api.deepseek.com',  // 切换供应商只改这里
});
```

### 6.2 非流式调用

```typescript
const response = await client.chat.completions.create({
  model: 'deepseek-chat',
  messages: [
    { role: 'system', content: '你是 TaskFlow+ 智能助手...' },
    { role: 'user', content: '今天做什么' },
  ],
  tools: getAllToolDefinitions(),
  temperature: 0.7,
  max_tokens: 2048,
});

// 文字回复
const content = response.choices[0].message.content;

// 工具调用
const toolCalls = response.choices[0].message.tool_calls;
```

### 6.3 流式调用

```typescript
const stream = await client.chat.completions.create({
  model: 'deepseek-chat',
  messages: [...],
  tools: getAllToolDefinitions(),
  stream: true,
  temperature: 0.7,
  max_tokens: 2048,
});

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta;

  // 文字内容
  if (delta?.content) {
    yield { type: 'text', content: delta.content };
  }

  // 工具调用（流式拼接）
  if (delta?.tool_calls) {
    // 拼接 tool_calls 的 id/name/arguments
  }
}
```

### 6.4 工具结果发回 AI

```typescript
// AI 返回 tool_calls 后，把结果发回让 AI 继续生成
messages.push({
  role: 'assistant',
  content: null,
  tool_calls: toolCalls,
});

for (const tc of toolCalls) {
  const result = await executeTool(tc.function.name, args, userId);

  messages.push({
    role: 'tool',
    tool_call_id: tc.id,
    content: JSON.stringify(result),
  });
}

// 继续调用 AI
const response2 = await client.chat.completions.create({
  model,
  messages,
  tools,
  stream: true,
});
```

### 6.5 供应商配置表

```typescript
const PROVIDER_CONFIG = {
  deepseek: {
    baseURL: 'https://api.deepseek.com',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', tier: 'fast' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', tier: 'powerful' },
    ],
  },
  openai: {
    baseURL: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tier: 'fast' },
      { id: 'gpt-4o', name: 'GPT-4o', tier: 'powerful' },
    ],
  },
  ollama: {
    baseURL: 'http://localhost:11434/v1',
    models: [
      { id: 'llama3', name: 'Llama 3', tier: 'fast' },
      { id: 'qwen2', name: 'Qwen 2', tier: 'fast' },
    ],
  },
};
```

---

## 7. 工具系统设计

### 7.1 工具标准接口

```typescript
interface ToolDefinition {
  // 基本信息
  name: string;                    // 函数名，AI 引用用（snake_case）
  description: string;             // 功能说明 + 触发场景
  category: 'finance' | 'work' | 'client' | 'goal';

  // 参数定义（JSON Schema）
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };

  // 执行逻辑
  handler: (args: Record<string, unknown>, userId: string) => Promise<unknown>;

  // 行为控制
  access: 'read' | 'write';       // 读操作 or 写操作
  requiresConfirmation: boolean;   // 写操作是否需要用户确认
  preferredModel: 'fast' | 'balanced' | 'powerful';  // 推荐模型级别
}
```

### 7.2 工具注册中心

```typescript
// registry.ts

// 注册表
const tools: ToolDefinition[] = [ ... ];

// 按 name 索引
const toolMap = new Map<string, ToolDefinition>();

// 导出方法
export function getAllToolDefinitions(): ToolCall[];    // 给 AI 的 tools 参数
export function getTool(name: string): ToolDefinition;  // 按名查找
export function getToolsByCategory(category: string): ToolDefinition[];  // 按分类
export function getWriteTools(): ToolDefinition[];      // 所有写操作
export async function executeTool(name, args, userId): Promise<unknown>;  // 执行
```

### 7.3 工具分类

| 分类 | 图标 | 工具数 | 读 | 写 |
|------|------|--------|-----|-----|
| finance（经营分析） | 💰 | 5 | 5 | 0 |
| work（工作管理） | 📋 | 7 | 4 | 3 |
| client（客户经营） | 👥 | 4 | 3 | 1 |
| goal（目标规划） | 🎯 | 4 | 4 | 0 |
| **合计** | | **20** | **16** | **4** |

### 7.4 读写操作规范

```
读操作（16 个）：
  · 直接执行，不需要用户确认
  · 返回精简数据（见 Token 优化规范）
  · 使用 fast 模型

写操作（4 个）：
  · create_task / update_task_status / log_time / log_communication
  · 需要用户确认后才执行
  · 返回标准化结果（见写操作规范）
  · 使用 fast 模型
```

---

## 8. 20 个工具完整定义

### 8.1 💰 经营分析（5 个）

#### get_profit_analysis

```
name: get_profit_analysis
description: 分析项目利润，对比预算和实际支出，计算利润率。
             当用户问"赚了多少"、"利润"、"盈亏"时调用。
category: finance
access: read
requiresConfirmation: false
preferredModel: fast

parameters:
  projectId: string (可选) — 项目 ID，不传则分析所有活跃项目

handler 逻辑:
  1. 查 Project（有 budget 字段，单位：分）
  2. 查 CostRecord 按 projectId 汇总
  3. 计算 profit = budget - cost, margin = profit / budget
  4. 返回精简结果（不返回 ID、时间戳）

返回值格式:
  [{ projectName, budget(元), cost(元), profit(元), margin(百分比), status }]

token 控制:
  每条约 60 字符，最多 10 条，总计不超过 500 字符
```

#### get_cash_flow

```
name: get_cash_flow
description: 查询指定月份的现金流，包括收入和支出。
             当用户问"花了多少钱"、"这个月收支"、"现金流"时调用。
category: finance
access: read
requiresConfirmation: false
preferredModel: fast

parameters:
  month: string (可选) — 月份 YYYY-MM，不传默认当月

handler 逻辑:
  1. 查当月 CostRecord 按 category 汇总
  2. 查当月完成项目的 budget 作为收入
  3. 返回收入/支出/净额/分类明细

返回值格式:
  { income, expense, net, byCategory: [{ category, amount }] }

token 控制:
  约 200 字符
```

#### get_cost_breakdown

```
name: get_cost_breakdown
description: 成本明细分析，按类别和项目分组。
             当用户问"钱花在哪了"、"成本明细"时调用。
category: finance
access: read
requiresConfirmation: false
preferredModel: fast

parameters:
  projectId: string (可选) — 限定项目
  month: string (可选) — 限定月份

handler 逻辑:
  1. 查 CostRecord 按 category 分组汇总
  2. 查 CostRecord 按 projectId 分组汇总
  3. 补充项目名（不返回 projectId 给 AI）

返回值格式:
  { total, byCategory: [{ category, amount, percent }], byProject: [{ project, amount }] }

token 控制:
  约 300 字符
```

#### get_revenue_by_client

```
name: get_revenue_by_client
description: 按客户统计收入，分析客户价值。
             当用户问"哪个客户最赚钱"、"客户收入排名"时调用。
category: finance
access: read
requiresConfirmation: false
preferredModel: fast

parameters:
  limit: number (可选) — 返回前 N 个，默认全部

handler 逻辑:
  1. 查 Customer 及关联 Projects
  2. 按 customerId 汇总 budget
  3. 按总额降序排列

返回值格式:
  [{ clientName, company, totalRevenue, projectCount }]

token 控制:
  每条约 40 字符，最多 10 条
```

#### get_project_margin_ranking

```
name: get_project_margin_ranking
description: 项目利润排名，从高到低排列。
             当用户问"哪些项目利润最高"时调用。
category: finance
access: read
requiresConfirmation: false
preferredModel: fast

parameters:
  status: string (可选) — 筛选项目状态

handler 逻辑:
  1. 查 Project 及关联 CostRecord
  2. 计算每个项目的 profit = budget - cost
  3. 按 profit 降序排列

返回值格式:
  [{ projectName, client, budget, cost, profit, margin }]

token 控制:
  每条约 50 字符，最多 10 条
```

### 8.2 📋 工作管理（7 个）

#### get_today_focus

```
name: get_today_focus
description: 获取今日工作焦点，按紧急程度排序的待办任务，包含延期预警。
             当用户问"今天做什么"、"有什么任务"、"先做哪个"时调用。
category: work
access: read
requiresConfirmation: false
preferredModel: fast

parameters:
  topN: number (可选) — 返回前 N 个，默认 5

handler 逻辑:
  1. 查 Task WHERE status IN (TODO, IN_PROGRESS, BLOCKED)
  2. 按 priority ASC, dueDate ASC 排序
  3. 标记 flag: OVERDUE / DUE_TODAY / BLOCKED

返回值格式:
  [{ title, priority, project, dueDate, status, flag }]

token 控制:
  每条约 50 字符，最多 10 条
```

#### get_overdue_tasks

```
name: get_overdue_tasks
description: 获取已延期的任务列表。
             当用户问"有什么延期"、"哪些任务过期了"时调用。
category: work
access: read
requiresConfirmation: false
preferredModel: fast

parameters: 无

handler 逻辑:
  1. 查 Task WHERE dueDate < today AND status != DONE
  2. 计算 overdueDays

返回值格式:
  [{ title, priority, project, dueDate, overdueDays }]

token 控制:
  每条约 40 字符，最多 10 条
```

#### get_project_progress

```
name: get_project_progress
description: 查询项目完成进度。
             当用户问"这个项目完成多少了"、"进度怎么样"时调用。
category: work
access: read
requiresConfirmation: false
preferredModel: fast

parameters:
  projectId: string (可选)
  projectName: string (可选) — 模糊匹配，和 projectId 二选一

handler 逻辑:
  1. 模糊匹配项目
  2. 统计 Task 总数/DONE/IN_PROGRESS/BLOCKED
  3. 计算完成百分比

返回值格式:
  { projectName, status, total, done, inProgress, blocked, percent, budget }

token 控制:
  约 100 字符
```

#### create_task

```
name: create_task
description: 创建新任务。当用户说"创建任务"、"帮我记一下"时调用。执行前需确认。
category: work
access: write
requiresConfirmation: true
preferredModel: fast

parameters:
  title: string (必填)
  projectId: string (可选)
  projectName: string (可选) — 模糊匹配
  priority: string (可选) — 默认 MEDIUM
  estimatedHours: number (可选) — 默认 1
  dueDate: string (可选) — YYYY-MM-DD
  description: string (可选)

handler 逻辑:
  1. 解析 projectId（优先用 projectId，其次模糊匹配 projectName）
  2. 校验项目归属和状态
  3. prisma.task.create()

返回值格式（标准化）:
  {
    success: true,
    action: "创建任务",
    summary: "已创建任务「首页设计」，归属官网改版",
    details: {
      "任务名称": "首页设计",
      "所属项目": "官网改版",
      "优先级": "紧急",
      "预估工时": "8 小时",
      "截止日期": "6/1"
    }
  }

token 控制:
  约 120 字符
```

#### update_task_status

```
name: update_task_status
description: 更新任务状态或优先级。当用户说"标记完成"、"提高优先级"时调用。
category: work
access: write
requiresConfirmation: true
preferredModel: fast

parameters:
  taskTitle: string (必填) — 模糊匹配
  taskId: string (可选) — 精确匹配，优先级高于 taskTitle
  status: string (可选) — TODO/IN_PROGRESS/DONE/BLOCKED
  priority: string (可选) — URGENT/HIGH/MEDIUM/LOW

handler 逻辑:
  1. 模糊匹配任务
  2. 更新字段（status 改为 DONE 时自动写入 completedAt）
  3. prisma.task.update()

返回值格式（标准化）:
  {
    success: true,
    action: "更新任务",
    summary: "已更新「首页设计」：状态→已完成",
    details: { "任务名称": "首页设计", "新状态": "已完成" }
  }
```

#### log_time

```
name: log_time
description: 记录工时。当用户说"花了X小时"、"记录工时"时调用。
category: work
access: write
requiresConfirmation: true
preferredModel: fast

parameters:
  projectName: string (可选) — 模糊匹配
  taskTitle: string (可选) — 模糊匹配
  hours: number (必填)
  date: string (可选) — 默认今天
  description: string (可选)

handler 逻辑:
  1. 模糊匹配项目/任务
  2. prisma.timeEntry.create()

返回值格式（标准化）:
  {
    success: true,
    action: "记录工时",
    summary: "已记录 3 小时工时",
    details: { "工时": "3 小时", "项目": "官网改版", "日期": "今天" }
  }
```

#### get_schedule

```
name: get_schedule
description: 查询项目排期。当用户问"排期"、"什么时候能做完"时调用。
category: work
access: read
requiresConfirmation: false
preferredModel: fast

parameters:
  projectId: string (可选)
  projectName: string (可选)

handler 逻辑:
  1. 调用 scheduler.service.calculateSchedule()
  2. 截断到前 5 个任务

返回值格式:
  { tasks: [前5个], summary: { totalTasks, totalHours, delayedTasks, projectEnd } }

token 控制:
  截断到 300 字符
```

### 8.3 👥 客户经营（4 个）

#### get_client_follow_up

```
name: get_client_follow_up
description: 获取需要跟进的客户列表。
             当用户问"该联系谁"、"客户跟进"时调用。
category: client
access: read
requiresConfirmation: false
preferredModel: fast

parameters:
  limit: number (可选) — 默认 5

handler 逻辑:
  1. 查 ACTIVE/VIP 客户
  2. 每个客户查最后一条 Communication
  3. 按"距今天数"降序排列

返回值格式:
  [{ clientName, company, lastContact, daysSince, activeProjects, flag }]

token 控制:
  每条约 40 字符，最多 5 条
```

#### get_client_insights

```
name: get_client_insights
description: 查询客户全景。当用户问"这个客户怎么样"时调用。
category: client
access: read
requiresConfirmation: false
preferredModel: balanced

parameters:
  clientName: string (必填) — 模糊匹配

handler 逻辑:
  1. 模糊匹配客户
  2. 查关联项目 + 最近 3 条沟通记录
  3. 汇总总金额

返回值格式:
  { client: { name, company, status }, projects, totalRevenue, recentComms }

token 控制:
  截断沟通记录到 3 条，总计 300 字符
```

#### log_communication

```
name: log_communication
description: 记录与客户的沟通。当用户说"记录沟通"、"和XX聊了"时调用。
category: client
access: write
requiresConfirmation: true
preferredModel: fast

parameters:
  clientName: string (必填) — 模糊匹配
  type: string (可选) — EMAIL/PHONE/MEETING/CHAT/OTHER
  content: string (必填)
  nextFollowAt: string (可选) — YYYY-MM-DD

handler 逻辑:
  1. 模糊匹配客户
  2. prisma.communication.create()

返回值格式（标准化）:
  {
    success: true,
    action: "记录沟通",
    summary: "已记录与张总的电话沟通",
    details: { "客户": "张总", "类型": "电话", "内容": "设计方案确认..." }
  }
```

#### get_client_ranking

```
name: get_client_ranking
description: 客户价值排名。当用户问"哪个客户最重要"时调用。
category: client
access: read
requiresConfirmation: false
preferredModel: fast

parameters: 无

handler 逻辑:
  1. 查所有客户及关联项目
  2. 按总金额降序排列

返回值格式:
  [{ name, company, status, totalRevenue, projectCount }]

token 控制:
  每条约 30 字符，最多 10 条
```

### 8.4 🎯 目标规划（4 个）

#### get_goal_progress

```
name: get_goal_progress
description: 查询目标完成进度。当用户问"目标完成"、"进度怎么样"时调用。
category: goal
access: read
requiresConfirmation: false
preferredModel: fast

parameters:
  type: string (可选) — MONTHLY/QUARTERLY/YEARLY

handler 逻辑:
  1. 查 ACTIVE 目标
  2. 关联里程碑和最近 3 条进展日志
  3. 计算完成百分比

返回值格式:
  [{ title, type, percent, endDate, milestones, recentLogs }]

token 控制:
  每条约 40 字符，最多 10 条
```

#### get_weekly_review

```
name: get_weekly_review
description: 本周工作总结。当用户问"这周做了什么"、"周报"时调用。
category: goal
access: read
requiresConfirmation: false
preferredModel: balanced

parameters:
  weekStart: string (可选) — 周一日期，默认本周

handler 逻辑:
  1. 查本周完成的任务
  2. 汇总本周工时
  3. 汇总本周支出

返回值格式:
  { week, completedTasks: [前5个], totalHours, totalCost, taskCount }

token 控制:
  截断任务到 5 条，总计 200 字符
```

#### suggest_weekly_plan

```
name: suggest_weekly_plan
description: 生成下周工作计划建议。当用户说"安排下周"时调用。
category: goal
access: read
requiresConfirmation: false
preferredModel: balanced

parameters:
  weekStart: string (可选) — 默认下周一

handler 逻辑:
  1. 查所有未完成任务
  2. 调排期引擎计算
  3. 按天分配建议

返回值格式:
  { uncompletedTasks: [前10个], schedule, suggestion }

token 控制:
  截断到 400 字符
```

#### get_business_health

```
name: get_business_health
description: 业务健康度综合评估。当用户问"整体情况"、"业务健康度"时调用。
category: goal
access: read
requiresConfirmation: false
preferredModel: balanced

parameters: 无

handler 逻辑:
  1. 财务维度：利润率
  2. 客户维度：活跃客户数
  3. 项目维度：完成率/延期数
  4. 目标维度：平均进度
  5. 综合评分

返回值格式:
  { overall, score, finance: { score, detail }, clients, projects, goals, topConcerns }

token 控制:
  约 300 字符
```

---

## 9. Token 优化规范

### 9.1 问题

每次 AI 调用都按 token 计费。不优化的话，一次对话可能消耗 7000+ tokens。

### 9.2 四层优化

#### 第 1 层：工具返回精简数据

```
规范：
  · 单条记录最多 5 个关键字段
  · 列表最多返回 10 条
  · 单次工具返回不超过 500 字符
  · 金额用元不用分，不带小数
  · 日期用短格式（5/28 不是 2026-05-28T00:00:00.000Z）
  · 不返回数据库 ID（AI 不需要）
  · 不返回 createdAt / updatedAt
  · 不返回 description / notes（除非用户问）
```

#### 第 2 层：返回值截断机制

```typescript
function preprocessToolResult(result: unknown, maxChars = 500): unknown {
  const str = JSON.stringify(result);
  if (str.length <= maxChars) return result;

  // 数组：截断条数
  if (Array.isArray(result)) {
    return {
      data: result.slice(0, 5),
      total: result.length,
      showing: 5,
      note: `共 ${result.length} 条，显示前 5 条`,
    };
  }

  // 对象：提取关键字段
  // 字符串：直接截断
}
```

#### 第 3 层：对话历史裁剪

```typescript
function preprocessMessages(messages: Message[], maxTokens = 3000) {
  // 统计 token
  // 超过 → 保留 system + 最近 3 轮（6 条）
  // 还超 → 压缩 system prompt
  // 还超 → 减到最近 2 轮
}
```

#### 第 4 层：模型选择

```
简单查询（<50字 + ≤2 工具调用）→ fast 模型
复杂分析（>200字 或 >3 工具调用）→ powerful 模型
```

### 9.3 Token 预算

```
单次对话预算：
  系统提示 + 用户偏好  = 500 tokens（固定）
  历史对话（3 轮）     = 300 tokens（固定）
  用户新消息           = 100 tokens（平均）
  工具调用（3 次）     = 300 × 3 = 900 tokens
  AI 回复             = 300 tokens（平均）
  ─────────────────────────────
  单次总计             ≈ 2100 tokens

每天 50 次对话：
  DeepSeek: ≈ 105,000 tokens = ¥0.11/天
  OpenAI:   ≈ 105,000 tokens = ¥1.4/天
```

---

## 10. 写操作规范

### 10.1 确认机制

```
写操作工具返回 tool_calls 后：
  1. 后端检查 requiresConfirmation
  2. 如果需要确认 → 返回 confirmation_required 事件给前端
  3. 前端显示确认弹窗
  4. 用户确认 → 前端发 POST /llm/confirm-tool-call
  5. 后端执行工具
  6. 返回执行结果
```

### 10.2 返回值标准化

所有写操作工具返回统一结构：

```typescript
interface WriteResult {
  success: boolean;
  action: string;          // "创建任务" / "更新状态" / "记录工时" / "记录沟通"
  summary: string;         // 一句话摘要，AI 直接用
  details: Record<string, string>;  // 关键字段，中文 key
}
```

### 10.3 AI 回复规范

```
System Prompt 中规定：
  · 用 summary 字段作为回复开头
  · 用 details 中的字段逐行列出
  · 用 ✅ 标记成功，❌ 标记失败
  · 不添加工具返回中没有的信息
  · 不暴露 ID、时间戳等技术细节

示例：
  工具返回: { success: true, summary: "已创建任务「首页设计」", details: {...} }
  AI 回复: "✅ 已创建任务「首页设计」\n· 项目：官网改版\n· 优先级：紧急"
```

### 10.4 业务校验规则

| 工具 | 校验规则 |
|------|---------|
| create_task | ① 项目存在且属于用户 ② 项目非 COMPLETED/ARCHIVED ③ 截止日期不早于今天 |
| update_task_status | ① 任务存在且属于用户 ② DONE 自动写入 completedAt |
| log_time | ① 工时 0.5~24 ② 日期不晚于明天 |
| log_communication | ① 客户存在且属于用户 ② 内容不为空 |

---

## 11. SSE 流式对话规范

### 11.1 API 端点

```
POST /api/llm/chat/stream
Headers: Content-Type: application/json
Cookie: token=xxx（自动携带）
Body: { "message": "今天做什么", "sessionId": "session_abc" }

响应: Content-Type: text/event-stream
```

### 11.2 事件格式

```
data: {"type":"tool_call","name":"get_today_focus","args":{"topN":5}}

data: {"type":"tool_result","name":"get_today_focus","result":{"tasks":[...]}}

data: {"type":"text","content":"你"}
data: {"type":"text","content":"今天"}
data: {"type":"text","content":"有"}
...

data: {"type":"confirmation_required","tool":"create_task","args":{...},"message":"将创建任务..."}

data: [DONE]
```

### 11.3 前端处理

```typescript
const response = await fetch('/api/llm/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ message, sessionId }),
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  const lines = text.split('\n').filter(l => l.startsWith('data: '));

  for (const line of lines) {
    const data = line.slice(6);
    if (data === '[DONE]') break;

    const event = JSON.parse(data);

    switch (event.type) {
      case 'tool_call':
        // 显示 "🔍 正在查询..."
        break;
      case 'tool_result':
        // 更新为 "✅ 查询完成"
        break;
      case 'text':
        // 逐字追加到消息气泡
        break;
      case 'confirmation_required':
        // 显示确认弹窗
        break;
    }
  }
}
```

---

## 12. Prompt 模板规范

### 12.1 System Prompt 结构

```
你是 TaskFlow+ 智能助手，帮助一人公司老板管理项目、任务、客户和财务。

## 核心规则
1. 用户问到具体数据时，必须先调用工具查询，不要凭空编造
2. 执行写操作前，先确认用户意图
3. 回复简洁直接，用中文

## 工具使用策略
[每个工具的触发关键词]

## 写操作回复规范
[标准化回复格式]

## 数据处理规则
[不要列出超过 5 条，用汇总代替]

## 用户偏好（动态注入）
{user_preferences}

## 最近对话（动态注入）
{recent_conversations}
```

### 12.2 动态注入

```
每次调用 AI 前：
  1. 读 UserMemory 表 → 注入 {user_preferences}
  2. 读 Conversation 表最近 5 轮 → 注入 {recent_conversations}
  3. 拼装完整 messages 数组
```

---

## 13. 会话与记忆管理

### 13.1 对话存储

```
每次对话存入 Conversation 表：
  · 用户消息：role="user"
  · AI 回复：role="assistant"
  · 工具调用：role="assistant", toolName="xxx"
  · 工具结果：role="tool", toolName="xxx"
```

### 13.2 滑动窗口

```
Conversation 表可能有 100 条消息
  → buildMessages() 只取最近 10 条（5 轮）
  → Token 守门员进一步裁剪到 6 条（3 轮）
```

### 13.3 记忆提炼

```
对话结束后自动触发：
  1. 读取本次完整对话
  2. 用便宜模型（fast）提炼关键信息
  3. 输出 JSON: [{ key, value, category }]
  4. upsert 到 UserMemory 表
  5. 多次提及 → confidence 递增
```

---

## 14. 前端开发规范

### 14.1 useAiChat hook

```typescript
export function useAiChat() {
  // 状态
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentToolCall, setCurrentToolCall] = useState<ToolCallEvent | null>(null);

  // 发送消息（SSE 流式）
  async function sendMessage(message: string, sessionId: string): Promise<void>;

  // 加载历史
  async function loadHistory(sessionId: string): Promise<void>;

  // 会话管理
  async function getSessions(): Promise<Session[]>;
  async function deleteSession(sessionId: string): Promise<void>;

  return { messages, isLoading, currentToolCall, sendMessage, loadHistory, ... };
}
```

### 14.2 ChatPanel 组件

```
改造现有 AiPanel.tsx：
  · 替换 generateMockResponse() 为 useAiChat().sendMessage()
  · 替换本地 state 为 API 持久化
  · 添加 ToolCallCard 组件展示工具调用过程
  · 添加 ModelSelector 组件（顶栏模型切换）
```

### 14.3 ToolCallCard 组件

```typescript
function ToolCallCard({ name, status }: { name: string; status: 'calling' | 'done' | 'error' }) {
  const display = TOOL_DISPLAY[name];  // { icon, label }
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      {status === 'calling' && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === 'done' && <Check className="h-3 w-3 text-green-500" />}
      {status === 'error' && <X className="h-3 w-3 text-red-500" />}
      <span>{display.icon} {display.label}</span>
    </div>
  );
}
```

---

## 15. 设置页 AI 配置规范

### 15.1 配置卡片布局

```
┌─────────────────────────────────────────────────┐
│  AI 配置                                         │
├─────────────────────────────────────────────────┤
│  供应商: [DeepSeek ▼]                            │
│  API Key: [sk-xxxx...xxxx  👁]                   │
│  默认模型: [DeepSeek Chat ▼]                     │
│  复杂任务模型: [DeepSeek Reasoner ▼]             │
│                                                  │
│  [测试连接]  [保存]                               │
│                                                  │
│  连接状态: ✅ 连接成功 (deepseek-chat)            │
└─────────────────────────────────────────────────┘
```

### 15.2 模型列表获取

```
切换供应商时：
  前端 GET /api/settings/ai/models?provider=deepseek
  → 后端返回该供应商的模型列表
  → 前端更新下拉框选项
```

### 15.3 配置存储

```
Setting 表：
  userId | category | key           | value              | encrypted
  user1  | AI       | provider      | deepseek           | false
  user1  | AI       | api_key       | sk-xxxx (AES加密)  | true
  user1  | AI       | base_url      | https://api...     | false
  user1  | AI       | default_model | deepseek-chat      | false
  user1  | AI       | powerful_model| deepseek-reasoner  | false
```

---

## 16. AI 工作区面板规范

### 16.1 现有 AiPanel 结构

现有 `AiPanel.tsx`（419 行）是一个右侧滑入面板，包含：

```
┌──────────────────────────────────────────────────────────────┐
│  TaskFlow+ AI    [新对话] [历史]                    [关闭 ×]   │
├────────────┬─────────────────────────────────────────────────┤
│  工作区     │  对话区                                          │
│            │                                                 │
│  [项目|任务 │  🤖 你好！我是 TaskFlow+ AI 助手                 │
│   |团队]   │     我可以帮你查看任务、分析项目进度...             │
│            │                                                 │
│  ┌────────┐│  👤 今天有哪些待办任务？                          │
│  │项目概览 ││                                                 │
│  │官网 64% ││  🤖 📋 当前待办任务：                            │
│  │████░░  ││     1. 首页重构 — 高优先级...                     │
│  │小程序95%││     2. 设计稿评审 — 高优先级...                   │
│  │████████││                                                 │
│  │营销 33% ││  ┌─────────────────────────┐  [发送]             │
│  │██░░░░  ││  │ 输入消息...              │                    │
│  └────────┘│  └─────────────────────────┘                    │
│            │                                                 │
│  ┌────┐┌────┐┌────┐                                          │
│  │📋待 ││📊项 ││🎯优 │                                         │
│  │办任 ││目进 ││先建 │                                         │
│  │务  ││度  ││议  │                                           │
│  └────┘└────┘└────┘                                          │
└────────────┴─────────────────────────────────────────────────┘
```

### 16.2 当前问题

```
❌ 左侧工作区用的是硬编码 mock 数据
   · projectSnapshots — 写死 3 个项目
   · taskHighlights — 写死 4 个任务
   · teamMembers — 写死 2 个人

❌ 对话用的是 generateMockResponse() 关键词匹配
   · 不调 AI API
   · 不查数据库
   · 回复是预设文本

❌ 会话管理是本地 state
   · 刷新页面对话丢失
   · 不保存到 Conversation 表
```

### 16.3 改造方案

#### 16.3.1 左侧工作区：接入真实数据

```
原来：硬编码 mock 数组
改为：用 React Query hooks 获取真实数据

项目概览 → useProjectList() → 已实现的 hook
任务高亮 → useTaskList({ status: 'TODO,IN_PROGRESS' }) → 已实现的 hook
团队负载 → 暂时隐藏（一人公司没有团队）或改为"时间分配"
```

**改造后的数据流：**

```typescript
// 项目概览标签页
const { data: projects } = useProjectList({ status: 'ACTIVE' });
// → 显示真实项目的进度、任务数、截止日期

// 任务标签页
const { data: tasks } = useTaskList({ status: 'TODO,IN_PROGRESS' });
// → 显示真实待办任务，按优先级排序

// 快捷提问按钮
const quickPrompts = [
  { icon: CheckSquare, label: '今日焦点', text: '今天做什么？' },
  { icon: TrendingUp, label: '项目进度', text: '项目完成情况怎么样？' },
  { icon: BarChart3, label: '成本分析', text: '这个月花了多少钱？' },
  { icon: AlertCircle, label: '风险预警', text: '有什么延期的任务？' },
  { icon: Users, label: '客户跟进', text: '该联系哪个客户了？' },
  { icon: Lightbulb, label: '周计划', text: '帮我安排下周的工作' },
];
```

#### 16.3.2 右侧对话区：接入 SSE 流式

```
原来：generateMockResponse() + setTimeout 模拟延迟
改为：useAiChat().sendMessage() + SSE 流式接收

handleSend 函数改造：

// 旧代码
async function handleSend(text) {
  setIsLoading(true);
  await new Promise(r => setTimeout(r, 1000));
  const aiMsg = generateMockResponse(content);
  // ...
}

// 新代码
async function handleSend(text) {
  setIsLoading(true);
  try {
    await sendMessage(content, activeSessionId);
    // sendMessage 内部处理 SSE 流式，自动更新 messages state
  } catch (err) {
    // 错误处理
  } finally {
    setIsLoading(false);
  }
}
```

#### 16.3.3 工具调用展示

```
在对话消息列表中，工具调用显示为卡片：

┌─────────────────────────────────────────┐
│ 🤖                                      │
│ ┌─────────────────────────────────────┐ │
│ │ 🔍 正在查询今日任务...      ✅ 完成  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ 你今天有 3 个待办任务：                   │
│ · 首页设计 — 紧急，明天截止              │
│ · 前端开发 — 高优先级                    │
│ · 联调测试 — 中优先级                    │
└─────────────────────────────────────────┘
```

**ToolCallCard 组件：**

```typescript
interface ToolCallEvent {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'calling' | 'done' | 'error';
}

function ToolCallCard({ event }: { event: ToolCallEvent }) {
  const display: Record<string, { icon: string; label: string }> = {
    get_today_focus:       { icon: '📋', label: '查询今日任务' },
    get_profit_analysis:   { icon: '💰', label: '分析项目利润' },
    get_cash_flow:         { icon: '📊', label: '查询现金流' },
    get_client_follow_up:  { icon: '👥', label: '查询待跟进客户' },
    get_goal_progress:     { icon: '🎯', label: '查询目标进度' },
    get_schedule:          { icon: '📅', label: '查询排期' },
    create_task:           { icon: '✅', label: '创建任务' },
    update_task_status:    { icon: '✏️', label: '更新任务状态' },
    log_time:              { icon: '⏱', label: '记录工时' },
    log_communication:     { icon: '💬', label: '记录沟通' },
    get_business_health:   { icon: '🏥', label: '评估业务健康度' },
    get_overdue_tasks:     { icon: '⚠️', label: '查询延期任务' },
    get_project_progress:  { icon: '📊', label: '查询项目进度' },
    get_cost_breakdown:    { icon: '💰', label: '查询成本明细' },
    get_weekly_review:     { icon: '📝', label: '生成周报' },
    suggest_weekly_plan:   { icon: '📝', label: '生成周计划' },
    get_client_insights:   { icon: '👤', label: '查询客户详情' },
    get_client_ranking:    { icon: '🏆', label: '客户价值排名' },
    get_revenue_by_client: { icon: '💰', label: '查询客户收入' },
    get_project_margin_ranking: { icon: '📈', label: '查询项目利润排名' },
  };

  const info = display[event.name] || { icon: '🔧', label: event.name };

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
      {event.status === 'calling' && <Loader2 className="h-3 w-3 animate-spin" />}
      {event.status === 'done' && <Check className="h-3 w-3 text-green-500" />}
      {event.status === 'error' && <X className="h-3 w-3 text-red-500" />}
      <span>{info.icon} {info.label}</span>
    </div>
  );
}
```

#### 16.3.4 会话管理改造

```
原来：本地 state，刷新丢失
改为：API 持久化

会话列表：
  GET /api/llm/conversations → 返回会话列表
  → 前端显示在历史面板

新建会话：
  前端生成 sessionId → 后端自动创建

切换会话：
  GET /api/llm/conversations/:sessionId → 返回该会话的消息
  → 前端切换显示

删除会话：
  DELETE /api/llm/conversations/:sessionId
```

#### 16.3.5 顶栏模型选择器

```
在面板顶栏添加模型选择器：

┌──────────────────────────────────────────────────────────────┐
│  TaskFlow+ AI    [DeepSeek Chat ▼]  [新对话] [历史]  [关闭 ×] │
├────────────┬─────────────────────────────────────────────────┤

点击下拉：
  ┌──────────────────────┐
  │ ● DeepSeek Chat      │ ← 当前选中
  │   DeepSeek Reasoner  │
  │   GPT-4o Mini        │
  │   GPT-4o             │
  └──────────────────────┘

切换后：
  · 更新 useAiChat 的 model 参数
  · 只影响当前会话，不改全局设置
  · 底部显示"使用 DeepSeek Chat"
```

### 16.4 改造后的完整布局

```
┌──────────────────────────────────────────────────────────────┐
│  TaskFlow+ AI    [DeepSeek Chat ▼]  [新对话] [历史]  [关闭 ×] │
├────────────┬─────────────────────────────────────────────────┤
│  工作区     │  对话区                                          │
│            │                                                 │
│  [项目|任务 │  消息列表（滚动）                                 │
│   tab]     │  ┌─────────────────────────────────────────┐    │
│            │  │ 🤖 你好！我是 TaskFlow+ AI 助手           │    │
│  ┌────────┐│  └─────────────────────────────────────────┘    │
│  │真实项目 ││                                                 │
│  │进度数据 ││  👤 今天做什么？                                 │
│  │        ││                                                 │
│  │官网 60% ││  🤖 ┌─────────────────────────────────────┐    │
│  │3/5 完成 ││     │ 📋 查询今日任务...           ✅ 完成  │    │
│  │        ││     └─────────────────────────────────────┘    │
│  │App 80% ││                                                 │
│  │4/5 完成 ││  🤖 你今天有 3 个待办任务：                      │
│  └────────┘│     · 首页设计 — 紧急，明天截止                  │
│            │     · 前端开发 — 高优先级                        │
│  ┌────┐┌────┐     · 联调测试 — 中优先级                      │
│  │📋今 ││💰成 │                                               │
│  │日焦 ││本分 │  ┌─────────────────────────┐  [发送]          │
│  │点  ││析  │  │ 输入消息...              │                  │
│  └────┘└────┘  └─────────────────────────┘                  │
│  ┌────┐┌────┐  使用 DeepSeek Chat                            │
│  │⚠️风 ││📝周 │                                               │
│  │险预 ││计划 │                                               │
│  │警  ││   │                                                │
│  └────┘└────┘                                               │
└────────────┴─────────────────────────────────────────────────┘
```

### 16.5 左侧工作区三个 Tab 设计

#### Tab 1：项目概览（默认）

```
数据来源：useProjectList({ status: 'ACTIVE' })

显示内容：
  · 每个项目一张小卡片
  · 项目名 + 进度条 + 任务完成数 + 截止日期
  · 点击项目卡片 → 自动发送"查看 XX 项目详情"

┌──────────────────────┐
│ 官网改版              │
│ ██████░░░░ 60%       │
│ 3/5 任务 · 截止 6/1   │
├──────────────────────┤
│ App 开发              │
│ ████████░░ 80%       │
│ 4/5 任务 · 截止 6/15  │
└──────────────────────┘
```

#### Tab 2：任务列表

```
数据来源：useTaskList({ status: 'TODO,IN_PROGRESS' })

显示内容：
  · 按优先级排序的待办任务
  · 优先级圆点 + 任务名 + 截止日期
  · 点击任务 → 自动发送"查看 XX 任务详情"

┌──────────────────────┐
│ 🔴 首页设计   明天    │
│ 🟠 前端开发   6/5    │
│ 🟡 联调测试   6/10   │
└──────────────────────┘
```

#### Tab 3：快捷操作

```
原来叫"团队"，一人公司改为"快捷操作"

显示内容：
  · 6 个快捷提问按钮
  · 点击自动填入输入框并发送

┌──────────────────────┐
│ 📋 今日焦点           │
│ 📊 项目进度           │
│ 💰 成本分析           │
│ ⚠️ 风险预警           │
│ 👥 客户跟进           │
│ 📝 周计划             │
└──────────────────────┘
```

### 16.6 需要改造的文件

| 文件 | 改动 |
|------|------|
| `AiPanel.tsx` | 替换 mock 数据为真实 hooks，接入 useAiChat，添加 ToolCallCard，添加 ModelSelector |
| `useAiChat.ts` | 新建，SSE 流式对话 hook |
| `ToolCallCard.tsx` | 新建，工具调用展示组件 |
| `ModelSelector.tsx` | 新建，模型下拉选择器 |
| `ChatPanel.tsx` | 可能合并到 AiPanel，或作为子组件 |
| `ChatInput.tsx` | 可能合并到 AiPanel，或作为子组件 |

### 16.7 AiPanel 与 Header 的集成

```
Header.tsx 已有 onOpenAi prop 和 AI 按钮

AppLayout 中需要管理 AiPanel 的 open 状态：

function AppLayout({ children }) {
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <div>
      <Sidebar />
      <div>
        <Header onOpenAi={() => setAiOpen(true)} />
        {children}
      </div>
      <AiPanel open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}
```

---

## 17. 实现顺序

```
第 1 步：config.ts（后端启动依赖）
  → 统一管理环境变量
  → 导出 port / jwtSecret / encryptionKey 等

第 2 步：encryption.service.ts（API Key 加密）
  → AES-256-CBC 加密/解密
  → 依赖 config.encryptionKey

第 3 步：setting.service.ts + setting.routes.ts（配置读写）
  → get / set / batch 操作
  → AI 配置卡片的数据来源

第 4 步：cost.service.ts（成本查询）
  → AI 经营分析工具依赖
  → 按项目/类别汇总

第 5 步：ai.service.ts（核心引擎）
  → 多供应商适配
  → 流式对话 + 工具调用循环
  → Mock 降级

第 6 步：ai/tools/（工具框架）
  → types.ts（接口定义）
  → registry.ts（注册中心）
  → token-guard.ts（Token 守门员）

第 7 步：llm.schema.ts + llm.routes.ts（API 端点）
  → SSE 流式对话
  → 会话 CRUD
  → 工具确认

第 8 步：20 个工具实现
  → 按分类逐步实现
  → 每个工具写完立即测试

第 9 步：prompts/ 模板
  → system-template.txt
  → 其他按需

第 10 步：前端 useSettings + settings/page.tsx
  → AI 配置卡片
  → 模型列表获取

第 11 步：前端 useAiChat hook
  → SSE 流式接收
  → 会话管理
  → 工具调用状态

第 12 步：改造 AiPanel 工作区面板
  → 左侧工作区接入真实数据（useProjectList / useTaskList）
  → 右侧对话区接入 useAiChat
  → 添加 ToolCallCard 工具调用展示
  → 添加 ModelSelector 模型选择器
  → 改造会话管理为 API 持久化
  → 集成到 AppLayout（Header 的 onOpenAi 按钮）

第 13 步：memory-extractor.ts
  → 对话记忆提炼
  → 最后做，不阻塞核心功能
```

---

## 17. 验收标准

### 17.1 功能验收

```
□ 设置页能选择供应商、填 API Key、选模型、测试连接、保存
□ 切换供应商时模型列表自动更新
□ 对话面板能发送消息、接收流式回复
□ AI 能调用读操作工具并返回正确数据
□ AI 能调用写操作工具并创建/更新数据
□ 写操作执行前有确认弹窗
□ 工具调用过程在 UI 上有展示（🔍 → ✅）
□ 无 API Key 时 Mock 模式可用
□ 对话历史能保存和加载
□ 能切换会话
```

### 17.2 性能验收

```
□ 单次对话 token 消耗 ≤ 3000
□ 工具返回值 ≤ 500 字符
□ SSE 首字响应 ≤ 3 秒
□ 工具执行超时 10 秒自动中断
```

### 17.3 安全验收

```
□ API Key 加密存储（AES-256）
□ 写操作有确认机制
□ 工具校验 ownerId（不能操作他人数据）
□ Zod 校验所有参数
□ 对话记录可追溯（Conversation 表）
```

### 17.4 体验验收

```
□ 对话面板加载 / 空状态 / 错误状态完整
□ 工具调用过程透明可见
□ AI 回复格式统一（✅/❌ + 分行列出）
□ 模型切换即时生效
□ 底部显示当前模型和 token 消耗
```

---

## 附录

### A. 前置依赖清单

| 依赖 | 状态 | 说明 |
|------|------|------|
| config.ts | ❌ 缺失 | 后端启动依赖 |
| encryption.service.ts | ❌ 空壳 | API Key 加密 |
| setting.service.ts | ❌ 空壳 | 配置读写 |
| setting.routes.ts | ❌ 空壳 | 配置 API |
| cost.service.ts | ❌ 空壳 | 成本查询 |

### B. AI 模块文件清单

| 文件 | 类型 | 状态 |
|------|------|------|
| ai.service.ts | 服务 | ❌ 空壳 |
| ai/tools/types.ts | 类型 | ❌ 待创建 |
| ai/tools/registry.ts | 框架 | ❌ 待创建 |
| ai/token-guard.ts | 工具 | ❌ 待创建 |
| ai/model-config.ts | 配置 | ❌ 待创建 |
| ai/memory-extractor.ts | 服务 | ❌ 待创建 |
| ai/tools/*.ts (20个) | 工具 | ❌ 空壳 |
| prompts/*.txt (4个) | 模板 | ❌ 空文件 |
| llm.routes.ts | 路由 | ❌ 空壳 |
| llm.schema.ts | 校验 | ❌ 空壳 |

### C. 前端文件清单

| 文件 | 类型 | 状态 |
|------|------|------|
| useAiChat.ts | hook | ❌ 空壳 |
| useSettings.ts | hook | ❌ 空壳 |
| ChatPanel.tsx | 组件 | ❌ 空壳 |
| ChatInput.tsx | 组件 | ❌ 空壳 |
| ToolCallCard.tsx | 组件 | ❌ 待创建 |
| ModelSelector.tsx | 组件 | ❌ 待创建 |
| settings/page.tsx | 页面 | ❌ 占位文本 |

### D. 参考文档

| 文档 | 路径 |
|------|------|
| 后端开发规则 | backend/CLAUDE.md |
| 前端开发规则 | frontend/CLAUDE.md |
| 项目总体规则 | CLAUDE.md |
| 开发总文档 | docs/development-docs.html |
| 并行开发计划 | docs/parallel-development-plan.md |
