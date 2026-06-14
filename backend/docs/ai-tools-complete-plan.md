# TaskFlow+ AI 模块完整优化规划

## 一、现状总览

### 1.1 业务模型 vs AI 工具覆盖

| 业务模块 | 后端 Service 函数数 | 现有 AI 工具数 | 覆盖率 |
|----------|-------------------|---------------|--------|
| 项目 Project | 6 个 | 2 个 (create, update) | 33% |
| 任务 Task | 7 个 | 5 个 (create, update_status, delete, log_time, get_schedule) | 71% |
| 成本 Cost | 5 个 | 1 个 (get_cost_breakdown) | 20% |
| 客户 Customer | 5 个 | 4 个 (create, update, follow_up, insights, ranking) | 80% |
| 目标 Goal | 17 个 | 4 个 (get_progress, weekly_review, weekly_plan, health) | 24% |
| 流水 Transaction | 4 个 | 0 个 | 0% |
| 收款 Payment | 4 个 | 0 个 | 0% |
| 订阅 Subscription | 8 个 | 0 个 | 0% |
| 工时 Work/Timer | 10 个 | 0 个 | 0% |
| 报表 Report | 4 个 | 0 个 | 0% |
| 仪表盘 Dashboard | 4 个 | 0 个 | 0% |
| 通知 Notification | 11 个 | 1 个 (send_email) | 9% |
| 排程 Scheduler | 4 个 | 4 个 (assess, advice, rebalance, insertion) | 100% |

### 1.2 当前工具总数

```
已有 AI 工具：48 个（14 个写操作 + 34 个读操作）
需要新增：约 30 个
完成后总数：约 78 个
```

---

## 二、需要新增的 AI 工具（按优先级）

### P0：核心业务工具（必须有）

用户最可能通过 AI 对话操作的功能，缺失导致 AI 无法完成基本业务操作。

#### 2.1 流水模块 Transaction — 整块缺失

| 工具名 | 类型 | 功能 | 对应 Service |
|--------|------|------|-------------|
| `list_transactions` | 读 | 查询收支流水，支持按方向/类别/项目/日期筛选 | `transaction.findAll` |
| `create_transaction` | 写 | 录入一笔收入或支出 | `transaction.create` |
| `update_transaction` | 写 | 编辑手动录入的流水 | `transaction.update` |
| `delete_transaction` | 写 | 删除手动录入的流水 | `transaction.remove` |

#### 2.2 收款模块 Payment — 整块缺失

| 工具名 | 类型 | 功能 | 对应 Service |
|--------|------|------|-------------|
| `create_payment` | 写 | 录入项目收款（首付/进度款/尾款） | `payment.create` |
| `list_payments` | 读 | 查询收款记录 | `payment.findAll` |
| `get_receivables` | 读 | 查应收账款汇总（总额/已收/逾期） | `payment.getReceivables` |
| `get_aging_analysis` | 读 | 账龄分析（0-30天/31-60天/61-90天/90+天） | `payment.getAgingAnalysis` |

#### 2.3 成本模块 Cost — 缺写操作

| 工具名 | 类型 | 功能 | 对应 Service |
|--------|------|------|-------------|
| `create_cost` | 写 | 录入项目成本（人工/材料/管理/其他） | `cost.create` |
| `delete_cost` | 写 | 删除成本记录 | `cost.remove` |

#### 2.4 项目模块 Project — 缺查询和归档

| 工具名 | 类型 | 功能 | 对应 Service |
|--------|------|------|-------------|
| `list_projects` | 读 | 查询项目列表，支持按状态筛选 | `project.findAll` |
| `get_project_detail` | 读 | 查项目详情（含任务/成本/客户） | `project.findById` |
| `archive_project` | 写 | 归档已完成的项目 | `project.archive` |

#### 2.5 任务模块 Task — 缺查询和统计

| 工具名 | 类型 | 功能 | 对应 Service |
|--------|------|------|-------------|
| `list_tasks` | 读 | 查询任务列表，支持按状态/优先级/项目筛选 | `task.findAll` |
| `get_task_stats` | 读 | 任务统计（总数/完成率/逾期数） | `task.findAll` 聚合 |

---

### P1：高频操作工具

#### 2.6 客户模块 Customer — 缺列表和删除

| 工具名 | 类型 | 功能 | 对应 Service |
|--------|------|------|-------------|
| `list_customers` | 读 | 查询客户列表，支持按状态筛选 | `customer.findAll` |
| `delete_customer` | 写 | 删除客户 | `customer.remove` |

#### 2.7 目标模块 Goal — 只读缺写操作

| 工具名 | 类型 | 功能 | 对应 Service |
|--------|------|------|-------------|
| `create_goal` | 写 | 创建目标（月度/季度/年度） | `goal.create` |
| `update_goal` | 写 | 更新目标信息 | `goal.update` |
| `update_goal_progress` | 写 | 更新目标进度值 | `goal.updateProgress` |
| `list_goals` | 读 | 查询目标列表 | `goal.findAll` |
| `get_goal_overview` | 读 | 目标总览（含风险预警） | `goal.getOverview` |

#### 2.8 工时模块 Work — 整块缺失

| 工具名 | 类型 | 功能 | 对应 Service |
|--------|------|------|-------------|
| `get_today_entries` | 读 | 查今日已记录工时 | `work.getTodayEntries` |
| `get_active_timer` | 读 | 查当前运行的计时器 | `work.getActiveTimer` |
| `list_todos` | 读 | 查今日待办列表 | `work.getTodayTodo` |
| `add_todo` | 写 | 添加一条待办 | `work.addTodo` |
| `toggle_todo` | 写 | 完成/取消完成待办 | `work.toggleTodo` |

---

### P2：体验提升工具

#### 2.9 报表模块 Report — 整块缺失

| 工具名 | 类型 | 功能 | 对应 Service |
|--------|------|------|-------------|
| `get_report_overview` | 读 | 报表总览（收入/支出/利润/利润率） | `report.getOverview` |
| `get_project_ranking` | 读 | 项目利润排名 | `report.getProjectRanking` |
| `get_cost_structure` | 读 | 成本结构分析 | `report.getCostStructure` |
| `get_time_analysis` | 读 | 工时分析 | `report.getTimeAnalysis` |

#### 2.10 仪表盘 Dashboard — 整块缺失

| 工具名 | 类型 | 功能 | 对应 Service |
|--------|------|------|-------------|
| `get_dashboard_summary` | 读 | 仪表盘汇总数据 | `dashboard.getStats` |
| `get_recent_activity` | 读 | 最近活动/任务 | `dashboard.getRecentTasks` |

#### 2.11 通知模块 Notification — 缺查询

| 工具名 | 类型 | 功能 | 对应 Service |
|--------|------|------|-------------|
| `list_notifications` | 读 | 查询通知列表 | `notification.findAll` |
| `get_unread_count` | 读 | 未读通知数量 | `notification.getUnreadCount` |
| `mark_as_read` | 写 | 标记通知已读 | `notification.markAsRead` |

---

### P3：进阶功能

#### 2.12 订阅模块 Subscription — 整块缺失

| 工具名 | 类型 | 功能 | 对应 Service |
|--------|------|------|-------------|
| `create_subscription` | 写 | 创建订阅（软件/云服务/域名等） | `subscription.create` |
| `list_subscriptions` | 读 | 查询订阅列表 | `subscription.findAll` |
| `get_subscription_cost` | 读 | 订阅费用汇总（月度/年度） | `subscription.getCostSummary` |
| `pause_subscription` | 写 | 暂停订阅 | `subscription.pause` |
| `resume_subscription` | 写 | 恢复订阅 | `subscription.resume` |

#### 2.13 其他补充

| 工具名 | 类型 | 功能 | 对应 Service |
|--------|------|------|-------------|
| `delete_customer` | 写 | 删除客户 | `customer.remove` |

---

### 新增工具汇总

```
P0 核心（必须）：15 个工具
  Transaction: 4 个 (list, create, update, delete)
  Payment:     4 个 (create, list, receivables, aging)
  Cost:        2 个 (create, delete)
  Project:     3 个 (list, detail, archive)
  Task:        2 个 (list, stats)

P1 高频：10 个工具
  Customer:    2 个 (list, delete)
  Goal:        5 个 (create, update, update_progress, list, overview)
  Work:        5 个 (entries, timer, todos, add_todo, toggle_todo)
  ⚠️ Goal 和 Work 合计 10 个

P2 体验：7 个工具
  Report:      4 个 (overview, ranking, cost_structure, time_analysis)
  Dashboard:   2 个 (summary, recent_activity)
  Notification:3 个 (list, unread, mark_read)
  ⚠️ 合计 9 个

P3 进阶：5 个工具
  Subscription:5 个 (create, list, cost, pause, resume)

总计新增：约 39 个工具
完成后总数：约 87 个工具
```

---

## 三、多媒体能力升级

### 3.1 语音输入

**方案：浏览器原生 Web Speech API，不做后端 Whisper API**

```
用户点 🎤 → 浏览器录音 → 浏览器内置引擎识别 → 文字显示在输入框
全程前端完成，不经过后端
```

需要新增/修改的文件：

| 文件 | 类型 | 内容 |
|------|------|------|
| `hooks/useSpeechRecognition.ts` | 新增 | Web Speech API hook，提供 start/stop/isListening |
| `ChatInput.tsx` | 修改 | 启用 Mic 按钮 + 语音交互 + 录音动画 |

不需要修改：AIService、数据库、后端路由、工具系统。

### 3.2 图片上传 + 视觉识别

**方案：前端选择文件 → 后端压缩 → 发给多模态 AI 模型**

```
用户选图片 → 前端预览 → 发送时用 FormData
→ 后端 multer 接收 → sharp 压缩到 500KB 以内
→ base64 编码 → 构建多模态 messages → AI 看图回答
```

需要新增/修改的文件：

| 文件 | 类型 | 内容 |
|------|------|------|
| `services/file-process.service.ts` | 新增 | 预处理层：图片压缩、PDF 提取、大文件摘要 |
| `components/ai/FilePreview.tsx` | 新增 | 文件预览卡片 |
| `components/ai/ImageLightbox.tsx` | 新增 | 图片全屏查看 |
| `schema.prisma` | 修改 | Conversation 表加 attachments 字段（1 行） |
| `routes/llm.routes.ts` | 修改 | 加 multer 中间件 + 预处理调用 + 多模态消息构建（~50 行） |
| `services/ai.service.ts` | 修改 | mockChat 兼容多模态 content（3 行） |
| `ChatInput.tsx` | 修改 | 启用 📎 按钮 + 文件选择 + 拖拽 |
| `MessageBubble.tsx` | 修改 | 渲染附件缩略图 |
| `hooks/useAiChat.ts` | 修改 | sendMessage 支持 FormData |

需要新增的 npm 依赖：`multer`、`sharp`

### 3.3 PDF 上传 + 文本提取

**方案：pdf-parse 提取文字 → 大文件截取或摘要 → 拼入纯文本消息**

```
PDF 文件 → pdf-parse 提取全文 → 判断 token 数
  小文件（<3000 token）→ 直接发送
  大文件（>3000 token）→ 截取前 60% 或用便宜模型做摘要
→ 文字拼入 userContent → AI 基于文本回答
```

需要新增的 npm 依赖：`pdf-parse`

已在 3.2 的 `file-process.service.ts` 中统一处理。

### 3.4 文件上传 + 工具联动

**文件内容可以触发 AI 调用业务工具**

```
示例：
  用户上传报价单.png + "根据报价单创建项目"
  → AI 看图识别出客户名、金额、工期
  → AI 调用 create_project 工具
  → 自动创建项目

  用户上传发票.jpg + "帮我记录这笔成本"
  → AI 识别发票金额和类别
  → AI 调用 create_cost 工具
  → 自动记录成本
```

需要的改动：
- 系统提示词增加文件处理指导（一段提示词）
- 文件内容关键词参与工具路由（selectRelevantTools 扩展）

### 3.5 预处理层架构

```
前端 → llm.routes.ts → file-process.service.ts → AIService → AI 模型
         (文本+文件)       ↑ 新增翻译层
                           │
                           图片进来 → 压缩 + base64 出
                           PDF 进来 → 提取文字出
                           │
                           AIService 零改动
                           工具系统零改动
```

预处理层做两件事：
1. **基础处理**：压缩图片 / 提取 PDF 文字（转成 AI 能用的格式）
2. **智能分析**：提取关键词 / 判断文档类型（用来选工具和加提示词）

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

### 4.2 需要新增的路由组

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

subscription：create_subscription, list_subscriptions, get_subscription_cost, pause_subscription, resume_subscription
  关键词：订阅、续费、会员、SaaS
```

### 4.3 需要更新的现有路由组

```
work 组：增加 list_projects, get_project_detail, archive_project, list_tasks, get_task_stats
client 组：增加 list_customers, delete_customer
goal 组：增加 create_goal, update_goal, update_goal_progress, list_goals, get_goal_overview
finance 组：增加 create_cost, delete_cost（成本写操作归财务组）
```

---

## 五、Schema 变更

### 5.1 Conversation 表加字段

```prisma
model Conversation {
  // ... 现有字段不变 ...
  attachments  String?   // 附件信息 JSON: [{type, fileName, fileSize}]
}
```

### 5.2 现有 Schema 问题（顺带修复）

```
问题：Goal 表的 targetValue/currentValue 用 Float 存储
      当 metricType=REVENUE 时代表金额，但没有用 Int（分）
      
建议：暂不修改，保持兼容。在工具层做单位转换。
```

---

## 六、实现分期

### Phase 1：补齐 P0 核心工具（预计 2-3 天）

```
新建 5 个工具文件：
  ai/tools/transaction-tools.ts    → list_transactions, create_transaction, update_transaction, delete_transaction
  ai/tools/payment-tools.ts       → create_payment, list_payments, get_receivables, get_aging_analysis
  ai/tools/cost-write.ts           → create_cost, delete_cost
  ai/tools/project-query.ts       → list_projects, get_project_detail, archive_project
  ai/tools/task-query.ts          → list_tasks, get_task_stats

更新 1 个文件：
  ai/tools/registry.ts             → 注册所有新工具
  ai/tools/tool-router.ts         → 新增 transaction、payment 路由组，更新 work、finance 组

每个工具的开发流程：
  1. 定义 parameters schema
  2. 编写 handler（调用对应 Service 函数）
  3. 写三段式 description（使用时机/不使用时机/返回数据）
  4. 设置 access（read/write）和 requiresConfirmation
  5. 返回 meta/highlights/summary 格式
```

### Phase 2：补齐 P1 工具 + 语音输入（预计 2-3 天）

```
新建 3 个工具文件：
  ai/tools/customer-extra.ts      → list_customers, delete_customer
  ai/tools/goal-write.ts          → create_goal, update_goal, update_goal_progress, list_goals, get_goal_overview
  ai/tools/work-timer.ts          → get_today_entries, get_active_timer, list_todos, add_todo, toggle_todo

更新文件：
  registry.ts + tool-router.ts

语音输入：
  hooks/useSpeechRecognition.ts（新增）
  ChatInput.tsx（启用 Mic 按钮）
```

### Phase 3：文件上传 + 预处理层（预计 2-3 天）

```
安装依赖：multer, sharp, pdf-parse

新建文件：
  services/file-process.service.ts（预处理层）
  components/ai/FilePreview.tsx
  components/ai/ImageLightbox.tsx

修改文件：
  schema.prisma（加 attachments 字段）
  llm.routes.ts（加 multer + 预处理 + 消息构建）
  ai.service.ts（mockChat 兼容，3 行）
  ChatInput.tsx（启用 📎 按钮）
  MessageBubble.tsx（渲染附件）
  useAiChat.ts（支持 FormData）

运行：npx prisma db push && npx prisma generate
```

### Phase 4：补齐 P2 + P3 工具（预计 1-2 天）

```
新建 3 个工具文件：
  ai/tools/report-tools.ts        → get_report_overview, get_project_ranking, get_cost_structure, get_time_analysis
  ai/tools/dashboard-tools.ts     → get_dashboard_summary, get_recent_activity
  ai/tools/notification-tools.ts  → list_notifications, get_unread_count, mark_as_read
  ai/tools/subscription-tools.ts  → create_subscription, list_subscriptions, get_subscription_cost, pause_subscription, resume_subscription

更新文件：
  registry.ts + tool-router.ts
```

---

## 七、工具开发模板

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
  preferredModel: 'fast',

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
    const { direction, category, projectId, startDate, endDate, limit = 20 } = args;
    const where: Record<string, unknown> = { userId };
    if (direction) where.direction = direction;
    if (category) where.category = category;
    if (projectId) where.projectId = projectId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate as string);
      if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate as string);
    }

    const data = await prisma.transaction.findMany({
      where,
      take: limit as number,
      orderBy: { date: 'desc' },
      include: { project: { select: { name: true } } },
    });

    const totalIncome = data.filter(t => t.direction === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const totalExpense = data.filter(t => t.direction === 'EXPENSE').reduce((s, t) => s + t.amount, 0);

    return {
      meta: { tool: 'list_transactions', total: data.length },
      highlights: {
        totalIncome: totalIncome / 100,
        totalExpense: totalExpense / 100,
        net: (totalIncome - totalExpense) / 100,
      },
      summary: `${data.length} 笔流水，收入 ¥${totalIncome / 100}，支出 ¥${totalExpense / 100}`,
      data: data.map(t => ({
        id: t.id,
        direction: t.direction,
        category: t.category,
        amount: t.amount / 100,
        description: t.description,
        date: t.date.toISOString().split('T')[0],
        project: t.project?.name,
      })),
    };
  },
};
```

---

## 八、改动汇总

### 新增文件

```
后端：
  ai/tools/transaction-tools.ts     4 个工具
  ai/tools/payment-tools.ts        4 个工具
  ai/tools/cost-write.ts            2 个工具
  ai/tools/project-query.ts        3 个工具
  ai/tools/task-query.ts           2 个工具
  ai/tools/customer-extra.ts       2 个工具
  ai/tools/goal-write.ts           5 个工具
  ai/tools/work-timer.ts           5 个工具
  ai/tools/report-tools.ts         4 个工具
  ai/tools/dashboard-tools.ts      2 个工具
  ai/tools/notification-tools.ts   3 个工具
  ai/tools/subscription-tools.ts   5 个工具
  services/file-process.service.ts  文件预处理层
  services/speech.service.ts        语音转录（可选，仅降级方案）

前端：
  hooks/useSpeechRecognition.ts     语音识别 hook
  hooks/useVoiceRecord.ts           录音 hook（可选，仅降级）
  components/ai/FilePreview.tsx     文件预览卡片
  components/ai/ImageLightbox.tsx   图片全屏查看
```

### 修改文件

```
后端：
  ai/tools/registry.ts              注册所有新工具（~40 行 import + push）
  ai/tools/tool-router.ts          新增 6 个路由组 + 更新 4 个现有组
  routes/llm.routes.ts             加 multer + 预处理 + 消息构建（~50 行）
  services/ai.service.ts           mockChat 兼容多模态（3 行）
  prisma/schema.prisma             Conversation 加 attachments 字段（1 行）
  prompts/system-search.txt        增加文件处理指导

前端：
  components/ai/ChatInput.tsx       启用 📎🎤 按钮 + 文件选择 + 语音交互
  components/ai/MessageBubble.tsx   渲染附件（缩略图/文件图标）
  hooks/useAiChat.ts               sendMessage 支持 FormData
```

### 新增依赖

```
后端 npm：
  multer          文件上传中间件
  @types/multer   TypeScript 类型
  sharp           图片压缩/缩放
  pdf-parse       PDF 文本提取

前端 npm：
  无（Web Speech API 是浏览器原生）
```

### 不修改的部分

```
AIService 核心逻辑（chat/init/registerTools）→ 不改
所有现有工具文件的 handler 逻辑 → 不改
数据库其他表 → 不改
系统提示词主体 → 只加一段文件处理指导
```

---

## 九、工具分类统计（完成后）

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
