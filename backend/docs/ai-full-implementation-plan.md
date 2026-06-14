# TaskFlow+ AI 模块完整实施方案

> 给 Claude 的实施指令文档。涵盖：AI 工具补齐 + 多媒体能力 + 预处理层 + 路由扩展。

---

## 一、现状分析

### 1.1 业务覆盖缺口

| 业务模块 | 后端函数数 | 现有 AI 工具 | 覆盖率 | 缺失 |
|----------|-----------|-------------|--------|------|
| 项目 Project | 6 | 2 (create, update) | 33% | list, detail, archive |
| 任务 Task | 7 | 5 (create, update_status, delete, log_time, schedule) | 71% | list, stats |
| 成本 Cost | 5 | 1 (get_cost_breakdown) | 20% | create, delete |
| 客户 Customer | 5 | 4 (create, update, follow_up, insights, ranking) | 80% | list, delete |
| 目标 Goal | 17 | 4 (get_progress, weekly_review, weekly_plan, health) | 24% | create, update, update_progress, list, overview |
| 流水 Transaction | 4 | 0 | 0% | 全部缺失 |
| 收款 Payment | 4 | 0 | 0% | 全部缺失 |
| 订阅 Subscription | 8 | 0 | 0% | 全部缺失 |
| 工时 Work/Timer | 10 | 0 | 0% | 全部缺失 |
| 报表 Report | 4 | 0 | 0% | 全部缺失 |
| 仪表盘 Dashboard | 4 | 0 | 0% | 全部缺失 |
| 通知 Notification | 11 | 1 (send_email) | 9% | list, unread, mark_read |
| 排程 Scheduler | 4 | 4 | 100% | — |

### 1.2 多媒体能力现状

```
前端 ChatInput 有两个 disabled 占位按钮：
  📎 Paperclip → "添加文件（即将上线）"
  🎤 Mic       → "语音输入（即将上线）"

后端：无文件上传/图片处理/PDF 解析/语音转录能力
数据库：Conversation 表是纯文本，无附件字段
```

### 1.3 数字总览

```
现有 AI 工具：48 个（14 写 + 34 读）
需要新增工具：约 39 个
完成后总数：约 87 个

新增文件：约 18 个
修改文件：约 10 个
新增 npm 依赖：4 个（multer, sharp, pdf-parse, @types/multer）
```

---

## 二、新增 AI 工具清单

### P0：核心业务（15 个工具）— 必须先做

#### 流水 Transaction — 整块缺失

| 工具名 | 读/写 | 功能 | 对应 Service 函数 |
|--------|------|------|-----------------|
| `list_transactions` | 读 | 查收支流水，支持方向/类别/项目/日期筛选 | `transaction.findAll` |
| `create_transaction` | 写 | 录入收入或支出 | `transaction.create` |
| `update_transaction` | 写 | 编辑手动录入的流水 | `transaction.update` |
| `delete_transaction` | 写 | 删除手动录入的流水 | `transaction.remove` |

#### 收款 Payment — 整块缺失

| 工具名 | 读/写 | 功能 | 对应 Service 函数 |
|--------|------|------|-----------------|
| `create_payment` | 写 | 录入项目收款（首付/进度款/尾款），自动创建关联流水 | `payment.create` |
| `list_payments` | 读 | 查询收款记录 | `payment.findAll` |
| `get_receivables` | 读 | 应收账款汇总（总额/已收/逾期/回款率） | `payment.getReceivables` |
| `get_aging_analysis` | 读 | 账龄分析（0-30/31-60/61-90/90+ 天） | `payment.getAgingAnalysis` |

#### 成本 Cost — 缺写操作

| 工具名 | 读/写 | 功能 | 对应 Service 函数 |
|--------|------|------|-----------------|
| `create_cost` | 写 | 录入项目成本（人工/材料/管理/其他） | `cost.create` |
| `delete_cost` | 写 | 删除成本记录 | `cost.remove` |

#### 项目 Project — 缺查询和归档

| 工具名 | 读/写 | 功能 | 对应 Service 函数 |
|--------|------|------|-----------------|
| `list_projects` | 读 | 项目列表，支持状态筛选，含预算/成本/利润 | `project.findAll` |
| `get_project_detail` | 读 | 项目详情（含任务/成本/客户） | `project.findById` |
| `archive_project` | 写 | 归档已完成项目 | `project.archive` |

#### 任务 Task — 缺查询和统计

| 工具名 | 读/写 | 功能 | 对应 Service 函数 |
|--------|------|------|-----------------|
| `list_tasks` | 读 | 任务列表，支持状态/优先级/项目筛选 | `task.findAll` |
| `get_task_stats` | 读 | 任务统计（总数/完成率/逾期数） | `task.findAll` 聚合 |

---

### P1：高频操作（12 个工具）

#### 客户 Customer — 缺列表和删除

| 工具名 | 读/写 | 功能 | 对应 Service 函数 |
|--------|------|------|-----------------|
| `list_customers` | 读 | 客户列表，支持状态筛选 | `customer.findAll` |
| `delete_customer` | 写 | 删除客户 | `customer.remove` |

#### 目标 Goal — 只读缺写操作

| 工具名 | 读/写 | 功能 | 对应 Service 函数 |
|--------|------|------|-----------------|
| `list_goals` | 读 | 目标列表 | `goal.findAll` |
| `get_goal_overview` | 读 | 目标总览（含风险预警） | `goal.getOverview` |
| `create_goal` | 写 | 创建目标（月度/季度/年度） | `goal.create` |
| `update_goal` | 写 | 更新目标信息 | `goal.update` |
| `update_goal_progress` | 写 | 更新目标进度值 | `goal.updateProgress` |

#### 工时 Work — 整块缺失

| 工具名 | 读/写 | 功能 | 对应 Service 函数 |
|--------|------|------|-----------------|
| `get_today_entries` | 读 | 今日已记录工时 | `work.getTodayEntries` |
| `get_active_timer` | 读 | 当前运行的计时器 | `work.getActiveTimer` |
| `list_todos` | 读 | 今日待办列表 | `work.getTodayTodo` |
| `add_todo` | 写 | 添加待办 | `work.addTodo` |
| `toggle_todo` | 写 | 完成/取消完成待办 | `work.toggleTodo` |

---

### P2：体验提升（9 个工具）

#### 报表 Report — 整块缺失

| 工具名 | 读/写 | 功能 | 对应 Service 函数 |
|--------|------|------|-----------------|
| `get_report_overview` | 读 | 报表总览（收入/支出/利润/利润率） | `report.getOverview` |
| `get_project_ranking` | 读 | 项目利润排名 | `report.getProjectRanking` |
| `get_cost_structure` | 读 | 成本结构分析 | `report.getCostStructure` |
| `get_time_analysis` | 读 | 工时分析 | `report.getTimeAnalysis` |

#### 仪表盘 Dashboard — 整块缺失

| 工具名 | 读/写 | 功能 | 对应 Service 函数 |
|--------|------|------|-----------------|
| `get_dashboard_summary` | 读 | 仪表盘汇总数据 | `dashboard.getStats` |
| `get_recent_activity` | 读 | 最近活动/任务 | `dashboard.getRecentTasks` |

#### 通知 Notification — 缺查询

| 工具名 | 读/写 | 功能 | 对应 Service 函数 |
|--------|------|------|-----------------|
| `list_notifications` | 读 | 通知列表 | `notification.findAll` |
| `get_unread_count` | 读 | 未读通知数量 | `notification.getUnreadCount` |
| `mark_as_read` | 写 | 标记通知已读 | `notification.markAsRead` |

---

### P3：进阶功能（5 个工具）

#### 订阅 Subscription — 整块缺失

| 工具名 | 读/写 | 功能 | 对应 Service 函数 |
|--------|------|------|-----------------|
| `list_subscriptions` | 读 | 订阅列表 | `subscription.findAll` |
| `get_subscription_cost` | 读 | 订阅费用汇总（月度/年度） | `subscription.getCostSummary` |
| `create_subscription` | 写 | 创建订阅 | `subscription.create` |
| `pause_subscription` | 写 | 暂停订阅 | `subscription.pause` |
| `resume_subscription` | 写 | 恢复订阅 | `subscription.resume` |

---

## 三、多媒体能力

### 3.1 语音输入

**方案：浏览器原生 Web Speech API，不做后端。**

```
用户点 🎤 → 浏览器弹权限 → 实时录音+识别 → 文字实时显示在输入框 → 用户点停止
全程前端完成，不经过后端，零成本。
Chrome/Edge 支持，Firefox 不支持（暂不降级）。
```

| 文件 | 操作 | 内容 |
|------|------|------|
| `frontend/src/hooks/useSpeechRecognition.ts` | 新增 | Web Speech API hook：start/stop/isListening/interimResult/finalResult |
| `frontend/src/components/features/ai/ChatInput.tsx` | 修改 | 启用 Mic 按钮，录音中显示脉动动画，识别结果实时写入 textarea |

**不改：AIService、数据库、后端路由、工具系统。**

### 3.2 图片上传

**方案：前端选择 → 后端压缩 → 发给多模态 AI 模型。**

```
用户选图片 → 前端预览 → 发送时用 FormData（代替 JSON）
→ 后端 multer 接收 → sharp 压缩到 500KB 以内（1568px + WebP 80%）
→ base64 编码 → content 数组格式 [{type:"text"}, {type:"image_url"}]
→ AI 直接看图回答（需多模态模型如 GPT-4o/Claude）
```

**压缩必要性**：10MB 原图 → 200KB 压缩后，token 从 3400 降到 ~50，视觉无损。

### 3.3 PDF 上传

**方案：pdf-parse 提取文字 → 按大小分级处理。**

```
PDF → pdf-parse 提取全文 → 估算 token 数
  小文件（<3000 token）→ 直接拼入消息
  大文件（>3000 token）→ 截取前 60%，或用便宜模型（DeepSeek）做 500 字摘要
→ 文字拼入 userContent → AI 基于文本回答

扫描型 PDF（text.length < 50）→ Phase 1 不支持，后续迭代加转图片流程。
```

### 3.4 文件上传 + 工具联动

**文件内容可以触发 AI 调用业务工具，不需要额外代码。**

```
示例：
  用户上传报价单.png + "根据报价单创建项目"
  → AI 看图识别出客户名、金额、工期
  → AI 调用 create_project 工具 → 自动创建项目

  用户上传发票.jpg + "帮我记录这笔成本"
  → AI 识别发票金额和类别
  → AI 调用 create_cost 工具 → 自动记录成本
```

需要在系统提示词中加一段文件处理指导，告诉 AI 可以从文件提取信息并调用工具。

### 3.5 预处理层架构

```
前端 → llm.routes.ts → file-process.service.ts → AIService → AI 模型
         (文本+文件)       ↑ 新增翻译层
                           │
                           图片进来 → sharp 压缩 → base64 出
                           PDF 进来 → pdf-parse → 文字出（大文件摘要）
                           │
                           AIService 零改动（已支持多模态 content 类型）
                           工具系统零改动
```

**没上传文件时，预处理层不介入，代码路径和现在一模一样。**

---

## 四、工具路由扩展

### 4.1 当前路由组（8 组）

```
system（始终加载）：get_current_time
notification（始终加载）：send_email, send_webhook, undo_last_tool
finance：5 个财务分析工具
work：10 个项目/任务工具
client：6 个客户工具
goal：4 个目标工具
schedule：5 个排程工具
search：5 个搜索工具
info：9 个信息工具
```

### 4.2 新增路由组（6 组）

```
transaction：list_transactions, create_transaction, update_transaction, delete_transaction
  关键词：流水、收入、支出、记账、入账、交易

payment：create_payment, list_payments, get_receivables, get_aging_analysis
  关键词：收款、付款、回款、应收账款、账龄

work_timer：get_today_entries, get_active_timer, list_todos, add_todo, toggle_todo
  关键词：工时、计时、待办、今日任务、打卡

report：get_report_overview, get_project_ranking, get_cost_structure, get_time_analysis
  关键词：报表、报告、排名、分析报告

dashboard：get_dashboard_summary, get_recent_activity
  关键词：仪表盘、总览、概况、汇总

subscription：list_subscriptions, get_subscription_cost, create_subscription, pause_subscription, resume_subscription
  关键词：订阅、续费、会员、SaaS
```

### 4.3 更新现有路由组

```
work 组：增加 list_projects, get_project_detail, archive_project, list_tasks, get_task_stats
client 组：增加 list_customers, delete_customer
goal 组：增加 list_goals, get_goal_overview, create_goal, update_goal, update_goal_progress
finance 组：增加 create_cost, delete_cost
```

---

## 五、数据库变更

### Conversation 表加 1 个字段

```prisma
model Conversation {
  // 现有字段不变 ...
  content               String
  attachments           String?   // 新增：JSON [{type, fileName, fileSize}]
  contextType           String?
  // ...
}
```

---

## 六、实现分期

### Phase 1：补齐 P0 核心工具（2-3 天）

```
新建 5 个工具文件：
  ai/tools/transaction-tools.ts     → list_transactions, create_transaction, update_transaction, delete_transaction
  ai/tools/payment-tools.ts        → create_payment, list_payments, get_receivables, get_aging_analysis
  ai/tools/cost-write.ts            → create_cost, delete_cost
  ai/tools/project-query.ts        → list_projects, get_project_detail, archive_project
  ai/tools/task-query.ts           → list_tasks, get_task_stats

更新 2 个文件：
  ai/tools/registry.ts              → 注册 15 个新工具
  ai/tools/tool-router.ts          → 新增 transaction、payment 组，更新 work、finance 组
```

### Phase 2：补齐 P1 工具 + 语音输入（2-3 天）

```
新建 3 个工具文件：
  ai/tools/customer-extra.ts       → list_customers, delete_customer
  ai/tools/goal-write.ts           → list_goals, get_goal_overview, create_goal, update_goal, update_goal_progress
  ai/tools/work-timer.ts           → get_today_entries, get_active_timer, list_todos, add_todo, toggle_todo

更新 2 个文件：
  registry.ts + tool-router.ts

前端新增：
  hooks/useSpeechRecognition.ts     → Web Speech API hook
前端修改：
  ChatInput.tsx                     → 启用 Mic 按钮 + 语音交互
```

### Phase 3：文件上传 + 预处理层（2-3 天）

```
安装依赖：npm install multer @types/multer sharp pdf-parse

新建 3 个文件：
  services/file-process.service.ts  → 预处理层（图片压缩 + PDF 提取 + 大文件摘要）
  components/ai/FilePreview.tsx     → 文件预览卡片
  components/ai/ImageLightbox.tsx   → 图片全屏查看

修改 6 个文件：
  schema.prisma                     → Conversation 加 attachments 字段（1 行）
  llm.routes.ts                     → 加 multer + 预处理 + 多模态消息构建（~50 行）
  ai.service.ts                     → mockChat 兼容多模态 content（3 行）
  ChatInput.tsx                     → 启用 📎 按钮 + 文件选择 + 拖拽
  MessageBubble.tsx                 → 渲染附件（图片缩略图 / PDF 图标）
  useAiChat.ts                      → sendMessage 支持 FormData

运行：npx prisma db push && npx prisma generate

提示词：system-search.txt 增加文件处理指导段落
```

### Phase 4：补齐 P2 + P3 工具（1-2 天）

```
新建 4 个工具文件：
  ai/tools/report-tools.ts         → get_report_overview, get_project_ranking, get_cost_structure, get_time_analysis
  ai/tools/dashboard-tools.ts      → get_dashboard_summary, get_recent_activity
  ai/tools/notification-tools.ts   → list_notifications, get_unread_count, mark_as_read
  ai/tools/subscription-tools.ts   → list_subscriptions, get_subscription_cost, create_subscription, pause_subscription, resume_subscription

更新 2 个文件：
  registry.ts + tool-router.ts
```

---

## 七、改动全景

### 新增文件（18 个）

```
后端工具（12 个）：
  ai/tools/transaction-tools.ts      4 个工具
  ai/tools/payment-tools.ts         4 个工具
  ai/tools/cost-write.ts             2 个工具
  ai/tools/project-query.ts         3 个工具
  ai/tools/task-query.ts            2 个工具
  ai/tools/customer-extra.ts        2 个工具
  ai/tools/goal-write.ts            5 个工具
  ai/tools/work-timer.ts            5 个工具
  ai/tools/report-tools.ts          4 个工具
  ai/tools/dashboard-tools.ts       2 个工具
  ai/tools/notification-tools.ts    3 个工具
  ai/tools/subscription-tools.ts    5 个工具

后端服务（1 个）：
  services/file-process.service.ts   文件预处理层

前端（5 个）：
  hooks/useSpeechRecognition.ts      语音识别 hook
  components/ai/FilePreview.tsx      文件预览卡片
  components/ai/ImageLightbox.tsx    图片全屏查看
```

### 修改文件（10 个）

```
后端（6 个）：
  ai/tools/registry.ts               注册 ~39 个新工具
  ai/tools/tool-router.ts           新增 6 个路由组 + 更新 4 个现有组
  routes/llm.routes.ts              加 multer + 预处理 + 消息构建
  services/ai.service.ts            mockChat 兼容多模态（3 行）
  prisma/schema.prisma              Conversation 加 attachments（1 行）
  prompts/system-search.txt         增加文件处理指导

前端（4 个）：
  components/ai/ChatInput.tsx        启用 📎🎤 + 文件选择 + 语音交互
  components/ai/MessageBubble.tsx    渲染附件
  hooks/useAiChat.ts                sendMessage 支持 FormData
```

### 不改动的部分

```
AIService 核心逻辑（chat/init/registerTools）→ 不改
所有现有 48 个工具的 handler 逻辑 → 不改
数据库其他表 → 不改
对话历史加载逻辑 → 不改
tool-router 现有路由组的匹配逻辑 → 不改（只加新组）
```

### 新增 npm 依赖

```
后端：multer, @types/multer, sharp, pdf-parse
前端：无（Web Speech API 浏览器原生）
```

---

## 八、工具开发规范

每个新工具遵循统一格式：

```typescript
import { prisma } from '../../server';
import { ToolDefinition } from './types';

export const listTransactionsTool: ToolDefinition = {
  name: 'list_transactions',
  description: `查询收支流水记录。支持按方向（收入/支出）、类别、项目、日期范围筛选。

使用时机:
- "查一下最近的流水"、"这个月有哪些支出"
- "收入记录"、"支出明细"

不使用时机:
- 查看现金流趋势 → 用 get_cash_flow
- 查看成本明细 → 用 get_cost_breakdown
- 录入新的流水 → 用 create_transaction

返回数据: 流水列表含 amount/direction/category/date/projectName，支持 page/limit 参数`,

  category: 'finance',
  access: 'read',
  requiresConfirmation: false,

  parameters: {
    type: 'object',
    properties: {
      direction:  { type: 'string', enum: ['INCOME', 'EXPENSE'], description: '筛选方向' },
      category:   { type: 'string', description: '筛选类别' },
      projectId:  { type: 'string', description: '筛选项目' },
      startDate:  { type: 'string', description: '开始日期 YYYY-MM-DD' },
      endDate:    { type: 'string', description: '结束日期 YYYY-MM-DD' },
      limit:      { type: 'number', description: '返回条数，默认 20' },
    },
  },

  handler: async (args, userId) => {
    const where: Record<string, unknown> = { userId };
    // ... 构建查询条件 ...

    const data = await prisma.transaction.findMany({
      where, take: (args.limit as number) || 20,
      orderBy: { date: 'desc' },
      include: { project: { select: { name: true } } },
    });

    // ... 汇总计算 ...

    return {
      meta: { tool: 'list_transactions', total: data.length },
      highlights: { totalIncome: ..., totalExpense: ..., net: ... },
      summary: `${data.length} 笔流水，收入 ¥${...}，支出 ¥${...}`,
      data: data.map(t => ({ ... })),
    };
  },
};
```

**开发规范要点：**
1. description 三段式：使用时机 / 不使用时机 / 返回数据
2. 返回格式：`{ meta, highlights, summary, data }`
3. 金额字段 ÷100（数据库存分，返回元）
4. 所有查询加 `userId` 过滤
5. 写操作设置 `access: 'write'` + `requiresConfirmation: true`

---

## 九、完成后统计

```
分类         读工具    写工具    合计
────────────────────────────────────
finance      11       2        13
work         12       8        20
client       5        4        9
goal         6        3        9
schedule     4        0        4
search       5        0        5
info         9        0        9
system       1        0        1
notification 0        3        3
payment      3        1        4
transaction  1        3        4
dashboard    2        0        2
report       4        0        4
subscription 2        3        5
────────────────────────────────────
合计         65       27       92
```

---

## 十、关键设计决策

```
1. 文件预处理在路由层完成，AIService 零改动
   → 隔离变化，预处理层只做格式转换，AIService 只管收标准 messages

2. 图片发给多模态 AI 模型直接"看"，不需要传统 OCR
   → DeepSeek Chat 不支持图片，图片消息需自动切换到支持视觉的模型

3. PDF 分级处理：小文件直接发，大文件用便宜模型做摘要
   → 避免全量发送浪费 token 和降低回答质量

4. 语音只用浏览器原生 Web Speech API
   → 零成本、实时、不经过后端

5. 文件上传 + 工具联动不需要额外代码
   → AI 同时看到文件内容和工具列表，自动决定调哪个工具

6. 没有文件上传时，预处理层不介入
   → 向后兼容，现有聊天流程完全不受影响
```
