# TaskFlow+ 项目代码函数功能说明文档

> 生成日期：2026-06-01 | 项目版本：基于 `e504d17` 提交后的代码审查优化版

---

## 目录

- [一、项目架构概览](#一项目架构概览)
- [二、后端服务层 (Services)](#二后端服务层-services)
- [三、后端工具层 (Utils)](#三后端工具层-utils)
- [四、后端中间件层 (Middleware)](#四后端中间件层-middleware)
- [五、后端校验层 (Validators)](#五后端校验层-validators)
- [六、后端路由层 (Routes)](#六后端路由层-routes)
- [七、后端定时任务 (Jobs)](#七后端定时任务-jobs)
- [八、后端 AI 模块](#八后端-ai-模块)
- [九、前端 Hooks](#九前端-hooks)
- [十、前端业务组件](#十前端业务组件)
- [十一、前端通用 UI 组件](#十一前端通用-ui-组件)
- [十二、前端页面](#十二前端页面)
- [十三、前端工具库 (Lib)](#十三前端工具库-lib)
- [十四、前端布局与提供者](#十四前端布局与提供者)

---

## 一、项目架构概览

```
HTTP 请求
  → app.ts (CORS / JSON解析 / Cookie解析)
    → routes/index.ts (路由分发 + auth 中间件 + apiLimit 限频)
      → routes/xxx.routes.ts (路由定义 + validate 中间件)
        → validators/xxx.schema.ts (Zod 参数校验)
          → services/xxx.service.ts (业务逻辑 + Prisma DB 操作)
            → 返回统一格式 { success, data/error }
```

**技术栈**:
- 前端: Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui + React Query + Zustand
- 后端: Express 5 + Prisma 6 + SQLite + Zod 3 + TypeScript
- AI: OpenAI SDK（多供应商适配：DeepSeek / Claude / Ollama）
- 自动化: node-cron 定时任务

**数据隔离原则**: 所有服务层函数必须传入 `userId`，查询必须过滤 `ownerId`，确保用户数据完全隔离。

---

## 二、后端服务层 (Services)

### 2.1 auth.service — 认证服务

| 函数 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `register` | `email, password, name, req` | `{ user, token }` | 用户注册：检查邮箱唯一性 → bcrypt 加密密码 → 创建用户 → 自动签发 JWT |
| `login` | `email, password, req` | `{ user, token }` | 用户登录：邮箱查找 → 验证密码 → 签发 JWT → 创建 Session（存 Token SHA-256 哈希） |
| `logout` | `token` | `void` | 根据 Token 的 SHA-256 哈希删除 Session 记录 |
| `getUserById` | `userId` | `User` | 获取用户信息（不含密码等敏感字段） |
| `updateProfile` | `userId, { name?, avatar? }` | `User` | 更新用户昵称和头像 |
| `changePassword` | `userId, oldPassword, newPassword` | `{ success }` | 验证原密码后更新为新密码 |

### 2.2 project.service — 项目服务

| 函数 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `findAll` | `userId, { page?, limit?, status?, startDate?, endDate? }` | `{ data, total, page, limit }` | 分页查询项目列表，批量聚合每个项目的预算使用情况（成本 + 任务花销），含关联客户信息 |
| `findById` | `userId, id` | `Project \| null` | 查询项目详情，含任务统计、最近 5 条任务、预算使用情况 |
| `create` | `userId, CreateProjectInput` | `Project` | 创建新项目，支持预算/日期/客户关联/费用备注/奖励备注/类型 |
| `update` | `userId, id, UpdateProjectInput` | `Project \| null` | 更新项目信息并重新计算预算使用情况 |
| `archive` | `userId, id` | `Project \| null` | 归档项目（状态设为 ARCHIVED） |
| `remove` | `userId, id` | `{ deleted: true }` | 事务删除项目 → 关联成本记录 → 关联任务 |

### 2.3 task.service — 任务服务

| 函数 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `findAll` | `userId, TaskQueryInput` | `{ data, total, page, limit }` | 分页查询任务列表，支持按状态/优先级/项目/负责人/搜索关键词/日期范围筛选，含子任务统计 |
| `findById` | `userId, id` | `Task \| null` | 查询任务详情，含子任务和父任务信息 |
| `getByProject` | `userId, projectId` | `Task[]` | 获取项目下所有顶层任务及子任务，批量聚合花销（groupBy 优化） |
| `create` | `userId, CreateTaskInput` | `Task \| null` | 创建任务（验证项目归属权） |
| `update` | `userId, id, UpdateTaskInput` | `Task \| null` | 更新任务，状态切换时自动处理 completedAt/blockedReason，自动更新父任务进度 |
| `remove` | `userId, id` | `{ deleted } \| null` | 级联删除：子任务 → 关联成本 → 父任务进度更新 |
| `updateStatus` | `userId, id, status, blockedReason?` | `Task \| null` | 快捷更新任务状态 |

### 2.4 customer.service — 客户服务

| 函数 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `findAll` | `userId, { page?, limit?, search?, status?, startDate?, endDate? }` | `{ data, total, page, limit }` | 分页查询客户列表，含项目统计和最后联系信息 |
| `findById` | `userId, id` | `Customer \| null` | 查询客户详情，含关联项目和最近 5 条沟通记录 |
| `create` | `userId, CreateCustomerInput` | `Customer` | 创建新客户 |
| `update` | `userId, id, UpdateCustomerInput` | `Customer \| null` | 更新客户信息 |
| `remove` | `userId, id` | `{ deleted: boolean }` | 删除客户 |

### 2.5 cost.service — 成本服务

| 函数 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `findAll` | `userId, projectId, { page?, limit?, category? }` | `{ data, total, page, limit }` | 分页获取项目成本列表，含项目归属权验证 |
| `getSummaryByProject` | `userId, projectId` | `{ total, byCategory }` | 按类别汇总项目成本，计算各类占比 |
| `create` | `userId, projectId, CostData` | `CostRecord` | 创建成本记录（验证项目归属权） |
| `remove` | `userId, id` | `CostRecord` | 删除成本记录（验证成本归属权） |
| `getMonthlySummary` | `userId, month?` | `{ month, total, byProject, byCategory }` | 按月汇总用户所有项目的成本 |

### 2.6 goal.service — 目标服务

| 函数 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `findAll` | `userId, { page?, limit?, status?, type? }` | `{ data, total, page, limit }` | 分页查询目标列表，含里程碑/项目/客户关联信息 |
| `findById` | `userId, id` | `Goal` | 查询目标详情 |
| `create` | `userId, CreateGoalInput` | `Goal` | 创建目标，自动根据 metricType 推断单位(unit)和进度模式(progressMode) |
| `update` | `userId, id, UpdateGoalInput` | `Goal` | 更新目标，修改 metricType 时自动更新 unit 和 progressMode |
| `remove` | `userId, id` | `Goal` | 删除目标 |
| `updateProgress` | `userId, id, UpdateProgressInput` | `Goal` | 手动更新进度，达标自动标记为 COMPLETED |
| `calculateAutoProgress` | `userId, id` | `CalculateResult` | 自动计算进度：REVENUE(收入)、PROJECT_COUNT(项目数)、CLIENT_COUNT(客户数)、HOURS(工时)、PERCENTAGE(手动) |
| `getOverview` | `userId` | `{ goals, summary }` | 目标看板：预期进度 vs 实际进度、剩余天数、风险状态(onTrack/atRisk) |
| `getUserProjects` | `userId` | `Project[]` | 获取用户项目列表（供目标关联选择） |
| `getUserCustomers` | `userId` | `Customer[]` | 获取用户客户列表（供目标关联选择） |
| `getProgressLogs` | `userId, goalId` | `ProgressLog[]` | 获取进度日记列表 |
| `addProgressLog` | `userId, goalId, data` | `{ log, goal }` | 添加进度日记并累加进度 |
| `deleteProgressLog` | `userId, goalId, logId` | `Goal` | 删除进度日记并回退进度 |
| `getMilestones` | `userId, goalId` | `Milestone[]` | 获取里程碑列表 |
| `createMilestone` | `userId, goalId, data` | `Milestone` | 创建里程碑并重新计算进度 |
| `updateMilestone` | `userId, goalId, milestoneId, data` | `Milestone` | 更新里程碑状态并重新计算进度 |
| `deleteMilestone` | `userId, goalId, milestoneId` | `{ deleted }` | 删除里程碑并重新计算进度 |

### 2.7 dashboard.service — 仪表盘服务

| 函数 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `getStats` | `userId` | `{ projectCount, totalTasks, doneTasks, completionRate, totalCost, overdueCount }` | 仪表盘统计：项目总数/任务统计/完成率/总成本/逾期数 |
| `getRecentTasks` | `userId, limit?` | `Task[]` | 获取最近更新的任务列表 |
| `getProjectStats` | `userId` | `{ id, name, status, totalTasks, doneTasks }[]` | 最近项目状态统计 |

### 2.8 report.service — 报告服务

| 函数 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `getOverview` | `userId, period?, type?` | `{ income, expense, profit, margin, period, type }` | 财务概览：收入(已完成项目预算) / 支出(成本+任务花销) / 利润 / 利润率，支持日/月/年 |
| `getProjectRanking` | `userId, period?, type?` | `{ id, name, budget, cost, profit, margin }[]` | 项目利润排行榜（groupBy 优化），按利润率降序 |
| `getCostStructure` | `userId, period?, type?` | `{ category, amount, percent }[]` | 成本结构分析（按类别分组） |
| `getTimeAnalysis` | `userId, period?, type?` | `{ byProject, totalHours, avgPerDay }` | 工时分析（按项目/日均） |

### 2.9 scheduler.service — 排期服务

| 函数 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `calculateSchedule` | `userId, { projectId, dailyHourLimit }` | `ScheduleResult` | 自动排期计算：贪心算法分配任务到每天，返回每日工作量和汇总 |
| `detectDelays` | `userId, projectId` | `DelayedTask[]` | 检测逾期任务，返回每个任务的延期天数 |
| `detectConflicts` | `userId, { projectId, dailyHourLimit }` | `ConflictData` | 检测时间重叠冲突和每日工时超载 |
| `insertionSimulation` | `userId, InsertionSimulationInput` | `InsertionResult` | 模拟插入新任务，对比前后变化 |

### 2.10 notification.service — 通知服务

| 函数 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `findAll` | `userId, filters?` | `{ data, total, page, limit }` | 分页查询通知，支持按类型/已读状态筛选 |
| `getUnreadCount` | `userId` | `number` | 获取未读通知数 |
| `markAsRead` | `userId, id` | `Notification` | 标记为已读 |
| `markAllAsRead` | `userId` | `{ count }` | 全部标记已读 |
| `remove` | `userId, id` | `Notification` | 删除通知 |
| `create` | `userId, type, title, content, relatedId?` | `Notification` | 创建通知（TASK_DUE/COST_ALERT/PROJECT_CHANGE/AI_INSIGHT 等） |
| `sendEmail` | `to, subject, body` | `void` | 通过 nodemailer 发送 HTML 邮件 |

### 2.11 setting.service — 设置服务

| 函数 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `getProviders` | `userId` | `ProviderInfo[]` | 获取用户已配置的 AI 供应商（含解密 API Key） |
| `getAvailableProviders` | `userId` | `ProviderInfo[]` | 已配置 + 预置的完整 21 个供应商列表 |
| `saveProvider` | `userId, { name, label?, baseUrl, apiKey? }` | `{ name, saved }` | 保存 AI 供应商配置（API Key AES-256-GCM 加密存储） |
| `deleteProvider` | `userId, provider` | `{ deleted }` | 删除自定义供应商 |
| `getBaseUrl` | `userId, provider` | `string` | 动态获取供应商 Base URL（用户配置优先，fallback 预置值） |
| `getPresetBaseUrl` | `provider` | `string` | 同步获取预置供应商 Base URL |
| `testAiConnection` | `provider, apiKey, baseUrl?` | `{ success, message, modelCount?, url }` | 测试 AI 连接 |
| `fetchModelsFromProvider` | `userId, provider, apiKey, baseUrl?` | `{ models, error? }` | 从供应商 API 获取模型列表，智能 tier 分级(fast/balanced/powerful) |
| `getFallbackModelsForProvider` | `provider` | `Model[]` | 获取供应商 fallback 模型列表 |
| `getByCategory` | `userId, category` | `Record<string, string>` | 获取某分类下所有设置（加密字段自动解密） |
| `get` | `userId, category, key` | `string \| null` | 获取单个配置项 |
| `set` | `userId, category, key, value, encrypted?` | `Setting` | 设置单个配置项 |
| `batchSet` | `userId, settings[]` | `Setting[]` | 批量设置配置项（事务） |
| `getSessions` | `userId` | `Session[]` | 获取登录设备列表 |
| `deleteSession` | `userId, sessionId` | `{ deleted }` | 踢出指定设备 |

### 2.12 cron-job.service — 定时任务服务

| 函数 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `findAll` | `userId, { enabled? }` | `CronJob[]` | 查询用户定时任务 |
| `findById` | `userId, id` | `CronJob` | 查询详情 |
| `create` | `userId, CreateCronJobInput` | `CronJob` | 创建自定义定时任务 |
| `update` | `userId, id, UpdateCronJobInput` | `CronJob` | 更新定时任务 |
| `remove` | `userId, id` | `CronJob` | 删除定时任务（系统预置不可删） |
| `ensureSystemJobs` | `userId` | `{ created }` | 初始化 8 个系统预置定时任务 |

### 2.13 work.service — 工作计时器服务

| 函数 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `getTodayEntries` | `userId` | `TimeEntry[]` | 获取今日工时记录 |
| `getTodayTodo` | `userId` | `Todo[]` | 获取今日待办 |
| `addTodo` | `userId, content` | `Todo` | 添加待办 |
| `toggleTodo` | `userId, id` | `Todo \| null` | 切换完成状态 |
| `removeTodo` | `userId, id` | `{ deleted }` | 删除待办 |
| `startTimer` | `userId, { description?, taskId?, projectId? }` | `WorkTimer` | 启动计时器（自动结束之前的） |
| `pauseTimer` | `userId, id` | `WorkTimer \| null` | 暂停计时器 |
| `resumeTimer` | `userId, id` | `WorkTimer \| null` | 恢复计时器 |
| `stopTimer` | `userId, id` | `WorkTimer \| null` | 停止并写入工时记录 |
| `getActiveTimer` | `userId` | `WorkTimer[]` | 获取活跃计时器 |

### 2.14 其他服务

| 服务 | 关键函数 | 说明 |
|------|----------|------|
| `greeting.service` | `getActive, getAll, create, update, remove` | 问候语管理，支持时间段设置和跨夜（如 22:00~06:00） |
| `search.service` | `search, getHistory, clearHistory, getSaved, saveItem, removeSaved` | 多源搜索（GitHub/HN/Dev.to 并行），收藏管理 |
| `profile.service` | `getProfile, updateProfile` | 个人资料管理（upsert） |
| `preference.service` | `getPreferences, updatePreferences` | 偏好设置管理（upsert，含主题/语言/时区/提醒等） |
| `ai.service` | `AIService` 类（chat/registerTools/testConnection） | OpenAI SDK 多供应商适配，流式多轮工具调用，未配置自动降级 Mock |
| `encryption.service` | `encrypt, decrypt` | AES-256-GCM 加密（兼容旧 CBC 格式） |

---

## 三、后端工具层 (Utils)

### 3.1 response.ts — 统一响应

| 函数 | 参数 | 说明 |
|------|------|------|
| `success` | `res, data, message?, statusCode?` | 发送 `{ success: true, data, message? }` |
| `error` | `res, code, message, statusCode?, details?` | 发送 `{ success: false, error: { code, message, details? } }` |

### 3.2 errors.ts — 错误类

| 类 | 状态码 | 说明 |
|-----|--------|------|
| `AppError` | 自定义 | 基础业务错误（message, statusCode, code） |
| `NotFoundError` | 404 | 资源不存在 |
| `UnauthorizedError` | 401 | 未登录或登录过期 |
| `ForbiddenError` | 403 | 权限不足 |
| `ValidationError` | 400 | 参数校验失败（含 details） |
| `ConflictError` | 409 | 资源冲突 |

### 3.3 jwt.ts — JWT 工具

| 函数 | 说明 |
|------|------|
| `generateToken(payload)` | 生成含 userId/email/role 的 JWT |
| `verifyToken(token)` | 验证并解析 JWT |

### 3.4 hash.ts — 哈希工具

| 函数 | 说明 |
|------|------|
| `hashPassword(password)` | bcryptjs salt rounds 10 哈希密码 |
| `comparePassword(password, hash)` | 比对密码和哈希 |
| `hashToken(token)` | SHA-256 哈希 Token（Session 表安全存储） |

### 3.5 ai-wrapper.ts — AI 安全包装

| 函数 | 说明 |
|------|------|
| `safeAiCall(fn, fallback)` | AI 调用失败时自动降级返回 fallback 值 |

---

## 四、后端中间件层 (Middleware)

### 4.1 auth.ts — JWT 认证中间件

从 Cookie 或 Authorization Header 获取 Token → 验证 JWT → 注入 `req.userId` 和 `req.user`。剩余有效期不足 1 天时自动签发新 Token（无感续期）。

### 4.2 errorHandler.ts — 全局错误处理

捕获 AppError / Prisma 错误 / JWT 错误 / 未知错误，返回统一格式错误响应：
- P2002 → "该记录已存在" (409)
- P2025 → "记录不存在" (404)
- JWT TokenExpiredError / JsonWebTokenError → "Token 无效或已过期" (401)

### 4.3 validate.ts — Zod 校验中间件

工厂函数 `validate(schema, part?)` 返回 Express 中间件，校验 `req.body` / `req.query` / `req.params`，失败返回 400 及详细错误字段。

### 4.4 rateLimit.ts — 限频中间件

| 导出 | 说明 |
|------|------|
| `rateLimit(options)` | 工厂函数，基于内存 IP 的滑动窗口限频 |
| `loginLimit` | 预设：1 分钟 5 次 |
| `apiLimit` | 预设：1 分钟 60 次 |

包含 10 分钟定期清理过期记录，防内存泄漏。

---

## 五、后端校验层 (Validators)

| 文件 | Schema | 校验字段 |
|------|--------|----------|
| `auth.schema` | `registerSchema, loginSchema` | email/密码/姓名 |
| `project.schema` | `createProjectSchema, updateProjectSchema` | 名称/描述/状态/预算/日期/客户/费用备注/奖励备注/类型 |
| `task.schema` | `createTaskSchema, updateTaskSchema, updateTaskStatusSchema, taskQuerySchema` | 标题/状态/优先级/工时/花销/项目/负责人/父任务等 |
| `customer.schema` | `createCustomerSchema, updateCustomerSchema` | 名称/邮箱/电话/公司/地址/行业/状态/备注 |
| `goal.schema` | `createGoalSchema, updateGoalSchema, updateProgressSchema, createProgressLogSchema, createMilestoneSchema, updateMilestoneSchema` | 标题/类型/指标类型/目标值/日期/进度值/里程碑等 |
| `scheduler.schema` | `calculateScheduleSchema, insertionSimulationSchema, delayQuerySchema, conflictQuerySchema` | 项目ID/每日工时/任务参数 |
| `cron-job.schema` | `createCronJobSchema, updateCronJobSchema` | 名称/cron表达式/时区/动作类型/配置 |
| `notification.schema` | `notificationFiltersSchema` | 页码/类型/已读状态 |
| `llm.schema` | `chatSchema` | 消息/sessionId/模型 |
| `cost.schema` | *(TODO)* | 成本记录校验 |
| `setting.schema` | *(TODO)* | 设置校验 |
| `dashboard.schema` | *(TODO)* | 仪表盘筛选 |
| `report.schema` | *(TODO)* | 报告筛选 |
| `search.schema` | *(TODO)* | 搜索参数 |
| `research.schema` | *(TODO)* | 收藏参数 |

---

## 六、后端路由层 (Routes)

所有路由挂载在 `routes/index.ts` 中，基础路径为 `/api`。公开接口仅 `/auth` 和 `/webhooks`，其余所有接口需 JWT 认证 + apiLimit 限频。

### 6.1 auth.routes — 认证路由

| 方法 | 路径 | 中间件 | 说明 |
|------|------|--------|------|
| POST | `/api/auth/register` | validate | 用户注册 |
| POST | `/api/auth/login` | loginLimit + validate | 用户登录（5次/分钟限频） |
| POST | `/api/auth/logout` | auth | 用户登出 |
| GET | `/api/auth/me` | auth | 获取当前用户信息 |
| PUT | `/api/auth/profile` | auth | 更新个人信息 |
| PUT | `/api/auth/password` | auth | 修改密码 |

### 6.2 project.routes — 项目路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 项目列表（分页/状态/时间筛选） |
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects/:id` | 项目详情 |
| PUT | `/api/projects/:id` | 更新项目 |
| PATCH | `/api/projects/:id/archive` | 一键归档 |
| DELETE | `/api/projects/:id` | 删除项目 |

### 6.3 task.routes — 任务路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tasks` | 任务列表（筛选+排序） |
| GET | `/api/tasks/project/:projectId` | 项目下所有任务 |
| POST | `/api/tasks` | 创建任务 |
| GET | `/api/tasks/:id` | 任务详情 |
| PUT | `/api/tasks/:id` | 更新任务 |
| PATCH | `/api/tasks/:id/status` | 更新任务状态 |
| DELETE | `/api/tasks/:id` | 删除任务 |

### 6.4 customer.routes — 客户路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/customers` | 客户列表（搜索/状态/时间筛选） |
| POST | `/api/customers` | 创建客户 |
| GET | `/api/customers/:id` | 客户详情（含项目和沟通记录） |
| PUT | `/api/customers/:id` | 更新客户 |
| DELETE | `/api/customers/:id` | 删除客户 |

### 6.5 goal.routes — 目标路由（17 个端点）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/goals` | 目标列表 |
| GET | `/api/goals/overview` | 目标看板 |
| GET | `/api/goals/projects` | 项目列表（供关联） |
| GET | `/api/goals/customers` | 客户列表（供关联） |
| POST | `/api/goals` | 创建目标 |
| GET | `/api/goals/:id` | 目标详情 |
| PUT | `/api/goals/:id` | 更新目标 |
| DELETE | `/api/goals/:id` | 删除目标 |
| PATCH | `/api/goals/:id/progress` | 手动更新进度 |
| POST | `/api/goals/:id/calculate` | 自动计算进度 |
| GET | `/api/goals/:id/logs` | 进度日记列表 |
| POST | `/api/goals/:id/logs` | 添加进度日记 |
| DELETE | `/api/goals/:id/logs/:logId` | 删除进度日记 |
| GET | `/api/goals/:id/milestones` | 里程碑列表 |
| POST | `/api/goals/:id/milestones` | 添加里程碑 |
| PATCH | `/api/goals/:id/milestones/:milestoneId` | 更新里程碑状态 |
| DELETE | `/api/goals/:id/milestones/:milestoneId` | 删除里程碑 |

### 6.6 其他路由一览

| 模块 | 端点数 | 关键端点 |
|------|--------|----------|
| `cost.routes` | 5 | GET 项目成本/汇总，POST 创建，DELETE 删除，GET 月度汇总 |
| `dashboard.routes` | 3 | GET 摘要统计/最近活动/项目统计 |
| `report.routes` | 4 | GET 概览/项目排行/成本结构/时间分析 |
| `scheduler.routes` | 4 | POST 排期计算/插单模拟，GET 延期/冲突 |
| `notification.routes` | 5 | GET 列表/未读数，PATCH 已读，DELETE 删除 |
| `setting.routes` | 11 | AI 供应商/模型/测试/会话/配置 CRUD |
| `cron-job.routes` | 6 | 定时任务 CRUD + 系统初始化 |
| `work.routes` | 10 | 计时器(start/pause/resume/stop) + 今日待办(todo) |
| `greeting.routes` | 5 | 祝福语 CRUD |
| `profile.routes` | 2 | 个人资料 GET/PUT |
| `preference.routes` | 2 | 偏好设置 GET/PUT |
| `research.routes` | 6 | 搜索/历史/收藏管理 |
| `llm.routes` | 6 | 流式对话/非流式/会话管理/工具列表 |
| `search.routes` | *(TODO)* | 搜索/历史 |
| `webhook.routes` | *(TODO)* | n8n 回调/通用 Webhook |

---

## 七、后端定时任务 (Jobs)

所有任务通过 `node-cron` 注册，在 `jobs/index.ts` 中 `startAllCronJobs()` 统一启用。

| 任务 | Cron | 说明 |
|------|------|------|
| `due-reminder` | `0 8 * * *` (每日8:00) | 检测逾期任务，给开启提醒的用户发通知 |
| `morning-briefing` | `0 8 * * *` (每日8:00) | AI 生成晨间简报：今日任务/逾期/昨日完成/统计数据 |
| `finance-pulse` | `0 10 * * *` (每日10:00) | AI 分析当月预算/成本及环比，生成财务脉搏通知 |
| `cost-alert` | `0 10 * * *` (每日10:00) | 检查项目成本超预算 80%，发送预警 |
| `client-radar` | `0 9 * * *` (每日9:00) | AI 分析客户状态/末次联系，生成客户关系洞察 |
| `weekly-report` | `0 9 * * 1` (每周一9:00) | AI 生成本周周报 |
| `weekly-memory` | `0 20 * * 0` (每周日20:00) | 提取本周对话关键信息，存入 userMemory 表 |
| `health-check` | `0 10 * * 0` (每周日10:00) | AI 业务体检：项目/目标/客户/对话四维度评估 |

---

## 八、后端 AI 模块

### 8.1 AI 工具注册中心 (ai/tools/registry.ts)

统一注册 **31 个 AI 工具**，提供 `getAllTools()` / `getTool()` / `getToolsByCategory()` / `getWriteTools()` 方法。

### 8.2 财务类工具 (finance)

| 工具名 | 参数 | 说明 |
|--------|------|------|
| `get_cash_flow` | month | 指定月份现金流 |
| `get_cost_breakdown` | projectId, month | 成本明细分析 |
| `get_profit_analysis` | projectId? | 利润分析（预算-支出） |
| `get_revenue_by_client` | limit | 按客户收入排名 |
| `get_project_margin_ranking` | status | 项目利润排名 |

### 8.3 工作类工具 (work)

| 工具名 | 参数 | 说明 |
|--------|------|------|
| `get_today_focus` | topN | 今日工作焦点（按优先级+截止日） |
| `get_overdue_tasks` | — | 所有延期任务 |
| `get_project_progress` | projectId/projectName | 项目完成进度 |
| `create_task` | title, priority, estimatedHours, dueDate, projectId, 等 | 创建任务 |
| `update_task_status` | taskId/taskTitle, status, priority, blockedReason | 更新任务状态 |
| `delete_task` | taskId/taskTitle | 删除任务 |
| `log_time` | hours, description, projectId?, taskId? | 记录工时 |
| `get_schedule` | projectId/projectName | 查询排期/甘特图 |
| `create_project` | name, description?, budget?, type? | 创建项目 |
| `update_project` | projectId/projectName, name?, status?, budget? | 更新项目 |

### 8.4 客户类工具 (client)

| 工具名 | 参数 | 说明 |
|--------|------|------|
| `create_customer` | name, company?, industry?, status? | 创建客户 |
| `update_customer` | customerName, name?, status?, industry? | 更新客户 |
| `get_client_follow_up` | limit | 待跟进客户列表 |
| `get_client_insights` | clientName | 客户全景（信息+项目+沟通+金额） |
| `log_communication` | clientName, content | 记录客户沟通 |
| `get_client_ranking` | — | 客户价值排名 |

### 8.5 目标类工具 (goal)

| 工具名 | 参数 | 说明 |
|--------|------|------|
| `get_goal_progress` | type | 目标完成进度 |
| `get_weekly_review` | weekStart | 本周工作总结 |
| `suggest_weekly_plan` | weekStart | 下周计划建议 |
| `get_business_health` | — | 业务健康度四维度评估 |

### 8.6 搜索/外部工具

| 工具名 | 参数 | 说明 |
|--------|------|------|
| `search_web` | query, maxResults | 联网搜索（Tavily/SerpAPI） |
| `hacker_news` | category, topN | HN 热门内容（免费） |
| `exchange_rate` | from, to?, amount? | 实时汇率（欧洲央行） |
| `dev_to` | tag, sortBy, topN | Dev.to 技术文章（免费） |
| `product_hunt` | since, topN | PH 热门产品（需 Token） |
| `npm_search` | query, topN | npm 包搜索（免费） |
| `github_trending` | language, since, topN | GitHub Trending（免费） |

### 8.7 AI 核心类 (ai.service.ts)

`AIService` 类封装 OpenAI SDK，支持多供应商（DeepSeek/Claude/Ollama）：
- `init()` — 从 Setting 表读取配置 → 初始化客户端
- `registerTools(tools)` — 注册可调用工具
- `chat({ messages, model? })` — 流式对话（SSE），多轮工具调用，未配置时降级 Mock
- `testConnection()` — 连接测试

### 8.8 智能能力 (ai/capabilities/)

6 个能力类（均为 TODO 骨架）：
`TaskCapability` / `ProjectCapability` / `CustomerCapability` / `FinanceCapability` / `TimeCapability` / `DecisionCapability`

---

## 九、前端 Hooks

| Hook | Query Key | API 端点 | 说明 |
|------|-----------|----------|------|
| `useAuth` (Zustand) | — | `/auth/*` | 登录/注册/登出/获取用户，全局状态管理 |
| `useProjectList` | `['projects']` | `GET /projects` | 项目列表（分页/筛选） |
| `useProject` | `['projects']` | `GET /projects/:id` | 项目详情 |
| `useCreateProject` | — | `POST /projects` | 创建项目（invalidate `projects`） |
| `useUpdateProject` | — | `PUT /projects/:id` | 更新项目 |
| `useArchiveProject` | — | `PATCH /projects/:id/archive` | 归档项目 |
| `useDeleteProject` | — | `DELETE /projects/:id` | 删除项目 |
| `useTaskList` | `['tasks', 'list']` | `GET /tasks` | 任务列表（筛选+排序） |
| `useProjectTasks` | `['tasks', 'project']` | `GET /tasks/project/:id` | 项目下任务 |
| `useCreateTask` | — | `POST /tasks` | 创建任务（invalidate `tasks` + `projects`） |
| `useUpdateTask` | — | `PUT /tasks/:id` | 更新任务 |
| `useUpdateTaskStatus` | — | `PATCH /tasks/:id/status` | 更新状态（乐观更新） |
| `useDeleteTask` | — | `DELETE /tasks/:id` | 删除任务 |
| `useCustomerList` | `['customers']` | `GET /customers` | 客户列表 |
| `useCustomer` | `['customers']` | `GET /customers/:id` | 客户详情 |
| `useCreateCustomer` | — | `POST /customers` | 创建客户 |
| `useUpdateCustomer` | — | `PUT /customers/:id` | 更新客户 |
| `useDeleteCustomer` | — | `DELETE /customers/:id` | 删除客户 |
| `useGoalList` | `['goals', 'list']` | `GET /goals` | 目标列表 |
| `useGoalDetail` | `['goals', 'detail']` | `GET /goals/:id` | 目标详情 |
| `useGoalOverview` | `['goals', 'overview']` | `GET /goals/overview` | 目标看板 |
| `useCreateGoal` | — | `POST /goals` | 创建目标 |
| `useUpdateGoal` | — | `PUT /goals/:id` | 更新目标 |
| `useDeleteGoal` | — | `DELETE /goals/:id` | 删除目标 |
| `useUpdateProgress` | — | `PATCH /goals/:id/progress` | 更新进度 |
| `useCalculateProgress` | — | `POST /goals/:id/calculate` | 自动计算进度 |
| `useProgressLogs` | `['goals', 'logs']` | `GET /goals/:id/logs` | 进度日记 |
| `useAddProgressLog` | — | `POST /goals/:id/logs` | 添加进度日记 |
| `useDeleteProgressLog` | — | `DELETE /goals/:id/logs/:logId` | 删除进度日记 |
| `useCreateMilestone` | — | `POST /goals/:id/milestones` | 创建里程碑 |
| `useUpdateMilestone` | — | `PATCH /goals/:id/milestones/:mid` | 更新里程碑 |
| `useDeleteMilestone` | — | `DELETE /goals/:id/milestones/:mid` | 删除里程碑 |
| `useSchedule` | `['schedule', 'calculate']` | `POST /scheduler/calculate` | 排期计算 |
| `useDelays` | `['schedule', 'delays']` | `GET /scheduler/delays/:id` | 延期检测 |
| `useConflicts` | `['schedule', 'conflicts']` | `GET /scheduler/conflicts/:id` | 冲突检测 |
| `useInsertionSimulation` | — | `POST /scheduler/insertion` | 插单模拟 |
| `useCronJobs` | `['cron-jobs']` | `GET /cron-jobs` | 定时任务列表 |
| `useSettings` | `['settings']` | `GET /settings/:category` | 设置值 |
| `useUpdateSetting` | — | `PUT /settings/:category/:key` | 更新设置 |
| `useBatchUpdateSettings` | — | `POST /settings/batch` | 批量更新设置 |
| `useAiModels` | `['settings', 'ai-models']` | `GET /settings/ai/models` | AI 模型列表 |
| `useFetchModels` | — | `POST /settings/ai/fetch-models` | 动态拉取模型 |
| `useAiChat` (自定义) | — | `POST /llm/chat/stream` | SSE 流式 AI 对话，含工具调用处理和缓存失效 |

---

## 十、前端业务组件

### 10.1 AI 助手组件

| 组件 | 说明 |
|------|------|
| `AiPanel` | AI 主面板（860px 右滑抽屉），含侧边栏 + 聊天区 |
| `AiSidebar` | 左侧 320px：概览(智能摘要+快捷操作+项目列表) / 客户 / 历史 三 Tab |
| `ChatInput` | 底部输入框，含时段快捷提示词 |
| `MessageBubble` | 消息气泡（AI Markdown 渲染/用户纯文本，含工具调用/复制/重新生成） |
| `ToolCallBar` | 工具调用进度条（调用中/完成/错误） |
| `EmptyState` | 聊天空状态（根据时段问候） |
| `LoadingIndicator` | 动画加载指示器 |
| `QuickActions` | 快捷操作按钮（晨间简报/风险扫描/周计划） |
| `ProjectMiniList` | 活跃项目迷你列表 |
| `CustomerTab` | 客户关注列表 |
| `HistoryTab` | 会话历史列表（搜索/删除） |
| `ModelSwitcher` | AI 模型切换下拉 |
| `SmartDigest` | 智能摘要（今日任务/收入/客户数） |

### 10.2 项目组件

| 组件 | Props | 说明 |
|------|-------|------|
| `ProjectCard` | `{ project, onEdit?, onDelete?, onArchive? }` | 项目卡片：名称/状态/类型/预算进度条/客户/任务数/成本/日期/操作菜单 |
| `ProjectForm` | `{ open, onClose, onSubmit, editProject? }` | 项目表单弹窗：名称/描述/类型/状态/预算/日期/客户/备注 |
| `SubtaskList` | `{ tasks, projectId, onCreateSubtask, onUpdateTask, onDeleteTask }` | 任务树形列表，支持展开/折叠/状态切换/行内成本弹窗 |

### 10.3 任务组件

| 组件 | Props | 说明 |
|------|-------|------|
| `TaskCard` | `{ task, onEdit?, onDelete?, onClick?, isDragging? }` | 看板卡片（168px固定高）：标题/描述/状态/项目/优先级/成本/工时/截止日/子任务进度 |
| `TaskBoard` | `{ tasks, onStatusChange, onEdit?, onDelete?, onClick? }` | 四列看板（TODO/IN_PROGRESS/DONE/BLOCKED），@dnd-kit 拖拽 |
| `TaskList` | `{ tasks, onEdit?, onDelete?, onStatusChange? }` | 表格视图，可排序，空状态/无结果状态 |
| `TaskForm` | `{ open, onSubmit, editTask?, projects?, defaultProjectId? }` | 任务表单弹窗 |
| `TaskDetailSheet` | `{ task, open, onClose, onEdit?, onDelete?, onStatusChange? }` | 右侧详情抽屉 |

### 10.4 客户组件

| 组件 | 说明 |
|------|------|
| `CustomerForm` | 客户表单弹窗（名称/状态/行业/公司/联系方式/备注） |
| `CustomerList` | 客户卡片列表（头像/状态/项目展开/沟通信息/备注），含加载/空/错误态 |

### 10.5 目标/排期/定时任务/工作组件

| 组件 | 说明 |
|------|------|
| `GoalForm` | 目标表单弹窗（标题/类型/指标/进度模式/关联项目客户） |
| `GoalProgress` | 进度条组件（当前/目标/百分比） |
| `GoalFilter` | 状态 + 类型分段筛选按钮组 |
| `MilestoneList` | 里程碑列表（切换/添加/删除） |
| `ProgressLogList` | 进度日记列表（添加/删除） |
| `ScheduleStats` | 排期统计卡（任务数/工时/延期/冲突）+ 工作量柱状图 |
| `GanttChart` | 甘特图（日/周缩放，优先级色条，延期/冲突指示） |
| `InsertionDialog` | 插单模拟弹窗（对比前后变化） |
| `CronJobCard` | 定时任务卡片（启用/编辑/删除/手动触发） |
| `CronJobForm` | 定时任务表单（cron 预设快捷方式） |
| `WorkTools` | 浮动工具栏：计时器面板 + 待办面板 |

---

## 十一、前端通用 UI 组件

| 组件 | 说明 |
|------|------|
| `StatusBadge` | 状态标签（TODO/IN_PROGRESS/DONE/BLOCKED），含图标和颜色 |
| `PriorityBadge` | 优先级标签（URGENT/HIGH/MEDIUM/LOW），含彩色圆点 |
| `DataTable` | *(TODO)* — shadcn Table + TanStack Table |
| `FormDialog` | *(TODO)* — 通用表单弹窗 |
| 标准 shadcn/ui | button, card, table, input, label, badge, select, tabs, sonner, dropdown-menu, separator, avatar, textarea, dialog, sheet, tooltip（19 个） |

---

## 十二、前端页面

| 页面 | 路由 | 数据来源 | 核心组件 |
|------|------|----------|----------|
| 登录 | `/auth-pages/login` | `useAuth().login()` | react-hook-form + zod 校验 |
| 注册 | `/auth-pages/register` | `useAuth().register()` | react-hook-form + zod 校验 |
| 仪表盘 | `/main/dashboard` | `GET /dashboard/summary, /recent-activity, /project-stats` | 统计卡片/项目概览/活动列表/柱状图 |
| 项目 | `/main/projects` | `useProjectList + useProjectTasks` | ProjectCard + SubtaskList + ProjectForm |
| 项目详情 | `/main/projects/[id]` | `useProject + useProjectTasks` | 项目信息卡 + 任务列表 + 排期入口 |
| 任务 | `/main/tasks` | `useTaskList + useProjectList` | TaskBoard/TaskList 切换 + TaskForm + TaskDetailSheet |
| 客户 | `/main/customers` | `useCustomerList` | CustomerList + 统计卡片 |
| AI 工作台 | `/main/ai` | `useCronJobs` | 定时任务管理 |
| 设置 | `/main/settings` | 多类别设置获取 | AI配置/搜索/集成/安全/数据管理 5 Tab |
| 个人资料 | `/main/profile` | `GET /profile + useAuth` | 头像/个人信息/密码修改，自动保存 |
| 偏好 | `/main/preferences` | `GET /preferences` | 通用/显示/通知/问候语 4 Tab |
| 研究搜索 | `/main/research/search` | *(TODO)* | — |
| 研究收藏 | `/main/research/saved` | *(TODO)* | — |
| 报告 | `/main/reports` | `GET /reports/*` + AI 流式洞察 | 财务概览/排行/成本结构/时间分析 + AI 经营洞察 |
| 排期 | `/main/schedule` | `useProjectList + 批量任务请求` | 甘特图 + 统计 + 延期/冲突 |

---

## 十三、前端工具库 (Lib)

| 文件 | 说明 |
|------|------|
| `api.ts` | API 封装：`ApiError` 类、`safeParseJSON`（诊断非 JSON 响应）、`request<T>()`（fetch + 401 跳转）、导出的 `api` 对象（get/post/put/patch/delete） |
| `auth.ts` | *(TODO)* — useAuth 已有类似逻辑 |
| `utils.ts` | `cn()` 类名合并（clsx + tailwind-merge） |

---

## 十四、前端布局与提供者

| 组件 | 说明 |
|------|------|
| `AppLayout` | 主布局：侧边栏(272px) + 顶部 + 内容区 + AI 面板抽屉 |
| `Sidebar` | 固定左侧：Logo / 导航分组(可折叠) / 活跃路由高亮 / AI 入口(Cmd+J) |
| `QueryProvider` | React Query 提供者（staleTime: 30s, retry: 1） |
| `ThemeProvider` | 主题提供者（light/dark/system），持久化 localStorage |

---

## 附录：数据安全要点

- **密码**: bcryptjs salt rounds 10 哈希存储
- **JWT**: 含 exp 过期时间，剩余不足 1 天自动无感续期
- **Session**: 只存 Token SHA-256 哈希，数据库泄露无法伪造
- **加密**: AES-256-GCM 加密存储 API Key（含认证标签防篡改），兼容旧 CBC 格式
- **数据隔离**: 所有查询强制 `ownerId` 过滤，成本/项目操作含归属权守卫
- **限频**: 登录 5次/分钟，普通接口 60次/分钟
- **Cookie**: httpOnly + sameSite:lax + secure(生产环境)
