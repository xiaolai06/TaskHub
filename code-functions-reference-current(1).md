# TaskFlow+ 当前版代码函数功能说明文档

> 生成日期：2026-06-01  
> 适用范围：当前工作区代码状态，包含合并前协作改造与本轮“订单报价/成本/利润/月入款”产品收口  
> 读者：继续开发、联调、代码审查、产品验收人员

---

## 目录

- [一、项目架构概览](#一项目架构概览)
- [二、本轮修改对齐重点](#二本轮修改对齐重点)
- [三、后端服务层 Services](#三后端服务层-services)
- [四、后端路由层 Routes](#四后端路由层-routes)
- [五、后端定时任务 Jobs](#五后端定时任务-jobs)
- [六、后端 AI 工具层](#六后端-ai-工具层)
- [七、前端 Hooks](#七前端-hooks)
- [八、前端业务组件](#八前端业务组件)
- [九、前端页面](#九前端页面)
- [十、配置与构建注意事项](#十配置与构建注意事项)
- [十一、开发对齐约定](#十一开发对齐约定)

---

## 一、项目架构概览

```text
HTTP 请求
  -> backend/src/app.ts
    -> routes/index.ts
      -> routes/*.routes.ts
        -> validators/*.schema.ts
          -> services/*.service.ts
            -> Prisma DB
            -> utils/response.ts 统一响应

前端页面
  -> frontend/src/app/main/**/page.tsx
    -> hooks/use*.ts
      -> frontend/src/lib/api.ts
        -> backend /api/*
    -> components/features/**
```

**技术栈**

| 层 | 技术 |
| --- | --- |
| 前端 | Next.js 16, React 19, Tailwind CSS 4, React Query, Zustand |
| 后端 | Express 5, Prisma 6, TypeScript, Zod |
| 数据库 | SQLite 本地开发，可迁移 PostgreSQL |
| AI | OpenAI SDK 兼容接口，多供应商配置 |
| 自动化 | node-cron + n8n webhook |
| 通知 | 站内通知、SMTP 邮件、Webhook |

**数据隔离原则**

所有用户业务数据必须通过 `userId` 过滤：

- 项目使用 `ownerId`
- 客户使用 `userId`
- 成本记录通过 `project.ownerId`
- 任务通过 `project.ownerId`
- 通知、设置、偏好、会话直接挂 `userId`

---

## 二、本轮修改对齐重点

### 2.1 产品口径变更

[本轮修改] 财务模块不再按“账单、发票、订阅、token 成本、复杂财务系统”设计，统一改为一人公司可落地的订单经营闭环。

| 旧口径 | 当前口径 | 说明 |
| --- | --- | --- |
| 项目预算 | 订单报价 | 数据库字段仍是 `Project.budget`，但产品语义统一为报价 |
| 支出/费用/花销 | 成本 | 成本来自 `CostRecord.amount + Task.cost` |
| 财务收入 | 月入款/期间入款 | 已完成订单在所选周期内的报价合计 |
| 财务脉搏 | 订单利润简报 | AI 分析报价、成本、利润、月入款 |
| 超预算预警 | 成本接近报价预警 | 成本达到报价 80% 触发 |

### 2.2 必须保持一致的计算公式

[本轮修改] 所有模块必须复用以下口径，不允许再各算各的：

```text
订单报价 = Project.budget || 0
订单成本 = CostRecord.amount 合计 + Task.cost 合计
订单利润 = 订单报价 - 订单成本
利润率 = 订单利润 / 订单报价
月入款 = 所选周期内 status=COMPLETED 且 updatedAt 在周期内的 Project.budget 合计
成本预警 = 订单成本 / 订单报价 >= 80%
```

### 2.3 排期闭环变更

[本轮修改] `/main/schedule` 不再是前端本地排序视图，改为调用后端排期引擎：

- 选择进行中的订单
- 输入每日可用工时
- 调用 `POST /api/scheduler/calculate`
- 展示任务排期、每日负载、延期任务
- 可将 `scheduledStart/scheduledEnd` 应用回任务 `startDate/dueDate`

### 2.4 邮件通知接入

[协作修改] 通知服务已支持 SMTP：

- 设置页可配置 SMTP
- `POST /api/notifications/test-email` 发送测试邮件
- 晨报、周报可按用户偏好发送邮件摘要
- webhook 兼容 n8n 调用

### 2.5 文档与产品定位

[本轮修改] 已同步更新：

- `README.md`
- `TaskFlow+ 产品定位.docx`
- 产品定位从“AI 项目管理平台”收敛为“面向一人公司的订单执行工作台”

---

## 三、后端服务层 Services

### 3.1 project.service.ts - 订单/项目服务

| 函数 | 参数 | 返回 | 当前说明 |
| --- | --- | --- | --- |
| `findAll` | `userId, filters` | `{ data, total, page, limit }` | 查询项目列表，批量聚合成本记录和任务成本，返回 `quote/actualCost/usedBudget/profit` |
| `findById` | `userId, id` | `Project | null` | 查询项目详情，返回最近任务、客户、成本与利润字段 |
| `create` | `userId, CreateProjectInput` | `Project` | 创建项目。`budget` 按订单报价理解 |
| `update` | `userId, id, UpdateProjectInput` | `Project | null` | 更新项目信息，并重新计算成本/利润 |
| `archive` | `userId, id` | `Project | null` | 将项目状态改为 `ARCHIVED` |
| `remove` | `userId, id` | `{ deleted: true }` | 删除项目及关联成本记录、任务 |

[本轮修改] `findAll/findById/update` 返回字段中：

- `quote = budget`
- `actualCost = costRecords + task.cost`
- `usedBudget` 仅兼容旧前端命名，语义上等同 `actualCost`
- `profit = quote - actualCost`

### 3.2 cost.service.ts - 成本服务

| 函数 | 参数 | 返回 | 当前说明 |
| --- | --- | --- | --- |
| `findAll` | `userId, projectId, filters` | `{ data, total, page, limit }` | 查询某订单成本记录，先校验项目归属 |
| `getSummaryByProject` | `userId, projectId` | `{ total, byCategory }` | 汇总订单成本，包含成本记录和任务快捷成本 |
| `create` | `userId, projectId, data` | `CostRecord` | 创建成本记录 |
| `remove` | `userId, id` | `CostRecord` | 删除成本记录，校验归属 |
| `getMonthlySummary` | `userId, month?` | `{ month, total, byProject, byCategory }` | 汇总某月成本，包含任务成本 |

[本轮修改] `getSummaryByProject` 已把 `Task.cost` 合入 `LABOR` 类目，避免项目详情成本小于仪表盘/报表成本。

### 3.3 report.service.ts - 经营报表服务

| 函数 | 参数 | 返回 | 当前说明 |
| --- | --- | --- | --- |
| `getOverview` | `userId, period?, type?` | `{ income, monthlyIncome, expense, cost, quoteTotal, profit, margin }` | 周期经营概览：入款、成本、报价总额、利润、利润率 |
| `getProjectRanking` | `userId, period?, type?` | `ProjectRanking[]` | 订单利润排行，返回 `quote/cost/profit/margin/paidInPeriod` |
| `getCostStructure` | `userId, period?, type?` | `CostStructure[]` | 周期成本结构，任务成本并入人工类目 |
| `getTimeAnalysis` | `userId, period?, type?` | `{ byProject, totalHours, avgPerDay }` | 周期工时分析 |

[本轮修改] 报表保留 `income/expense/budget` 等兼容字段时，前端展示必须使用“入款/成本/报价/利润”口径。

### 3.4 dashboard.service.ts - 仪表盘服务

| 函数 | 参数 | 返回 | 当前说明 |
| --- | --- | --- | --- |
| `getStats` | `userId` | `DashboardStats` | 订单数、任务数、完成率、总成本、本月入款、预计利润、逾期数 |
| `getRecentTasks` | `userId, limit?` | `Task[]` | 最近更新任务 |
| `getProjectStats` | `userId` | `ProjectSummary[]` | 最近订单的任务进度和报价 |
| `getCustomerStats` | `userId` | `CustomerSummary[]` | 客户订单数、报价总额、完成订单数 |

[本轮修改] 新增/调整：

- `monthlyIncome`
- `estimatedProfit`
- `totalCost` 包含任务成本
- `getCustomerStats` 支持仪表盘客户概览

### 3.5 scheduler.service.ts - 排期服务

| 函数 | 参数 | 返回 | 当前说明 |
| --- | --- | --- | --- |
| `calculateSchedule` | `userId, { projectId, dailyHourLimit }` | `ScheduleResult` | 按任务优先级、最早开始、截止日、每日工时计算排期 |
| `detectDelays` | `userId, projectId` | `DelayedTask[]` | 检测延期任务 |
| `detectConflicts` | `userId, { projectId, dailyHourLimit }` | `ConflictData` | 检测每日工时超载和冲突 |
| `insertionSimulation` | `userId, input` | `InsertionResult` | 模拟插单对排期的影响 |

[本轮修改] 前端 `/main/schedule` 已实际接入 `calculateSchedule`，不再只做本地排序。

### 3.6 notification.service.ts - 通知服务

| 函数 | 参数 | 返回 | 当前说明 |
| --- | --- | --- | --- |
| `findAll` | `userId, filters?` | `{ data, total, page, limit }` | 分页查询通知 |
| `getUnreadCount` | `userId` | `number` | 未读通知数 |
| `markAsRead` | `userId, id` | `Notification` | 标记单条已读 |
| `markAllAsRead` | `userId` | `{ count }` | 全部已读 |
| `remove` | `userId, id` | `Notification` | 删除通知 |
| `create` | `userId, type, title, content, relatedId?` | `Notification` | 创建站内通知 |
| `createFromN8n` | `payload` | `Notification` | n8n 创建通知入口 |
| `sendWebhook` | `channel, data` | `unknown` | webhook 发送兼容入口 |
| `sendEmail` | `to, subject, body, userId?` | `void` | SMTP 邮件发送 |
| `sendSummaryEmail` | `userId, to, subject, summary` | `void` | 简报/周报邮件 |
| `sendTestEmail` | `to, userId?` | `void` | SMTP 测试邮件 |

[协作修改] 补齐 `createFromN8n/sendWebhook`，修复 webhook 路由依赖缺失。  
[协作修改] 接入 SMTP 配置和测试邮件能力。

### 3.7 cron-job.service.ts - 定时任务配置服务

| 函数 | 参数 | 返回 | 当前说明 |
| --- | --- | --- | --- |
| `findAll` | `userId, filters?` | `CronJob[]` | 查询用户定时任务 |
| `findById` | `userId, id` | `CronJob` | 查询任务详情 |
| `create` | `userId, data` | `CronJob` | 创建自定义定时任务 |
| `update` | `userId, id, data` | `CronJob` | 更新定时任务 |
| `remove` | `userId, id` | `CronJob` | 删除自定义任务，系统任务不可删 |
| `ensureSystemJobs` | `userId` | `{ created }` | 初始化系统预置任务 |

[本轮修改] 系统任务名称/描述已按当前产品口径调整：

- 成本预警：成本达到报价 80%
- 订单利润简报：报价、成本、利润、月入款分析
- 业务体检：订单利润、客户、项目、目标维度

### 3.8 其他服务简表

| 服务 | 说明 |
| --- | --- |
| `auth.service.ts` | 注册、登录、登出、资料更新、密码修改、Session 管理 |
| `task.service.ts` | 任务列表、项目任务、任务 CRUD、状态切换、子任务聚合 |
| `customer.service.ts` | 客户 CRUD、关联项目、沟通记录摘要 |
| `goal.service.ts` | 目标、进度、里程碑、自动进度计算 |
| `setting.service.ts` | AI provider、模型拉取、连接测试、通用设置、登录设备 |
| `preference.service.ts` | 用户偏好，包含通知偏好和邮件通知相关开关 |
| `profile.service.ts` | 个人资料 |
| `conversation.service.ts` | AI 会话历史 |
| `work.service.ts` | 今日待办和计时器 |
| `research.service.ts/search.service.ts` | 搜索、收藏、历史 |
| `encryption.service.ts` | API Key 等敏感配置加密/解密 |

---

## 四、后端路由层 Routes

### 4.1 dashboard.routes.ts

| 方法 | 路径 | 服务函数 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/dashboard/summary` | `dashboardService.getStats` | 仪表盘摘要 |
| GET | `/api/dashboard/recent-activity` | `dashboardService.getRecentTasks` | 最近活动 |
| GET | `/api/dashboard/project-stats` | `dashboardService.getProjectStats` | 订单概览 |
| GET | `/api/dashboard/customer-stats` | `dashboardService.getCustomerStats` | 客户概览 |

[本轮修改] 新增 `/customer-stats`，前端仪表盘已使用。

### 4.2 report.routes.ts

| 方法 | 路径 | 服务函数 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/reports/overview` | `getOverview` | 入款、成本、利润、利润率 |
| GET | `/api/reports/project-ranking` | `getProjectRanking` | 订单利润排行 |
| GET | `/api/reports/cost-structure` | `getCostStructure` | 成本结构 |
| GET | `/api/reports/time-analysis` | `getTimeAnalysis` | 工时分析 |

### 4.3 scheduler.routes.ts

| 方法 | 路径 | 服务函数 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/scheduler/calculate` | `calculateSchedule` | 排期计算 |
| POST | `/api/scheduler/insertion` | `insertionSimulation` | 插单模拟 |
| GET | `/api/scheduler/delays/:pid` | `detectDelays` | 延期检测 |
| GET | `/api/scheduler/conflicts/:pid` | `detectConflicts` | 冲突检测 |

### 4.4 notification.routes.ts

| 方法 | 路径 | 服务函数 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/notifications` | `findAll` | 通知列表 |
| GET | `/api/notifications/unread-count` | `getUnreadCount` | 未读数量 |
| POST | `/api/notifications/test-email` | `sendTestEmail` | SMTP 测试邮件 |
| PATCH | `/api/notifications/:id/read` | `markAsRead` | 单条已读 |
| PATCH | `/api/notifications/read-all` | `markAllAsRead` | 全部已读 |
| DELETE | `/api/notifications/:id` | `remove` | 删除通知 |

[协作修改] 新增测试邮件接口。

### 4.5 webhook.routes.ts

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/webhooks/incoming` | n8n/外部系统通用回调 |
| POST | `/api/webhooks/notify` | 外部系统创建通知 |

[协作修改] webhook 依赖的 `createFromN8n/sendWebhook` 已补齐。

### 4.6 其他路由简表

| 路由文件 | 核心功能 |
| --- | --- |
| `auth.routes.ts` | 注册、登录、登出、当前用户、密码修改 |
| `project.routes.ts` | 项目/订单 CRUD、归档 |
| `task.routes.ts` | 任务 CRUD、项目任务、状态切换 |
| `cost.routes.ts` | 成本记录 CRUD、项目汇总、月度汇总 |
| `customer.routes.ts` | 客户 CRUD |
| `goal.routes.ts` | 目标、进度、日志、里程碑 |
| `setting.routes.ts` | AI provider、模型、连接测试、配置项、Session |
| `preference.routes.ts` | 用户偏好 |
| `profile.routes.ts` | 个人资料 |
| `cron-job.routes.ts` | 定时任务 CRUD 和系统任务初始化 |
| `llm.routes.ts` | AI 对话、流式输出、工具列表 |
| `research.routes.ts/search.routes.ts` | 搜索、历史、收藏 |
| `work.routes.ts` | 今日待办、计时器 |
| `greeting.routes.ts` | 问候语配置 |

---

## 五、后端定时任务 Jobs

| 文件 | Cron | 当前说明 |
| --- | --- | --- |
| `due-reminder.job.ts` | `0 8 * * *` | 逾期/到期任务提醒 |
| `morning-briefing.job.ts` | `0 8 * * *` | 晨间简报，支持邮件发送 |
| `client-radar.job.ts` | `0 9 * * *` | 客户跟进雷达 |
| `cost-alert.job.ts` | `0 10 * * *` | 成本达到报价 80% 预警 |
| `finance-pulse.job.ts` | `0 10 * * *` | 订单利润简报：报价、成本、利润、月入款 |
| `weekly-report.job.ts` | `0 9 * * 1` | 自动周报，支持邮件发送 |
| `weekly-memory.job.ts` | `0 20 * * 0` | 对话记忆沉淀 |
| `health-check.job.ts` | `0 10 * * 0` | 业务体检 |

[本轮修改] `cost-alert.job.ts` 已按报价风险重写文案和计算。  
[本轮修改] `finance-pulse.job.ts` 已改为订单经营分析，不再使用“预算/支出”叙事。  
[协作修改] `morning-briefing.job.ts`、`weekly-report.job.ts` 会按偏好发送摘要邮件。

---

## 六、后端 AI 工具层

### 6.1 registry.ts

`backend/src/ai/tools/registry.ts` 统一注册 AI 工具，并提供：

| 函数 | 说明 |
| --- | --- |
| `getAllTools()` | 返回全部工具 |
| `getTool(name)` | 按名称获取工具 |
| `getToolsByCategory(category)` | 按 finance/work/client/goal 分类获取 |
| `getWriteTools()` | 获取写操作工具，用于确认机制 |

### 6.2 finance 工具

| 工具 | 说明 | 本轮对齐 |
| --- | --- | --- |
| `get_profit_analysis` | 分析订单报价、成本、利润、利润率 | [本轮修改] 成本包含成本记录和任务成本 |
| `get_cash_flow` | 现金流/月度数据 | 需要后续继续按“月入款”口径清理展示文案 |
| `get_cost_breakdown` | 成本明细 | 保留 |
| `get_revenue_by_client` | 客户收入排行 | 建议后续改名为客户入款/报价排行 |
| `get_project_margin_ranking` | 项目利润率排行 | 保留，但展示语义为订单利润率 |

### 6.3 work 工具

| 工具 | 说明 | 本轮对齐 |
| --- | --- | --- |
| `create_project` | 创建项目/订单 | [本轮修改] 参数说明改为报价、成本备注 |
| `update_project` | 更新项目/订单 | [本轮修改] `budget` 说明为新报价 |
| `create_task` | 创建任务 | [本轮修改] 支持任务成本，文案改为成本 |
| `update_task_status` | 更新任务状态/优先级 | 保留 |
| `delete_task` | 删除任务 | 保留 |
| `log_time` | 记录工时 | 保留 |
| `get_schedule` | 查询排期 | 接后端排期引擎 |
| `get_today_focus` | 今日工作焦点 | 保留 |
| `get_overdue_tasks` | 逾期任务 | 保留 |
| `get_project_progress` | 项目进度 | 保留 |

### 6.4 capabilities

`ai/capabilities/*` 多数仍是能力骨架。  
[本轮修改] `finance-capability.ts` 已标注当前财务逻辑主要落在 report/cost services 和 AI tools，不再保留“预算预警”旧注释。

---

## 七、前端 Hooks

| Hook | API | 当前说明 |
| --- | --- | --- |
| `useAuth` | `/auth/*` | 登录、注册、登出、当前用户 |
| `useProjects` | `/projects/*` | 项目/订单列表、详情、创建、更新、归档、删除 |
| `useTasks` | `/tasks/*` | 任务列表、项目任务、CRUD、状态更新 |
| `useCosts` | `/projects/:id/costs` | [本轮修改] 成本列表、汇总、创建、删除，已不再是 TODO stub |
| `useCustomers` | `/customers/*` | 客户列表、详情、CRUD |
| `useGoals` | `/goals/*` | 目标、进度、日志、里程碑 |
| `useSchedule` | `/scheduler/*` | 排期计算、延期、冲突、插单模拟 |
| `useNotifications` | `/notifications/*` | 通知列表、已读、删除、未读数 |
| `useSettings` | `/settings/*` | AI provider、模型、设置项 |
| `useCronJobs` | `/cron-jobs/*` | 定时任务管理 |
| `useAiChat` | `/llm/chat/stream` | SSE AI 对话和工具调用 |

[本轮修改] `useCosts.ts` 已实现真实接口调用：

- `useCosts(projectId)`
- `useCostSummary(projectId)`
- `useCreateCost(projectId)`
- `useDeleteCost(projectId)`

---

## 八、前端业务组件

### 8.1 项目/订单组件

| 组件 | 说明 | 本轮对齐 |
| --- | --- | --- |
| `ProjectCard` | 项目卡片：名称、状态、类型、报价、成本、利润、客户、任务数、成本记录数 | [本轮修改] 重写为报价/成本/利润展示 |
| `ProjectForm` | 项目表单：名称、描述、类型、状态、报价、日期、客户、成本备注 | [本轮修改] 移除报酬输入，预算文案改为报价 |
| `SubtaskList` | 子任务树、状态切换、任务成本记录弹窗 | [本轮修改] 快捷记账改为记录任务成本，金额符号和文案修复 |

### 8.2 成本组件

| 组件 | 说明 | 本轮对齐 |
| --- | --- | --- |
| `CostForm` | 新增成本记录表单 | [本轮修改] 从 TODO 变成可用组件 |
| `CostList` | 成本记录列表，支持删除 | [本轮修改] 从 TODO 变成可用组件 |
| `CostSummary` | 报价、成本、利润、利润率和成本结构 | [本轮修改] 项目详情经营闭环核心组件 |

### 8.3 任务组件

| 组件 | 说明 |
| --- | --- |
| `TaskForm` | [本轮修改] 支持最早开始日期 `startDate`，成本字段文案改为成本 |
| `TaskBoard` | 看板视图 |
| `TaskList` | 列表/表格视图 |
| `TaskCard` | 单任务卡片 |
| `TaskDetailSheet` | 任务详情抽屉 |

### 8.4 客户组件

| 组件 | 说明 | 本轮对齐 |
| --- | --- | --- |
| `CustomerList` | 客户卡片、联系方式、关联订单展开、沟通信息 | [本轮修改] 关联项目展示改为订单报价/成本/利润 |
| `CustomerForm` | 客户表单 | 保留 |

### 8.5 AI 组件

| 组件 | 说明 | 本轮对齐 |
| --- | --- | --- |
| `QuickActions` | 快捷提问 | [本轮修改] 风险扫描改为“延期任务 + 成本接近报价上限” |
| `AiPanel/AiSidebar/ChatInput/MessageBubble` | AI 对话主界面 | 保留 |
| `ToolCallBar` | 工具调用状态 | 保留 |

---

## 九、前端页面

| 页面 | 路径 | 数据来源 | 当前说明 |
| --- | --- | --- | --- |
| 仪表盘 | `/main/dashboard` | `/dashboard/summary`, `/recent-activity`, `/project-stats`, `/customer-stats` | [本轮修改] 重写为经营仪表盘：订单、任务、入款、利润、逾期、客户 |
| 项目列表 | `/main/projects` | `useProjectList` | 订单列表，ProjectCard 展示报价/成本/利润 |
| 项目详情 | `/main/projects/[id]` | `useProject`, `useProjectTasks`, `useCosts`, `useCostSummary` | [本轮修改] 接入成本记录、订单利润摘要、排期入口 |
| 任务 | `/main/tasks` | `useTaskList`, `useProjectList` | [协作修改] `useSearchParams` 已 Suspense 包裹，修复 Next 构建 |
| 排期 | `/main/schedule` | `useProjectList`, `/scheduler/calculate`, `/tasks/:id` | [本轮修改] 接后端排期算法并可应用排期 |
| 报表 | `/main/reports` | `/reports/*`, `/llm/chat/stream` | [本轮修改] 重写为订单利润报表 |
| 设置 | `/main/settings` | `/settings/*`, `/notifications/test-email` | [协作修改] SMTP 配置和测试邮件 |
| 客户 | `/main/customers` | `useCustomerList` | [本轮修改] 关联订单改为报价/成本/利润展示 |
| AI | `/main/ai` | `useAiChat` 等 | AI 工作台 |
| 目标 | `/main/goals` | `useGoals` | 目标管理 |
| 个人资料 | `/main/profile` | profile/auth | 个人资料 |
| 偏好 | `/main/preferences` | preferences | 偏好设置 |
| Research | `/main/research/*` | research/search | 研究搜索与收藏 |

---

## 十、配置与构建注意事项

### 10.1 Next 16 Turbopack root

[协作修改] `frontend/next.config.ts` 已设置 `turbopack.root`，避免 Next 16 将根目录推断到 `C:\Users\LENOVO` 导致权限问题。

### 10.2 字体网络依赖

[协作修改] 已移除 `next/font/google` 网络字体依赖，避免离线/受限网络构建失败。

### 10.3 SMTP

设置页和后端通知服务支持 SMTP 配置。测试入口：

```text
POST /api/notifications/test-email
body: { "to": "target@example.com" }
```

### 10.4 构建验证

当前已验证：

```bash
cd backend
npm.cmd run build

cd frontend
npm.cmd run build

git diff --check
```

结果：后端 TypeScript 构建通过，前端 Next 生产构建通过，diff 格式检查通过。

---

## 十一、开发对齐约定

### 11.1 财务字段命名约定

数据库字段不强行迁移，但展示和业务语义必须统一：

| 数据库/兼容字段 | 产品语义 | 开发备注 |
| --- | --- | --- |
| `Project.budget` | 订单报价 | 不再在 UI 中叫预算 |
| `Project.usedBudget` | 实际成本 | 兼容旧前端字段，建议新代码使用 `actualCost` |
| `CostRecord.amount` | 成本记录金额 | 用于外包、材料、运营等成本 |
| `Task.cost` | 任务快捷成本 | 必须并入订单成本 |
| `rewardNote` | 旧字段 | 新 UI 不再主动使用，避免报酬/收入口径混乱 |
| `expenseNote` | 成本备注 | 可保留 |

### 11.2 新增功能时必须遵守

- 涉及订单金额时，优先使用“报价/成本/利润/月入款”。
- 不要新增“账单、发票、token 成本、订阅计费”模块，除非产品明确重新定义边界。
- 成本统计必须同时算 `CostRecord` 和 `Task.cost`。
- 排期相关 UI 必须调用后端 `scheduler.service`，不要再做纯前端排序假排期。
- 发送通知时优先创建站内通知，再按偏好扩展邮件/webhook。
- 涉及用户数据查询必须带 `userId`/`ownerId` 过滤。

### 11.3 本轮主要改动文件索引

| 文件 | 改动说明 |
| --- | --- |
| `backend/src/services/report.service.ts` | 报表口径改为报价、成本、利润、月入款 |
| `backend/src/services/dashboard.service.ts` | 仪表盘新增月入款、预计利润、客户统计 |
| `backend/src/services/cost.service.ts` | 成本汇总合并任务成本 |
| `backend/src/services/project.service.ts` | 项目列表/详情返回 quote/actualCost/profit |
| `backend/src/services/notification.service.ts` | SMTP、测试邮件、n8n/webhook 兼容 |
| `backend/src/jobs/cost-alert.job.ts` | 成本达到报价 80% 预警 |
| `backend/src/jobs/finance-pulse.job.ts` | 订单利润简报 |
| `backend/src/services/cron-job.service.ts` | 系统任务文案和类型对齐 |
| `backend/src/ai/tools/create-project.ts` | AI 创建/更新项目工具改为报价口径 |
| `backend/src/ai/tools/create-task.ts` | AI 创建任务工具改为任务成本口径 |
| `backend/src/ai/tools/get-profit-analysis.ts` | 利润分析合并成本记录与任务成本 |
| `frontend/src/app/main/dashboard/page.tsx` | 经营仪表盘重写 |
| `frontend/src/app/main/reports/page.tsx` | 订单利润报表重写 |
| `frontend/src/app/main/schedule/page.tsx` | 接后端排期计算并应用排期 |
| `frontend/src/app/main/projects/[id]/page.tsx` | 项目详情接入成本记录和利润摘要 |
| `frontend/src/hooks/useCosts.ts` | 成本 hooks 实装 |
| `frontend/src/components/features/costs/*` | 成本表单、列表、摘要实装 |
| `frontend/src/components/features/projects/ProjectCard.tsx` | 项目卡片改为报价/成本/利润 |
| `frontend/src/components/features/projects/ProjectForm.tsx` | 项目表单改为报价/成本备注 |
| `frontend/src/components/features/projects/SubtaskList.tsx` | 子任务快捷成本记录修复 |
| `frontend/src/components/features/customers/CustomerList.tsx` | 客户关联订单改为报价/成本/利润 |
| `frontend/src/components/features/tasks/TaskForm.tsx` | 新增最早开始日期，成本文案对齐 |
| `frontend/src/lib/api.ts` | API 错误提示修复乱码 |
| `frontend/next.config.ts` | Turbopack root 修复 |
| `README.md` | 产品定位和启动说明更新 |
| `TaskFlow+ 产品定位.docx` | 产品定位文档更新 |

---

## 附录：当前可交付闭环

```text
客户录入
  -> 创建订单并填写报价
    -> 拆任务，填写工时、最早开始、截止日期、任务成本
      -> 排期工作台计算交付计划
        -> 应用排期到任务日期
          -> 执行任务并记录成本
            -> 项目详情查看报价/成本/利润
              -> 报表查看月入款、利润排行、成本结构
                -> 成本预警/晨报/周报/邮件通知
```

这条链路是后续开发验收的主线。新功能如果不能嵌入这条链路，应先评估是否属于产品边界外功能。