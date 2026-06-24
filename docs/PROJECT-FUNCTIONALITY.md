# TaskFlow+ 完整项目功能说明文档

> 智能项目管理系统 —— 一人公司/自由职业者的全流程工作站
> 文档版本：2026-06-24 | 基于 master 分支

---

## 目录

1. [项目总览](#1-项目总览)
2. [技术架构](#2-技术架构)
3. [前后端通信机制](#3-前后端通信机制)
4. [模块功能详解](#4-模块功能详解)
5. [数据库设计](#5-数据库设计)
6. [AI 智能系统](#6-ai-智能系统)
7. [定时任务系统](#7-定时任务系统)
8. [安全与认证](#8-安全与认证)
9. [项目目录结构](#9-项目目录结构)

---

## 1. 项目总览

TaskFlow+ 是一个面向**一人公司、自由职业者、独立开发者**的智能项目管理与订单执行工作站。系统集成了项目管理、任务调度、财务追踪、客户管理、AI 助手、行业调研等核心能力，帮助个人创业者在一个平台上完成从接单到交付的全流程。

### 核心定位

- **一站式管理**：项目 + 任务 + 财务 + 客户 + 目标 + AI，无需多工具切换
- **AI 原生**：内置 AI 对话助手，支持自然语言操作，自动日报/周报/分析
- **个人工作台**：专注一人公司的场景，操作简洁，无团队协作的复杂度

### 测试账号

| 角色     | 邮箱                  | 密码   |
|----------|----------------------|--------|
| 管理员   | admin@taskflow.com   | 123456 |
| 普通用户 | user@taskflow.com    | 123456 |

---

## 2. 技术架构

### 2.1 整体架构图

```
浏览器
  ↓ HTTPS
Nginx（生产）/ Next.js Dev Proxy（开发）
  ↓ 反向代理
┌─────────────────────────────────────────────┐
│                前端 Next.js                    │
│  React 19 + Tailwind CSS 4 + shadcn/ui      │
│  Port 3002（开发）                             │
└──────────────────────┬──────────────────────┘
                       │  HTTP（Cookie + JWT）
                       ↓
┌─────────────────────────────────────────────┐
│                后端 Express 5                  │
│  Prisma 6 + SQLite + Zod 3                   │
│  Port 3001                                    │
└──────────────────────┬──────────────────────┘
                       │
              ┌────────┼────────┐
              ↓        ↓        ↓
          SQLite    OpenAI     SMTP
         dev.db    (DeepSeek   (Nodemailer)
                   /Claude/
                   /Ollama)
```

### 2.2 前端技术栈

| 技术                | 版本    | 用途                        |
|---------------------|---------|-----------------------------|
| **Next.js**         | 16.2.6  | React 框架，App Router       |
| **React**           | 19.2.4  | UI 渲染                     |
| **TypeScript**      | 5.x     | 类型安全                     |
| **Tailwind CSS**    | 4.x     | 工具类样式                   |
| **shadcn/ui**       | -       | 组件库（基于 Radix UI）      |
| **React Query**     | 5.x     | 服务端状态管理               |
| **Zustand**         | 5.x     | 客户端状态管理（仅 Auth）     |
| **React Hook Form** | -       | 表单管理                     |
| **Zod**             | -       | 表单校验                     |
| **Recharts**        | 3.x     | 图表可视化                   |
| **motion**          | -       | 动画（原 framer-motion）     |
| **@dnd-kit**        | -       | 拖拽交互（看板）             |
| **Lucide React**    | -       | 图标                         |
| **sonner**          | -       | Toast 提示                   |
| **next-themes**     | -       | 主题切换（亮/暗/跟随系统）    |
| **date-fns**        | -       | 日期工具                     |
| **lunar-javascript**| -       | 农历                         |

**字体方案**：Inter + Noto Sans SC（正文）| JetBrains Mono（代码）

**色彩系统**：OKLCH 色彩空间，主色 Indigo，支持亮暗双主题

### 2.3 后端技术栈

| 技术                | 版本   | 用途                        |
|---------------------|--------|-----------------------------|
| **Express**         | 5.1    | Web 框架                    |
| **Prisma**          | 6.9    | ORM，类型安全数据库操作      |
| **SQLite**          | -      | 单文件数据库，WAL 模式       |
| **Zod**             | 3.25   | 请求参数校验                |
| **jsonwebtoken**    | 9      | JWT 认证                    |
| **bcryptjs**        | 3      | 密码哈希（salt 10）          |
| **OpenAI SDK**      | 4.104  | 多供应商 AI（DeepSeek/Claude/Ollama）|
| **nodemailer**      | 7      | 邮件发送（SMTP）            |
| **node-cron**       | 4      | 定时任务                    |
| **multer**          | 2      | 文件上传                    |
| **sharp**           | -      | 图片处理                    |
| **helmet**          | -      | HTTP 安全头                 |
| **dotenv**          | -      | 环境变量                    |

---

## 3. 前后端通信机制

### 3.1 连接方式

```
前端（localhost:3002）  ──HTTP──→  后端（localhost:3001）
                                   │
              开发环境：Next.js rewrites 代理 /api/* → http://localhost:3001/api/*
              生产环境：Nginx 反向代理
```

- **认证方式**：httpOnly Cookie 存储 JWT，前端自动携带 `credentials: 'include'`
- **请求格式**：JSON body + URL query params
- **响应格式**：统一信封 `{ success: boolean, data?: T, error?: { code, message, details? } }`

### 3.2 中间件流水线

**前端** → Next.js rewrites（开发）/ Nginx proxy（生产）

**后端**：
```
请求进入
  → helmet（安全头）
    → cors（跨域策略）
      → express.json（Body 解析，1MB 限制）
        → cookieParser
          → 路由分发（/api）
            → auth 中间件（JWT 验证，自动续期）
              → validate 中间件（Zod 校验）
                → route handler → service → Prisma → SQLite
                  → 统一 success/error 响应
                    → errorHandler（全局错误捕获）
```

### 3.3 限频策略

| 策略         | 限制           | 适用接口         |
|-------------|----------------|-----------------|
| `loginLimit`| 5 次/分钟      | 登录             |
| `registerLimit` | 3 次/分钟  | 注册             |
| `apiLimit`  | 60 次/分钟     | 所有认证接口     |

### 3.4 AI 流式通信

AI 对话使用 **SSE（Server-Sent Events）** 实现流式响应：

```
前端 → POST /api/llm/chat/stream
  → 后端流式返回 text/event-stream
    → 前端逐步渲染 AI 回复
      → 支持 function calling（工具调用）
        → 工具执行结果追加到流中
```

---

## 4. 模块功能详解

### 4.1 认证模块（Auth）

**后端路由**：`/api/auth`
**前端页面**：`/auth-pages/*`

#### 功能清单

| 功能         | 前端页面                    | 后端接口                              | 说明                                             |
|-------------|---------------------------|---------------------------------------|--------------------------------------------------|
| 登录         | `/auth-pages/login`       | `POST /auth/login`                   | 邮箱 + 密码 + SVG 验证码，httpOnly Cookie       |
| 注册         | `/auth-pages/register`    | `POST /auth/register`                | 实时邮箱可用性检查，密码 8 位 + 字母数字          |
| 忘记密码     | `/auth-pages/forgot-password` | `POST /auth/forgot-password`     | 邮箱 + 验证码，发送 6 位重置码到邮箱             |
| 重置密码     | `/auth-pages/reset-password` | `POST /auth/reset-password`      | 6 位验证码 + 新密码，60s 重发冷却               |
| 修改密码     | 设置页面                   | `PUT /auth/password`                  | 需输入旧密码                                     |
| 获取用户     | -                          | `GET /auth/me`                        | 自动续期（<24h）                                |
| 更新头像名字 | -                          | `PUT /auth/profile`                   | 名字 2-20 字                                    |

#### 验证码机制

- 后端 SVG-Captcha 生成验证码图片，存入内存（5 分钟过期）
- 前端 captcha-cache 模块避免页面切换时重新加载（4 分钟缓存）
- 一次性使用，验证后立即作废

#### Cookie 安全策略

```
httpOnly: true（禁止 JS 读取）
sameSite: lax/strict（防 CSRF）
secure: 可配置（生产环境 HTTPS）
expires: 7 天
```

---

### 4.2 仪表盘（Dashboard）

**后端路由**：`/api/dashboard`
**前端页面**：`/main/dashboard`

#### 功能

| 区域           | 数据来源                              | 说明                                    |
|---------------|---------------------------------------|-----------------------------------------|
| 6 个统计卡片   | `GET /dashboard/summary`             | 项目总数、完成率、本月收入、成本、利润、逾期任务 |
| 项目进度列表   | `GET /dashboard/project-stats`       | 各项目完成进度条                        |
| 任务状态分布   | `GET /dashboard/recent-activity`     | 待办/进行中/完成/阻塞数量               |
| 客户概览       | `GET /dashboard/customer-stats`      | 客户总数、活跃度                        |

前端使用 `Promise.allSettled` 并行请求 4 个接口，任一失败不影响整体显示。

---

### 4.3 项目管理（Projects）

**后端路由**：`/api/projects`
**前端页面**：`/main/projects`（列表）、`/main/projects/[id]`（详情）
**数据库模型**：`Project`

#### 功能

| 功能       | 前端组件                    | 后端接口                        | 说明                                    |
|-----------|---------------------------|---------------------------------|-----------------------------------------|
| 项目列表   | `ProjectCard`             | `GET /projects`                 | 卡片展示，支持状态/日期筛选             |
| 创建项目   | `ProjectFormContent`（左侧滑出面板） | `POST /projects`        | 名称、描述、预算（元）、起止日期、客户关联 |
| 编辑项目   | `ProjectFormContent`      | `PUT /projects/:id`             | 部分更新                                |
| 归档项目   | -                         | `PATCH /projects/:id/archive`   | 状态改为 ARCHIVED                       |
| 删除项目   | -                         | `DELETE /projects/:id`          | 级联删除关联任务、成本                  |
| 项目详情   | -                         | `GET /projects/:id`             | 包含任务列表、成本汇总                  |
| 项目任务   | `ProjectTaskSheet`（右侧抽屉） | `GET /tasks/project/:projectId` | 快速查看/创建项目下的任务              |

#### 项目状态枚举

```
ACTIVE（进行中）→ COMPLETED（已完成）→ ARCHIVED（已归档）
```

#### 项目字段

| 字段         | 类型    | 说明                          |
|-------------|---------|-------------------------------|
| name        | String  | 项目名称（1-100 字）          |
| description | String  | 项目描述                      |
| status      | Enum    | ACTIVE / COMPLETED / ARCHIVED |
| budget      | Int     | 预算（单位：分）              |
| startDate   | Date    | 开始日期                      |
| endDate     | Date    | 结束日期                      |
| customerId  | String  | 关联客户 ID（可选）           |
| type        | String  | 项目类型                      |
| expenseNote | String  | 费用备注                      |
| rewardNote  | String  | 报酬备注                      |

---

### 4.4 任务管理（Tasks）

**后端路由**：`/api/tasks`
**前端页面**：`/main/tasks`
**数据库模型**：`Task`（自关联 parentId 支持子任务）

#### 三种视图模式

| 视图     | 组件                | 说明                                          |
|---------|---------------------|-----------------------------------------------|
| 看板 Board | `TaskBoard`      | 拖拽式看板（@dnd-kit），按状态分列             |
| 列表 List | `TaskList`       | 表格视图，支持排序筛选                         |
| 甘特 Gantt | `GanttChart`    | 调度图，日工时上限、插入模拟、AI 调度建议       |

#### 筛选条件（URL 同步）

状态（TODO/IN_PROGRESS/DONE/BLOCKED）、优先级（URGENT/HIGH/MEDIUM/LOW）、日期范围、所属项目、关键词搜索

#### 功能

| 功能           | 后端接口                              | 说明                                    |
|---------------|---------------------------------------|-----------------------------------------|
| 任务列表       | `GET /tasks`                         | 分页 + 多维度筛选                       |
| 创建任务       | `POST /tasks`                        | 标题、描述、优先级、预估工时、成本、截止日期 |
| 更新任务       | `PUT /tasks/:id`                     | 部分更新                                |
| 更新状态       | `PATCH /tasks/:id/status`            | 乐观更新（前端即时反馈）                 |
| AI 解析任务     | `AiParseInput`                     | 自然语言 → 结构化任务                   |
| 子任务         | `parentId` 字段                       | 树状任务层级                            |
| 甘特调度       | `POST /scheduler/calculate`          | 按日工时上限计算排期                    |
| 插入模拟       | `POST /scheduler/insertion`          | 模拟新任务插入后的影响                  |
| 延期检测       | `GET /scheduler/delays/:pid`         | 检测逾期风险                            |
| 冲突检测       | `GET /scheduler/conflicts/:pid`      | 检测时间冲突                            |

#### 任务字段

| 字段           | 类型    | 说明                                 |
|---------------|---------|--------------------------------------|
| title         | String  | 任务标题（1-200 字）                 |
| status        | Enum    | TODO / IN_PROGRESS / DONE / BLOCKED  |
| priority      | Enum    | URGENT / HIGH / MEDIUM / LOW         |
| estimatedHours| Float   | 预估工时                             |
| actualHours   | Float   | 实际工时                             |
| cost          | Int     | 成本（分）                           |
| costNote      | String  | 成本备注                             |
| blockedReason | String  | 阻塞原因                             |
| startDate     | Date    | 开始日期                             |
| dueDate       | Date    | 截止日期                             |
| progress      | Int     | 进度 0-100                           |
| projectId     | String  | 所属项目 ID（必填）                  |
| parentId      | String  | 父任务 ID（子任务）                  |

---

### 4.5 成本管理（Costs）

**后端路由**：`/api/costs`
**前端组件**：`CostForm`、`CostList`、`CostSummary`（在项目详情页内嵌）
**数据库模型**：`CostRecord`

#### 功能

| 功能           | 后端接口                                   | 说明                          |
|---------------|--------------------------------------------|-------------------------------|
| 项目成本列表   | `GET /costs/project/:projectId`            | 分页，按类别筛选              |
| 成本汇总       | `GET /costs/project/:projectId/summary`    | 各类别金额汇总               |
| 添加成本       | `POST /costs/project/:projectId`           | 金额、类别、描述、日期         |
| 删除成本       | `DELETE /costs/:id`                        |                               |
| 月度汇总       | `GET /costs/summary?month=`                | 跨项目月度成本统计            |

#### 成本类别枚举

```
LABOR（人工）/ MATERIAL（材料）/ OVERHEAD（运营）/ OTHER（其他）
```

> **金额单位**：所有金额字段以 **分（整数）** 存储，前端显示时 ÷100 还原为元，避免浮点精度问题。

---

### 4.6 客户管理（Customers）

**后端路由**：`/api/customers`
**前端页面**：`/main/customers`
**数据库模型**：`Customer`、`Communication`

#### 功能

| 功能         | 后端接口                   | 说明                              |
|-------------|---------------------------|-----------------------------------|
| 客户列表     | `GET /customers`          | 分页，状态/日期/关键词筛选         |
| 创建客户     | `POST /customers`         | 姓名、邮箱、电话、公司、行业、状态 |
| 编辑客户     | `PUT /customers/:id`      | 部分更新                          |
| 删除客户     | `DELETE /customers/:id`   |                                   |
| 客户详情     | `GET /customers/:id`      | 含关联项目、最近沟通记录          |
| 沟通记录     | `Communication` 模型      | 类型（邮件/电话/会议/聊天）、内容、下次跟进时间 |

#### 客户状态枚举

```
ACTIVE（活跃）/ VIP（重要客户）/ INACTIVE（不活跃）/ LEAD（潜在客户）
```

---

### 4.7 财务中心（Finance）

**后端路由**：`/api/finance`、`/api/transactions`、`/api/payments`、`/api/subscriptions`
**前端页面**：`/main/finance`

#### 三大子模块

##### 4.7.1 收支记录（Transactions）

| 功能     | 后端接口                    | 说明                             |
|---------|----------------------------|----------------------------------|
| 列表    | `GET /transactions`        | 收入/支出记录                    |
| 创建    | `POST /transactions`       | 金额、方向（INCOME/EXPENSE）、类别、日期、关联项目/任务 |
| 编辑    | `PUT /transactions/:id`    |                                  |
| 删除    | `DELETE /transactions/:id` |                                  |

##### 4.7.2 收款记录（Payments）

| 功能         | 后端接口                     | 说明                            |
|-------------|------------------------------|---------------------------------|
| 列表        | `GET /payments`              | 按项目收款记录                  |
| 创建收款    | `POST /payments`             | 金额、类型（首付/进度/尾款/调整）、方式（银行/支付宝/微信/现金） |
| 应收账款    | `GET /payments/receivables`  | 项目应收汇总                    |
| 账龄分析    | `GET /payments/aging`        | 按时间分析回款风险              |

> 创建 Payment 时**自动创建对应 Transaction**，保持数据一致性。

##### 4.7.3 订阅管理（Subscriptions）

| 功能         | 后端接口                       | 说明                              |
|-------------|--------------------------------|-----------------------------------|
| 列表        | `GET /subscriptions`           | SaaS 订阅列表                     |
| 创建        | `POST /subscriptions`          | 名称、分类（软件/云服务等）、金额、周期（月/季/年） |
| 暂停/恢复   | `PUT /subscriptions/:id/pause` / `resume` |                       |
| 费用汇总    | `GET /subscriptions/cost-summary` | 订阅总支出统计                  |

---

### 4.8 目标管理（Goals）

**后端路由**：`/api/goals`
**前端页面**：`/main/goals`
**数据库模型**：`Goal`、`GoalProgressLog`、`GoalMilestone`、`GoalCheckin`

#### 功能

| 功能             | 后端接口                           | 说明                                |
|-----------------|------------------------------------|-------------------------------------|
| 目标列表/看板    | `GET /goals`                       | 列表视图 + 看板视图                |
| 创建目标         | `POST /goals`                      | 标题、类型、指标、目标值、进度模式   |
| 编辑/删除        | `PUT/DELETE /goals/:id`            |                                     |
| 自动计算进度     | `POST /goals/:id/calculate`        | 根据数据源自动更新 currentValue      |
| 进度日志         | `GET/POST /goals/:id/logs`         | 增量记录                            |
| 里程碑           | `GET/POST/PATCH/DELETE /goals/:id/milestones` | 设置检查点              |
| 每日打卡         | `POST /goals/:id/checkin`          | 习惯类目标打卡                      |
| 总览             | `GET /goals/overview`              | 所有目标进度汇总                    |

#### 目标类型枚举

```
MONTHLY（月度）/ QUARTERLY（季度）/ YEARLY（年度）
```

#### 指标类型（12 种）

```
REVENUE（收入）/ PROFIT（利润）/ TASK_COMPLETION（任务完成数）
CLIENT_SATISFACTION（客户满意度）/ COST_CONTROL（成本控制）
CUSTOMER_GROWTH（客户增长）/ NEW_CLIENTS（新客户数）
REPEAT_RATE（复购率）/ AVG_PROJECT_VALUE（平均项目价值）
HOURS_WORKED（工时）/ HABIT_STREAK（习惯连续天数）/ MILESTONE（里程碑）
```

#### 进度模式

```
AUTO（自动）  —— AI 从数据自动计算
MANUAL（手动） —— 手动更新 currentValue
MILESTONE（里程碑） —— 按里程碑进度推进
CHECKIN（打卡） —— 每日打卡累计
```

---

### 4.9 报表分析（Reports）

**后端路由**：`/api/reports`
**前端页面**：`/main/reports`
**前端组件**：Recharts 图表（TrendChart、DonutChart、HorizontalBars、VerticalBars）

#### 四大分析维度

| Tab            | 接口                              | 图表/内容                               |
|---------------|------------------------------------|-----------------------------------------|
| 财务概览       | `/reports/overview`                | 收入支出趋势、利润、成本结构            |
| 项目分析       | `/reports/project-ranking`、`/project-stats`、`/project-detail`、`/cost-structure`、`/cost-details`、`/time-analysis` | 项目排名、成本分布、时间分析            |
| 任务效率       | `/reports/task-stats`、`/overdue-tasks`、`/tasks-by-status`、`/tasks-by-priority` | 任务完成率、逾期率、优先级分布     |
| 客户洞察       | `/reports/customer-ranking`、`/customer-stats`、`/follow-up-reminders`、`/receivables`、`/subscription-summary` | 客户排名、跟进提醒、应收账款   |

所有接口支持 `period`（周期）和 `type`（day/month/year）参数。

---

### 4.10 行业调研（Research）

**后端路由**：`/api/research`、`/api/search`
**前端页面**：`/main/research`

#### 功能

| 功能         | 后端接口                           | 说明                                      |
|-------------|------------------------------------|-------------------------------------------|
| 多源搜索     | `POST /research/search`            | GitHub、HackerNews、Dev.to、DuckDuckGo、SearXNG |
| 保存项目     | `POST /research/saved`             | 标题、摘要、内容、标签                    |
| AI 简报      | `POST /research/briefings`         | 从搜索结果生成结构化简报                  |
| 搜索历史     | `GET /research/history`            | 按查询分组，支持清空                      |
| 通用搜索     | `POST /search`                     | 统一搜索入口，支持指定来源                |

---

### 4.11 工作台（Work）

**后端路由**：`/api/work`
**前端组件**：`WorkTools`

#### 功能

| 功能         | 后端接口                       | 说明                               |
|-------------|--------------------------------|------------------------------------|
| 计时器       | `POST /work/timer/start`       | 开始计时，关联任务/项目             |
| 暂停/恢复    | `POST /work/timer/:id/pause` / `resume` | 支持多次暂停恢复            |
| 停止计时     | `POST /work/timer/:id/stop`    | 自动创建 TimeEntry 记录            |
| 当日记录     | `GET /work/entries/today`      | 查看今日已记录工时                 |
| 今日待办     | `GET /work/todos`              | 每日清单（增删改）                 |

---

### 4.12 设置（Settings）

**后端路由**：`/api/settings`、`/api/profile`、`/api/preferences`、`/api/greetings`
**前端页面**：`/main/settings`、`/main/profile`、`/main/preferences`

#### 系统设置（8 个 Tab）

| Tab    | 接口                       | 功能                                     |
|--------|---------------------------|------------------------------------------|
| AI 配置 | `/settings/ai/*`         | 多供应商管理（DeepSeek/Claude/Ollama/Gemini）、模型列表、API Key、连接测试 |
| 语音转文字 | `/llm/speech/*`        | Whisper STT 配置、提供商管理、连接测试    |
| 搜索配置 | `/settings/proxy`、`/settings/searxng/*` | 代理设置、SearXNG 实例管理    |
| 集成    | `/settings/integration/*` | n8n Webhook 配置                         |
| 邮件    | `/settings/email/*`       | SMTP 配置、测试发送                      |
| 推送    | `/settings/notify/*`      | Webhook 渠道管理（微信/飞书/钉钉/Slack） |
| 安全    | `/settings/sessions`      | 活跃会话查看/撤销                        |
| 数据    | -                         | 数据导出/销毁                            |

#### 个人偏好（4 个 Tab）

| Tab      | 字段                                              |
|---------|----------------------------------------------------|
| 通用     | 主题、时区、日期格式、启动页                       |
| 显示     | 侧边栏状态、页面大小、默认视图                    |
| 通知     | 任务提醒、项目通知、邮件/Webhook、免打扰时段       |
| 问候语   | 自定义时间段问候语，按早/中/晚自动切换             |

#### 个人资料

| 功能     | 说明                                                  |
|---------|--------------------------------------------------------|
| 头像    | 颜色头像 / 图片头像（avatarType + avatarValue）       |
| 个人信息 | 生日、星座、MBTI、公司、职位、电话、地址、网站       |
| 标签    | 预设兴趣标签                                           |
| 修改密码 | 旧密码 + 新密码验证                                   |

---

### 4.13 通知系统（Notifications）

**后端路由**：`/api/notifications`
**前端组件**：`NotificationBell`、`NotificationList`

#### 功能

| 功能         | 后端接口                             | 说明                                |
|-------------|--------------------------------------|-------------------------------------|
| 通知列表     | `GET /notifications`                 | 分页，按类型/已读状态筛选           |
| 未读数       | `GET /notifications/unread-count`    | Header 徽章显示                     |
| 标记已读     | `PATCH /notifications/:id/read`      | 单条标记                            |
| 全部已读     | `PATCH /notifications/read-all`      | 批量标记                            |
| 删除         | `DELETE /notifications/:id`          |                                     |
| 测试邮件     | `POST /notifications/test-email`     | 测试 SMTP 配置                      |

#### 通知类型

```
TASK_DUE（任务到期）/ COST_ALERT（成本预警）
PROJECT_CHANGE（项目变更）/ AI_REPORT（AI 报告）/ SYSTEM（系统通知）
```

---

## 5. 数据库设计

### 5.1 数据库概述

- **引擎**：SQLite（单文件，WAL 模式，busy_timeout=5000ms）
- **ORM**：Prisma 6，所有数据库操作通过 Prisma Client
- **文件**：`backend/prisma/dev.db`
- **Schema**：`backend/prisma/schema.prisma`
- **模型数**：27 个

### 5.2 核心模型关系

```
User ──1:1── Profile
User ──1:N── Session
User ──1:N── Project ──1:N── Task（自关联 parentId 支持子任务）
User ──1:N── Project ──1:N── CostRecord
User ──1:N── Customer ──1:N── Communication
User ──1:N── Goal ──1:N── GoalProgressLog
User ──1:N── Goal ──1:N── GoalMilestone
User ──1:N── Goal ──1:N── GoalCheckin
User ──1:N── ConversationSession ──1:N── Conversation
User ──1:N── Setting（KV 存储）
User ──1:1── UserPreference
User ──1:N── UserMemory（AI 长期记忆）
User ──1:N── Transaction
User ──1:N── Notification
User ──1:N── CronJob ──1:N── JobExecutionLog
Project ──1:N── Payment ──1:1── Transaction
User ──1:N── Subscription
User ──1:N── WorkTimer
User ──1:N── TimeEntry
User ──1:N── TodayTodo
User ──1:N── Greeting
```

### 5.3 关键设计决策

| 决策                              | 说明                                          |
|----------------------------------|-----------------------------------------------|
| 金额用整数（分）                  | 避免浮点数精度问题，100.50元 = 10050          |
| Task 自关联 parentId             | 支持任意深度子任务层级                        |
| Goal 多种进度模式                  | AUTO/MANUAL/MILESTONE/CHECKIN 四种模式        |
| Setting KV 存储                   | userId + category + key 唯一索引，支持加密    |
| UserMemory AI 记忆                 | 分类存储，置信度评分，来源标记                 |
| SQLite WAL 模式                   | 提升并发读写性能                              |

---

## 6. AI 智能系统

### 6.1 对话系统

**后端路由**：`/api/llm`
**前端页面**：`/main/ai`
**前端组件**：`AiPanel`（右侧滑出）、`ChatPanel`、`MessageBubble`、`ToolCallBar`

#### 核心能力

| 功能           | 说明                                                   |
|---------------|--------------------------------------------------------|
| SSE 流式对话   | `POST /llm/chat/stream`，逐字输出                     |
| 多轮对话       | 会话管理（CRUD），支持固定/默认会话                    |
| Function Calling | AI 自动选择工具执行操作，用户确认后执行               |
| 文件上传       | `POST /llm/chat/upload`，支持 DOCX/PDF/Excel/图片，最多 5 文件 |
| 语音输入       | `POST /llm/speech/transcribe`，Whisper STT            |
| 动态工具路由   | 根据用户消息自动选择相关工具，减少 token 消耗          |
| 记忆注入       | 自动注入 UserMemory 到对话上下文                       |
| 缓存失效       | 工具写操作后自动 invalidate 相关 React Query 缓存       |

### 6.2 AI 工具体系（Function Calling）

工具目录：`backend/src/ai/tools/`

#### 工具分类

| 分类     | 工具名                                                         | 功能                       |
|---------|---------------------------------------------------------------|----------------------------|
| CRUD    | create-project, create-task, delete-project, cost-write, goal-write, payment-tools, transaction-tools, subscription-tools | 直接操作系统数据         |
| 查询    | task-query, project-query, dashboard-tools, report-tools, get-profit-analysis, get-cash-flow, get-cost-breakdown, get-revenue-by-client, get-goal-progress, get-today-focus, get-client-follow-up, get-financial-trends | 读取分析数据           |
| 搜索    | search-web, searxng-search, sogou-search, google-news, search-quality | 网络搜索                 |
| 外部数据 | github-trending, hacker-news, product-hunt, npm-search, dev-to, daily-hot, exchange-rate, world-bank | 行业动态             |
| 动作    | send-email, send-webhook, undo-last-tool, work-timer          | 发送邮件/Webhook/撤销操作 |
| 调度    | get-current-time, complexity-assessment, historical-accuracy, rebalance-suggest, schedule-advice, insertion-evaluation | 智能排期            |
| 记忆    | memory-extractor, prompt-selector                              | 长期记忆提取/管理        |

### 6.3 AI 记忆系统

**数据库模型**：`UserMemory`

| 字段       | 说明                                           |
|-----------|------------------------------------------------|
| category  | PREFERENCE / HABIT / FINANCE / PROJECT / SUMMARY |
| key       | 记忆键（每个用户唯一）                          |
| value     | 记忆内容                                        |
| confidence| 置信度 0-1                                      |
| source    | auto（AI 自动提取）/ user（用户指定）/ weekly（周汇总）|

---

## 7. 定时任务系统

### 7.1 系统内置任务（8 个）

| 任务 slug        | 功能说明                             | 触发频率     |
|-----------------|--------------------------------------|-------------|
| morning-briefing | AI 生成每日晨报（项目进展/待办/天气） | 每日       |
| weekly-report    | AI 生成周报（工作成果/下周计划）      | 每周       |
| finance-pulse    | 财务脉搏异常报告                      | 每日       |
| client-radar     | 客户跟进提醒                          | 每日       |
| health-check     | 业务健康度评估                        | 每周       |
| cost-alert       | 成本预算超支预警                      | 每日       |
| due-reminder     | 任务到期提醒                          | 每日       |
| weekly-memory    | AI 记忆整合（周度）                   | 每周       |

### 7.2 自定义定时任务

**后端路由**：`/api/cron-jobs`
**前端页面**：`/main/ai`（规则 Tab）

| 功能             | 后端接口                              | 说明                             |
|-----------------|---------------------------------------|----------------------------------|
| 任务列表        | `GET /cron-jobs`                      | 系统任务 + 自定义任务            |
| 创建任务        | `POST /cron-jobs`                     | cron 表达式、动作类型、配置       |
| 立即执行        | `POST /cron-jobs/:id/run`             | 手动触发一次                     |
| 测试执行        | `POST /cron-jobs/:id/test`            | 测试但不发送通知                 |
| 测试推送        | `POST /cron-jobs/:id/test-notify`     | 测试通知渠道                     |
| 执行历史        | `GET /cron-jobs/:id/history`          | 查看执行结果                     |

#### 动作类型

```
NOTIFY（通知）   —— 发送邮件/Webhook
AI_ANALYSIS（AI分析） —— AI 生成分析报告
WEBHOOK（Webhook）    —— 调用外部接口
```

### 7.3 n8n 集成

**后端路由**：`/api/webhooks`（公开接口，无需认证）

| 接口                     | 说明                              |
|-------------------------|-----------------------------------|
| `POST /webhooks/incoming` | 接收 n8n 工作流回调               |
| `POST /webhooks/notify`   | 接收 n8n 通知推送                 |

请求需携带 `x-webhook-secret` 请求头验证身份。

---

## 8. 安全与认证

### 8.1 认证流程

```
1. 用户登录 → 后端验证密码 → 生成 JWT（HS256）→ 写入 httpOnly Cookie
2. 后续请求 → Cookie 自动携带 → auth 中间件验证 JWT → 解析 userId
3. JWT < 24h → 自动续期（静默更新）
4. 超时 → 返回 401 → 前端自动跳转登录页（5 秒冷却）
```

### 8.2 安全措施

| 措施                  | 实现方式                                          |
|----------------------|---------------------------------------------------|
| 密码加密              | bcrypt，salt 10                                    |
| JWT 存储              | httpOnly Cookie，禁止 JS 读取                     |
| 验证码                | SVG Captcha，一次性使用，5 分钟过期               |
| 限频                  | 内存滑动窗口，登录 5次/分，注册 3次/分，API 60次/分 |
| 安全头                | Helmet（CSP 由 Nginx 处理）                       |
| CORS                  | 动态 origin 验证，credentials: true              |
| 配置加密              | AES 加密存储敏感配置（API Key 等）                |
| 会话管理              | Session 模型记录设备/IP/过期时间                  |
| 全局错误处理          | Prisma 错误码映射（P2002→409, P2025→404）       |
| CSRF 防护             | Cookie SameSite: lax/strict                      |

### 8.3 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数校验失败",
    "details": [
      { "field": "email", "message": "邮箱格式不正确" }
    ]
  }
}
```

---

## 9. 项目目录结构

### 9.1 后端目录

```
backend/
├── prisma/
│   ├── schema.prisma          # 数据库模型定义（27 个模型）
│   ├── dev.db                 # SQLite 数据库文件
│   └── seed.ts                # 测试数据种子
├── src/
│   ├── server.ts              # 入口：数据库连接、Cron 初始化、HTTP 启动
│   ├── app.ts                 # Express 应用：中间件、CORS、路由挂载
│   ├── config.ts              # 环境变量配置
│   ├── routes/                # 路由层（25 个路由文件）
│   │   ├── index.ts           # 路由注册中心
│   │   ├── auth.routes.ts
│   │   ├── project.routes.ts
│   │   ├── task.routes.ts
│   │   ├── cost.routes.ts
│   │   ├── customer.routes.ts
│   │   ├── goal.routes.ts
│   │   ├── dashboard.routes.ts
│   │   ├── report.routes.ts
│   │   ├── llm.routes.ts
│   │   ├── scheduler.routes.ts
│   │   ├── research.routes.ts
│   │   ├── notification.routes.ts
│   │   ├── setting.routes.ts
│   │   ├── webhook.routes.ts
│   │   ├── greeting.routes.ts
│   │   ├── profile.routes.ts
│   │   ├── preference.routes.ts
│   │   ├── cron-job.routes.ts
│   │   ├── job.routes.ts
│   │   ├── work.routes.ts
│   │   ├── transaction.routes.ts
│   │   ├── payment.routes.ts
│   │   ├── subscription.routes.ts
│   │   └── finance.routes.ts
│   ├── services/              # 业务逻辑层
│   ├── validators/            # Zod 校验 Schema
│   ├── middleware/             # 中间件（auth/validate/rateLimit/errorHandler）
│   ├── utils/                 # 工具函数（响应/错误/JWT/哈希/邮件/验证码等）
│   ├── ai/                    # AI 工具系统（tools/、tool-router）
│   ├── jobs/                  # 定时任务（8 个内置 + 自定义执行器）
│   └── prompts/               # AI 系统提示词文件
└── package.json
```

### 9.2 前端目录

```
frontend/
├── src/
│   ├── app/                   # Next.js App Router 页面
│   │   ├── layout.tsx         # 根布局（QueryProvider + ThemeProvider）
│   │   ├── page.tsx           # 根页面（→ 跳转登录）
│   │   ├── error.tsx          # 全局错误边界
│   │   ├── not-found.tsx      # 404 页面
│   │   ├── auth-pages/        # 认证页面（login/register/forgot/reset）
│   │   └── main/              # 主应用页面
│   │       ├── layout.tsx     # 主布局（侧边栏 + 头部 + AI 面板）
│   │       ├── dashboard/     # 仪表盘
│   │       ├── projects/      # 项目列表
│   │       ├── projects/[id]/ # 项目详情
│   │       ├── tasks/         # 任务管理（看板/列表/甘特）
│   │       ├── customers/     # 客户管理
│   │       ├── finance/       # 财务中心
│   │       ├── goals/         # 目标管理
│   │       ├── reports/       # 报表分析
│   │       ├── research/      # 行业调研
│   │       ├── ai/            # AI 工作台（定时任务配置）
│   │       ├── settings/      # 系统设置
│   │       ├── preferences/   # 个人偏好
│   │       ├── profile/       # 个人资料
│   │       └── schedule/      # 调度（→ 重定向到甘特图）
│   ├── components/
│   │   ├── layout/            # 布局组件（AppLayout/Sidebar/Header）
│   │   ├── ui/                # 基础 UI 组件（shadcn/ui）
│   │   ├── providers/         # React Query / Theme Provider
│   │   └── features/          # 业务组件
│   │       ├── ai/            # AI 对话（ChatPanel/MessageBubble/ToolCallBar 等）
│   │       ├── auth/          # 认证表单
│   │       ├── costs/         # 成本管理
│   │       ├── cron-job/      # 定时任务卡片
│   │       ├── customers/     # 客户表单/列表
│   │       ├── dashboard/     # 仪表盘组件
│   │       ├── finance/       # 财务三个 Tab
│   │       ├── goals/         # 目标管理组件
│   │       ├── notification/  # 通知组件
│   │       ├── projects/      # 项目卡片/表单/任务抽屉
│   │       ├── reports/       # 图表组件
│   │       ├── research/      # 调研搜索组件
│   │       ├── schedule/      # 调度/甘特图组件
│   │       ├── settings/      # 设置表单
│   │       ├── tasks/         # 任务看板/列表/表单
│   │       └── work/          # 工作台工具
│   ├── hooks/                 # 自定义 Hooks（React Query + Zustand）
│   │   ├── useAuth.ts         # 认证状态（Zustand）
│   │   ├── useProjects.ts     # 项目 CRUD
│   │   ├── useTasks.ts        # 任务 CRUD（乐观更新）
│   │   ├── useSchedule.ts     # 调度计算
│   │   ├── useCustomers.ts    # 客户 CRUD
│   │   ├── useFinance.ts      # 财务汇总/趋势
│   │   ├── useTransactions.ts # 收支 CRUD
│   │   ├── usePayments.ts     # 收款跟踪
│   │   ├── useSubscriptions.ts# 订阅管理
│   │   ├── useCosts.ts        # 成本 CRUD
│   │   ├── useGoals.ts        # 目标 CRUD + 里程碑/打卡
│   │   ├── useAiChat.ts       # AI 对话（SSE + 工具调用）
│   │   ├── useResearch.ts     # 调研搜索
│   │   ├── useCronJobs.ts     # 定时任务管理
│   │   ├── useSettings.ts     # 系统设置
│   │   └── useDashboard.ts    # 仪表盘数据
│   └── lib/
│       ├── api.ts             # API 客户端（fetch + 错误映射 + 自动重定向）
│       ├── utils.ts           # cn() 工具函数
│       ├── task-utils.ts      # 日期/金额格式化
│       ├── captcha-cache.ts   # 验证码缓存
│       └── auth.ts            # 认证工具（Cookie 存储说明）
└── package.json
```

### 9.3 API 接口汇总（按路由组）

| 路由组           | 接口数 | 认证 | 说明                            |
|-----------------|--------|------|---------------------------------|
| `/api/auth`     | 11     | 部分  | 登录/注册/密码重置/验证码        |
| `/api/projects` | 6      | 是   | 项目 CRUD + 归档                |
| `/api/tasks`    | 8      | 是   | 任务 CRUD + 状态更新 + 统计      |
| `/api/costs`    | 5      | 是   | 成本 CRUD + 汇总                |
| `/api/customers`| 5      | 是   | 客户 CRUD                       |
| `/api/goals`    | 16     | 是   | 目标 CRUD + 里程碑 + 打卡       |
| `/api/dashboard`| 4      | 是   | 仪表盘数据                      |
| `/api/reports`  | 16     | 是   | 报表分析（4 维度 16 接口）       |
| `/api/llm`      | 16     | 是   | AI 对话 + 语音 + 会话管理       |
| `/api/scheduler`| 4      | 是   | 智能调度                        |
| `/api/research` | 13     | 是   | 行业调研 + 简报                 |
| `/api/finance`  | 3      | 是   | 财务汇总/趋势/对比              |
| `/api/transactions` | 4  | 是   | 收支 CRUD                       |
| `/api/payments` | 4      | 是   | 收款 + 应收 + 账龄              |
| `/api/subscriptions` | 7 | 是   | 订阅 CRUD + 暂停/恢复           |
| `/api/notifications` | 6 | 是   | 通知 CRUD                       |
| `/api/settings` | 16     | 是   | AI/邮件/Webhook/代理/会话       |
| `/api/cron-jobs`| 10     | 是   | 定时任务 CRUD + 执行            |
| `/api/jobs`     | 2      | 是   | 内置任务手动触发                |
| `/api/work`     | 10     | 是   | 计时器 + 待办                   |
| `/api/profile`  | 2      | 是   | 个人资料                        |
| `/api/preferences`| 2    | 是   | 偏好设置                        |
| `/api/greetings`| 5      | 是   | 问候语 CRUD                     |
| `/api/webhooks` | 2      | 否   | n8n 回调/通知                   |
| `/api/health`   | 1      | 否   | 健康检查                        |

**总计：约 168 个 API 接口**

---

## 附录：环境变量配置

| 变量                 | 必填 | 默认值           | 说明                        |
|---------------------|------|------------------|-----------------------------|
| `DATABASE_URL`      | 是   | -                | SQLite 连接串               |
| `JWT_SECRET`        | 是   | -                | JWT 签名密钥                |
| `ENCRYPTION_KEY`    | 是   | -                | AES 加密密钥                |
| `PORT`              | 否   | 3001             | 后端端口                    |
| `NODE_ENV`          | 否   | development      | 运行环境                    |
| `FRONTEND_URL`      | 否   | -                | 前端地址（生产 CORS）       |
| `COOKIE_SECURE`     | 否   | false            | Cookie Secure 标志          |
| `TRUST_PROXY`       | 否   | -                | 代理信任层数                |
| `CRON_ENABLED`      | 否   | false            | 是否启动定时任务            |
| `DEFAULT_AI_PROVIDER`| 否  | -                | 默认 AI 供应商              |
| `DEFAULT_AI_API_KEY` | 否  | -                | 默认 AI API Key             |
| `DEFAULT_AI_BASE_URL`| 否  | -                | 默认 AI Base URL            |
| `DEFAULT_AI_MODEL`  | 否   | -                | 默认 AI 模型                |
| `SMTP_HOST`         | 否   | -                | SMTP 服务器                 |
| `SMTP_PORT`         | 否   | -                | SMTP 端口                   |
| `SMTP_USER`         | 否   | -                | SMTP 用户名                 |
| `SMTP_PASS`         | 否   | -                | SMTP 密码                   |
| `N8N_BASE_URL`      | 否   | -                | n8n 服务器地址              |
| `N8N_WEBHOOK_SECRET`| 否   | -                | n8n Webhook 验证密钥        |
