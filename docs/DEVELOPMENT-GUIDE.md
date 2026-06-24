# TaskFlow+ 开发流程技术说明文档

> 以 TaskFlow+ 为实例，逐项说明前后端开发的关键考虑点及实际满足情况
> 文档版本：2026-06-24

---

## 目录

1. [后端开发关键考虑点](#1-后端开发关键考虑点)
2. [前端开发关键考虑点](#2-前端开发关键考虑点)
3. [前后端协作关键考虑点](#3-前后端协作关键考虑点)
4. [综合评分汇总](#4-综合评分汇总)
5. [改进建议清单（按优先级）](#5-改进建议清单按优先级)

---

## 1. 后端开发关键考虑点

### 1.1 错误处理

**要求**：
- 所有异常不能静默吞掉，必须向上传播或返回错误响应
- 有统一的错误类体系，区分业务错误和系统错误
- 全局错误处理中间件兜底
- 错误响应不能泄露内部实现细节

**TaskFlow+ 实际情况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| 异常不静默 | ✅ PASS | 所有 route 文件均有 `try { ... } catch(err) { next(err) }`，service 层主动抛出异常 |
| 统一错误类体系 | ✅ PASS | `AppError` 基类 + `NotFoundError`/`UnauthorizedError`/`ForbiddenError`/`ValidationError`/`ConflictError` 5 个子类，每个携带 `statusCode` + `code` |
| 全局错误兜底 | ✅ PASS | `errorHandler.ts` 处理 AppError、Prisma P2002(冲突)/P2025(未找到)、JWT 过期错误，未知错误返回通用 500 |
| 不泄露内部细节 | ✅ PASS | 生产环境下未知错误仅返回 `{ success: false, error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' } }` |

---

### 1.2 输入校验

**要求**：
- 所有用户输入必须校验，不信任前端传参
- 使用 Schema-based 校验库（推荐 Zod）
- 校验失败返回字段级别的错误信息
- 校验在路由层/中间件层完成，不侵入业务逻辑

**TaskFlow+ 实际情况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| Schema 校验 | ✅ PASS | 所有模块均使用 Zod 定义 `createXxxSchema`/`updateXxxSchema`/`xxxQuerySchema`，校验类型包括 `.string()`/`.number()`/`.enum()`/`.int()`/`.optional()` |
| 中间件拦截 | ✅ PASS | `validate(schema, part)` 中间件支持 `body`/`query`/`params` 三种校验位置，`ZodError` 返回 `field`+`message` 级别的错误列表 |
| 中文错误提示 | ✅ PASS | 所有校验 Schema 均使用中文自定义错误消息（如 `'任务标题不能为空'`、`'日期格式不正确'`） |
| 校验不侵入业务 | ✅ PASS | validate 中间件在路由定义时挂载，handler 代码无需手动调用校验 |

---

### 1.3 认证与授权

**要求**：
- JWT 认证，Token 不存 localStorage（防 XSS）
- 算法固定（防算法混淆攻击）
- Token 过期检测与静默续期
- Cookie 安全属性（httpOnly/secure/sameSite）
- 请求上下文传递 userId

**TaskFlow+ 实际情况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| Cookie 存储 JWT | ✅ PASS | httpOnly Cookie，7 天有效期，JS 无法读取 |
| 算法固定 | ✅ PASS | `verifyToken()` 强制 `algorithms: ['HS256']`，防止 alg=none 攻击 |
| 静默续期 | ✅ PASS | JWT 剩余 TTL < 24h 时自动签发新 Token，用户无感 |
| Cookie 安全属性 | ✅ PASS | `httpOnly: true`，`secure` 和 `sameSite` 通过环境变量配置 |
| userId 传递 | ✅ PASS | `req.userId` 和 `req.user` 挂载到请求对象，下游 service 直接使用 |

---

### 1.4 限流防护

**要求**：
- 登录、注册等敏感接口限流更严格
- 普通 API 接口有基本限流
- 限流实现需考虑内存管理和进程退出

**TaskFlow+ 实际情况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| 分级限流 | ✅ PASS | loginLimit: 5次/分、registerLimit: 3次/分、apiLimit: 60次/分 |
| 内存管理 | ✅ PASS | 内存 Map 上限 10000 键，满时淘汰最老 25%；每 10 分钟清理过期记录；cleanup timer 使用 `.unref()` 不阻塞进程退出 |
| 开发环境可关闭 | ✅ PASS | `config.limitEnabled` 开关，开发时可禁用 |

---

### 1.5 数据库安全

**要求**：
- 不存在 SQL 注入风险
- ORM 参数化查询，禁止拼接 SQL
- 唯一允许的 raw SQL 仅限静态语句

**TaskFlow+ 实际情况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| 参数化查询 | ✅ PASS | 所有用户查询均通过 Prisma Client API（`findMany`/`create`/`update`/`delete`/`aggregate`），`where` 使用 Prisma 类型化运算符 |
| 无拼接 SQL | ✅ PASS | 仅 2 处使用 `raw`：`server.ts` 中 SQLite PRAGMA 配置（静态字符串）、`index.ts` 中健康检查 `SELECT 1`（静态字符串），均无用户输入 |

---

### 1.6 敏感数据保护

**要求**：
- 密码使用 bcrypt 哈希（salt ≥ 8）
- 敏感配置加密存储（AES）
- 必填环境变量启动时校验
- API Key、密码等不日志输出

**TaskFlow+ 实际情况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| bcrypt 哈希 | ✅ PASS | bcryptjs，salt rounds = 10，行业标准 |
| 配置加密 | ✅ PASS | AES-256-GCM（随机 IV + auth tag），`encryption.service.ts` 实现，向后兼容旧 CBC 格式 |
| 环境变量校验 | ✅ PASS | `config.ts` 中 `requireEnv()` 对必填变量（`JWT_SECRET`/`ENCRYPTION_KEY`/`DATABASE_URL`）缺失时 `process.exit(1)` |
| 不日志敏感信息 | ✅ PASS | 无 API Key 或密码出现在日志输出中；`req.userId` 仅挂载 userId，不挂载密码等敏感字段 |

---

### 1.7 响应格式

**要求**：
- 所有 API 使用统一的响应信封格式
- 成功与错误响应结构可预测
- 前端可据此做统一的错误处理

**TaskFlow+ 实际情况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| 统一信封 | ✅ PASS | `response.ts` 提供 `success(res, data)` 和 `error(res, code, message, status, details?)` |
| 格式 | ✅ PASS | 成功：`{ success: true, data: T }`；错误：`{ success: false, error: { code, message, details? } }` |
| 全局一致 | ✅ PASS | 所有 25 个路由组均使用该格式，无例外 |

---

### 1.8 代码规范与 TypeScript

**要求**：
- TypeScript strict 模式
- 不使用 `any` 类型
- 文件不超过 400 行
- 函数不超过 50 行

**TaskFlow+ 实际情况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| strict 模式 | ✅ PASS | `tsconfig.json` 中 `"strict": true` |
| 不使用 any | ⚠️ PARTIAL | 全后端共 13 处 `any`，分布在 AI 工具集成层（解析第三方 API 响应，`npm-search.ts`/`product-hunt.ts`/`daily-hot.ts`/`search-web.ts`）和 `validate.ts` 中间件；核心业务 service（`task.service.ts`/`customer.service.ts`/`goal.service.ts`）完全无 `any` |
| 文件 ≤ 400 行 | ⚠️ PARTIAL | 9 个文件超标：`goal.service.ts`（780 行）、`scheduler.service.ts`（691 行）、`report.service.ts`（647 行）、`llm.routes.ts`（623 行）、`research.service.ts`（616 行）、`setting.service.ts`（500 行）、`ai.service.ts`（425 行）、`notification.service.ts`（403 行）、`search-web.ts`（401 行） |

---

### 1.9 数据库设计

**要求**：
- 有合理的索引覆盖高频查询
- 外键关系明确，有级联策略
- 金额字段不使用浮点数
- 表结构有唯一约束防止重复数据

**TaskFlow+ 实际情况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| 索引覆盖 | ✅ PASS | 35+ 个 `@@index`，高频组合索引如 `Project(ownerId, status)`、`Task(projectId, status)` |
| 外键级联 | ✅ PASS | 所有外键有 `@relation`，级联策略区分：拥有关系用 `Cascade`（User→Profile），可选引用用 `SetNull`（Task→Assignee） |
| 金额整数 | ✅ PASS | 金额字段统一用 `Int`（分），`schema.prisma` 注释标注"单位：分"，前端 ÷100 显示 |
| 唯一约束 | ✅ PASS | `UserMemory(userId, key)`、`GoalCheckin(goalId, date)`、`Setting(userId, category, key)` 等均有 `@@unique` |

---

### 1.10 优雅关闭

**要求**：
- 响应 SIGTERM/SIGINT 信号
- 按序释放资源：停任务 → 关 HTTP → 断数据库
- 超时强制退出保护
- 异常处理防止未捕获异常导致崩溃

**TaskFlow+ 实况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| 信号处理 | ✅ PASS | 监听 SIGTERM 和 SIGINT |
| 释放顺序 | ✅ PASS | 停止 Cron → 关 HTTP Server → 断开 Prisma → process.exit(0) |
| 超时保护 | ✅ PASS | 10 秒强制退出，防止关闭流程挂起 |
| 异常处理 | ✅ PASS | `unhandledRejection` 记录日志但不退出（适配 PM2）；`uncaughtException` 记录后 `process.exit(1)` |

---

### 1.11 日志系统

**要求**：
- 生产环境有结构化日志（JSON 格式）
- 有请求级别的追踪 ID
- 日志级别区分（debug/info/warn/error）

**TaskFlow+ 实况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| 结构化日志 | ❌ FAIL | 全部使用 `console.log`/`console.error`/`console.warn`，无 pino/winston 等结构化日志库 |
| 请求追踪 | ❌ FAIL | 无 request-id 中间件，无法追踪跨层调用链 |
| 日志级别 | ❌ FAIL | 无日志级别控制，依赖 `config.nodeEnv !== 'production'` 手动过滤 |
| 任务日志 | ✅ 部分 | `job-logger.ts` 将 Cron 任务执行结果写入 `JobExecutionLog` 表，这是唯一有持久化日志的模块 |

---

### 1.12 数据库 Schema 设计要点

**考虑点**：

| 考虑项 | 实际情况 | 说明 |
|--------|----------|------|
| SQLite 并发 | WAL 模式 + busy_timeout=5000ms | SQLite 写入锁超时等待 5 秒，WAL 模式允许读写并发 |
| 金额精度 | `Int` 字段（单位：分） | 避免浮点数精度问题，`100.50元 = 10050` |
| 子任务层级 | Task `parentId` 自关联 | 支持任意深度子任务树 |
| 软删除 | 未使用 | 采用硬删除 + 级联删除，设计简洁 |
| 多对多关系 | 通过中间表实现 | 无 Prisma `@manyToMany`，全部显式关系定义 |

---

## 2. 前端开发关键考虑点

### 2.1 状态管理

**要求**：
- 客户端状态（UI 状态）和服务器状态分离
- 服务器状态用 React Query / SWR
- 客户端状态用 Zustand / Jotai
- 状态管理库职责清晰，不混合使用

**TaskFlow+ 实际情况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| 职责分离 | ✅ PASS | Zustand **仅**用于 `useAuth`（用户认证状态）；所有服务器数据（projects/tasks/customers/goals/finance 等）均通过 React Query 的 `useQuery`/`useMutation` 管理 |
| 缓存失效 | ✅ PASS | 所有 mutation 的 `onSuccess` 中调用 `qc.invalidateQueries` 触发相关查询刷新 |
| 全局配置 | ⚠️ PARTIAL | 全局 `staleTime: 30s`、`retry: 1`，但大部分高频查询（任务列表、项目列表）没有配置 per-query `staleTime`，快速切换页面时可能触发不必要的 refetch |

---

### 2.2 错误处理

**要求**：
- API 请求失败有用户友好的错误提示
- 401 自动跳转登录页（带防抖）
- 页面级别有错误边界和重试机制
- 非 JSON 响应不导致崩溃

**TaskFlow+ 实际情况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| 友好错误提示 | ✅ PASS | `ApiError` 类 + `ERROR_MESSAGES` 中文映射（如 `VALIDATION_ERROR → '参数校验失败'`），`getFriendlyMessage()` 供 UI 使用 |
| 401 自动跳转 | ✅ PASS | 401 时自动跳转 `/auth-pages/login`，5 秒冷却期防止跳转循环（`isRedirecting` 标志） |
| 页面错误边界 | ✅ PASS | `app/error.tsx` 全局错误边界 + `main/error.tsx` 主应用错误边界，均有重试按钮 |
| 非 JSON 响应处理 | ✅ PASS | `safeParseJSON()` 检测响应 Content-Type，HTML 响应给出"后端未启动"的诊断提示 |

---

### 2.3 加载与空状态

**要求**：
- 数据请求时展示加载态（骨架屏或 Spinner）
- 列表为空时展示友好空状态（图标 + 文字 + 操作按钮）
- 不能出现空白无反馈的页面

**TaskFlow+ 实际情况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| 加载态 | ⚠️ PARTIAL | Dashboard 有完整骨架屏（`DashboardSkeleton` + `StatCardSkeleton` + `ListSkeleton`），其他页面（Projects/Tasks/Customers）仅使用 `Loader2` Spinner |
| 空状态 | ✅ PASS | 所有列表页面均有空状态：图标 + 提示文字（如"暂无项目"）+ 操作按钮（如"创建第一个项目"）；筛选无结果时有"清除筛选"按钮 |
| 无空白页面 | ✅ PASS | 所有页面均处理了 loading/error/empty 三态 |

---

### 2.4 表单校验

**要求**：
- 使用 react-hook-form + Zod 统一校验
- 校验失败显示字段级错误信息
- 不能仅靠禁用按钮提示用户

**TaskFlow+ 实际情况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| 认证表单 | ✅ PASS | 登录/注册/忘记密码/重置密码均使用 `react-hook-form` + Zod，有 `aria-invalid` 属性和红色错误提示 |
| 业务表单 | ❌ FAIL | `TaskForm.tsx`/`ProjectForm.tsx`/`CostForm.tsx` 使用 `useState` + 手动 `if (!value) return` 静默验证，无错误信息展示，用户无法知道为何无法提交 |

---

### 2.5 TypeScript 类型安全

**要求**：
- strict 模式
- 禁止 `any`
- Hook 和组件有完整的类型定义

**TaskFlow+ 实际情况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| strict 模式 | ✅ PASS | tsconfig 开启 `strict: true` |
| 禁止 any | ✅ PASS | 全前端 **零** `: any` 使用，这是非常好的实践 |
| 类型定义 | ✅ PASS | 所有 hook 导出完整接口：`Task`/`Project`/`Customer`/`CreateTaskInput`/`TaskQueryParams` 等；`api.ts` 使用泛型 `ApiResponse<T>` |

---

### 2.6 文件大小与组件拆分

**要求**：
- 单文件不超过 400 行
- 大文件需拆分为子组件

**TaskFlow+ 实际情况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| 文件 ≤ 400 行 | ❌ FAIL | 10 个文件超标，最严重的 `settings/page.tsx` 达 **1,583 行**（含 8 个 Tab），`ProjectTaskSheet.tsx` 829 行，`GanttChart.tsx` 720 行 |

超 400 行文件清单：

| 文件 | 行数 | 建议拆分方向 |
|------|------|-------------|
| `settings/page.tsx` | 1,583 | 每个 Tab 拆为独立组件（AiConfigTab、EmailTab、PushTab 等） |
| `ProjectTaskSheet.tsx` | 829 | 任务列表、成本表单、任务表单分别拆出 |
| `GanttChart.tsx` | 720 | 甘特图主体、工具栏、Tooltip 拆分 |
| `Header.tsx` | 675 | 通知、任务跟踪、主题切换分别拆分 |
| `tasks/page.tsx` | 631 | Board/List/Gantt 三种视图拆为独立组件 |

---

### 2.7 性能优化

**要求**：
- 列表项使用 `React.memo` 防止不必要渲染
- 复杂计算使用 `useMemo`
- 回调函数使用 `useCallback`
- 重量级组件使用动态导入（Code Splitting）

**TaskFlow+ 实际情况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| useCallback | ✅ PASS | `useAiChat.ts`（10+）、`AiPanel.tsx`（15+）等复杂 hook 大量使用 |
| useMemo | ✅ PASS | `GanttChart`（3处）、`customers/page.tsx`、`DonutChart` 等合理使用 |
| React.memo | ⚠️ PARTIAL | 仅 `AiPanel.tsx` 使用了 `memo`，列表组件（`ProjectCard`/`TaskCard`）未使用 |
| Code Splitting | ❌ FAIL | 全项目零 `next/dynamic`/`React.lazy`，GanttChart（720行）等重量级组件静态导入 |

---

### 2.8 无障碍访问

**要求**：
- 表单 input 有对应的 label（htmlFor/id 关联）
- 图标按钮有 aria-label
- 语义化 HTML（main/nav/section）

**TaskFlow+ 实际情况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| label 关联 | ⚠️ PARTIAL | 认证页面有完整 htmlFor/id 关联；业务表单仅有 `<label>` 无 htmlFor，`CostForm` 无 label 仅 placeholder |
| aria-label | ⚠️ PARTIAL | 密码切换按钮有 `aria-label="显示密码"`；部分图标按钮缺失 |
| 语义 HTML | ⚠️ PARTIAL | 页面主体使用 `<div>`，缺少 `<main>`/`<section>`/`<article>` 地标元素 |

---

### 2.9 响应式设计

**要求**：
- 适配 768px 和 1024px 断点
- 移动端有侧边栏隐藏/汉堡菜单

**TaskFlow+ 实际情况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| 断点适配 | ✅ PASS | Projects `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`、Dashboard `grid-cols-2 xl:grid-cols-6`、Customers `grid-cols-2 sm:grid-cols-4` |
| 移动端布局 | ⚠️ PARTIAL | 侧边栏支持折叠（210px ↔ 66px），移动端汉堡菜单在 `AppLayout.tsx` 中实现，但部分页面筛选栏在窄屏可能溢出 |

---

### 2.10 主题系统

**要求**：
- 支持亮/暗/跟随系统三种模式
- 主题切换持久化
- 暗色模式所有组件覆盖完整

**TaskFlow+ 实况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| 三种模式 | ✅ PASS | `ThemeProvider` 支持 `light`/`dark`/`system` |
| 持久化 | ✅ PASS | 偏好存入 `localStorage`，监听 `prefers-color-scheme` 媒体查询 |
| Token 覆盖 | ✅ PASS | `globals.css` 中 `.dark` 覆盖全部设计令牌（背景/前景/卡片/边框/图表/侧边栏等），组件使用 `dark:` 前缀类 |

---

### 2.11 乐观更新

**要求**：
- 高频交互（如拖拽排序）使用乐观更新提升体验
- 更新失败时回滚到快照状态

**TaskFlow+ 实况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| 乐观更新 | ✅ PASS | `useUpdateTaskStatus`（看板拖拽）实现完整的乐观更新：`onMutate` 取消请求 → 快照 → 乐观更新 → `onError` 回滚 → `onSettled` invalidate |

---

### 2.12 API 客户端设计

**要求**：
- 统一的请求封装
- AbortSignal 支持（组件卸载时取消请求）
- 401 自动重定向
- 非 JSON 响应容错

**TaskFlow+ 实况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| 统一封装 | ✅ PASS | `api.ts` 导出 `api.get/post/put/patch/delete`，类型化泛型 `<T>` |
| AbortSignal | ✅ PASS | 所有方法支持 `signal` 参数，AbortError 透传给调用方 |
| 401 重定向 | ✅ PASS | 401 自动跳转登录页，5s 冷却防循环 |
| 容错处理 | ✅ PASS | `safeParseJSON()` 处理 HTML/非 JSON/畸形 JSON 响应 |
| 重试逻辑 | ✅ PASS | React Query 层配置 `retry: 1`，API 客户端不重复实现（关注点分离正确） |

---

### 2.13 安全考虑

**要求**：
- 防 XSS（不使用 dangerouslySetInnerHTML）
- Token 不暴露给 JS

**TaskFlow+ 实况**：

| 要求 | 满足情况 | 说明 |
|------|----------|------|
| Token 安全 | ✅ PASS | JWT 存 httpOnly Cookie，`api.ts` 使用 `credentials: 'include'` 自动携带 |
| XSS 风险 | ⚠️ PARTIAL | 3 处使用 `dangerouslySetInnerHTML` 注入后端返回的 SVG 验证码；需确保后端对 SVG 输出做了消毒（`svg-captcha` 库本身生成的 SVG 不含 `<script>`，风险可控） |
| 空 catch 块 | ⚠️ 注意 | `WorkTools.tsx`/`preferences/page.tsx`/`settings/page.tsx` 共有 10+ 处 `catch {}` 空捕获，生产环境不利于排查安全事件 |

---

## 3. 前后端协作关键考虑点

### 3.1 前后端分离与通信

**TaskFlow+ 架构**：

```
前端 Next.js (port 3002)
  │
  ├─ 开发环境：next.config.ts rewrites /api/* → http://localhost:3001/api/*
  ├─ 生产环境：Nginx 反向代理
  │
  └─ 通信协议：HTTP JSON + httpOnly Cookie
```

| 考虑点 | 满足情况 | 说明 |
|--------|----------|------|
| 代理配置 | ✅ | 开发环境 Next.js rewrites，生产环境 Nginx |
| CORS 配置 | ✅ | 动态 origin 校验，`credentials: true` |
| API 基地址 | ✅ | `NEXT_PUBLIC_API_URL` 环境变量，默认 `/api` |
| 响应格式约定 | ✅ | 前后端共享 `{ success, data/error }` 信封 |

### 3.2 开发环境搭建

**后端**：
```bash
cd backend
npm install
npx prisma db push      # 同步数据库 Schema
npx prisma generate     # 生成 Prisma Client
npx prisma db seed      # 填充测试数据
npm run dev             # 启动后端（port 3001，热重载）
```

**前端**：
```bash
cd frontend
npm install
npm run dev             # 启动前端（port 3002，自动代理到后端）
```

### 3.3 构建与部署

**后端**：
```bash
npm run build           # tsc 编译 + 拷贝 prompts/*.txt 到 dist/
npm start               # node dist/server.js
```

**前端**：
```bash
npm run build           # Next.js 生产构建
npm start               # Next.js 生产模式
```

### 3.4 环境变量一致性

前后端通过 `.env` 文件管理配置，`config.ts` 启动时校验必填项。关键一致性点：

| 变量 | 前端 | 后端 | 一致性 |
|------|------|------|--------|
| `NEXT_PUBLIC_API_URL` | 基地址 | - | ✅ |
| `FRONTEND_URL` | - | CORS 白名单 | ✅ |
| `JWT_SECRET` | - | 签名密钥 | ✅ |
| `DATABASE_URL` | - | SQLite 路径 | ✅ |

---

## 4. 综合评分汇总

### 后端（12 项）

| 序号 | 考虑点 | 评分 | 说明 |
|------|--------|------|------|
| 1 | 错误处理 | ✅ PASS | 完善的错误类体系 + 全局兜底 |
| 2 | 输入校验 | ✅ PASS | Zod + 中文消息 + 中间件拦截 |
| 3 | 认证授权 | ✅ PASS | 算法固定 + httpOnly Cookie + 静默续期 |
| 4 | 限流防护 | ✅ PASS | 分级限流 + 内存管理 |
| 5 | 数据库安全 | ✅ PASS | Prisma 参数化查询 |
| 6 | 敏感数据保护 | ✅ PASS | bcrypt 10 + AES-256-GCM |
| 7 | 响应格式 | ✅ PASS | 统一信封，全局一致 |
| 8 | TypeScript | ⚠️ PARTIAL | 13 处 any（AI 工具层） |
| 9 | 文件大小 | ⚠️ PARTIAL | 9 个文件超 400 行 |
| 10 | 数据库设计 | ✅ PASS | 35+ 索引 + 级联 + 金额整数 |
| 11 | 优雅关闭 | ✅ PASS | SIGTERM/SIGINT + 超时保护 |
| 12 | 日志系统 | ❌ FAIL | 无结构化日志库，仅 console.* |

**后端总评：8 PASS / 3 PARTIAL / 1 FAIL**

---

### 前端（14 项）

| 序号 | 考虑点 | 评分 | 说明 |
|------|--------|------|------|
| 1 | 状态管理 | ✅ PASS | Zustand(仅Auth) + React Query(服务器状态) |
| 2 | 错误处理 | ✅ PASS | ApiError 类 + 中文提示 + 错误边界 |
| 3 | 加载空状态 | ⚠️ PARTIAL | Dashboard 骨架屏，其他页 Spinner |
| 4 | 表单校验 | ⚠️ PARTIAL | 认证表单用 Zod，业务表单无校验反馈 |
| 5 | TypeScript | ✅ PASS | 零 any，强类型定义 |
| 6 | 文件大小 | ❌ FAIL | 10 个文件超标，settings 1583 行 |
| 7 | 性能优化 | ⚠️ PARTIAL | useCallback/useMemo 有，无 Code Splitting |
| 8 | 无障碍 | ⚠️ PARTIAL | 认证页好，业务表单和语义 HTML 不足 |
| 9 | 响应式 | ⚠️ PARTIAL | 桌面网格 OK，移动端部分溢出 |
| 10 | 主题系统 | ✅ PASS | 三模式 + 持久化 + 完整 Token 覆盖 |
| 11 | 乐观更新 | ✅ PASS | 看板拖拽完整实现 |
| 12 | API 客户端 | ✅ PASS | AbortSignal + 泛型 + 401 处理 |
| 13 | 安全 | ⚠️ PARTIAL | Cookie 认证好，dangerouslySetInnerHTML 需确认 |
| 14 | 空状态 | ✅ PASS | 所有列表页面完整 |

**前端总评：7 PASS / 6 PARTIAL / 1 FAIL**

---

## 5. 改进建议清单（按优先级）

### 🔴 高优先级（建议尽快修复）

| 优先级 | 模块 | 问题 | 影响范围 | 建议方案 |
|--------|------|------|----------|----------|
| P0 | 后端 | 无结构化日志 | 生产排障困难 | 引入 `pino` + `pino-http`，添加 request-id 中间件 |
| P0 | 前端 | 业务表单无校验反馈 | 用户体验差 | `TaskForm`/`ProjectForm`/`CostForm` 迁移到 react-hook-form + Zod |
| P1 | 后端 | `goal.service.ts` 780 行 | 可维护性差 | 拆分为 `goal.service.ts` + `goal-progress.service.ts` + `goal-milestone.service.ts` |
| P1 | 前端 | `settings/page.tsx` 1583 行 | 可维护性极差 | 8 个 Tab 各拆为独立组件文件 |

### 🟡 中优先级（建议近期优化）

| 优先级 | 模块 | 问题 | 建议方案 |
|--------|------|------|----------|
| P2 | 前端 | 零 Code Splitting | `GanttChart`/`AiPanel`/`settings` 用 `next/dynamic` 动态导入 |
| P2 | 前端 | 列表组件无 `React.memo` | `ProjectCard`/`TaskCard` 包裹 memo |
| P2 | 前端 | 仅 Dashboard 有骨架屏 | Projects/Tasks/Customers 补充 Skeleton |
| P2 | 后端 | 13 处 any（AI 工具层） | 为 SerpAPI/npm/ProductHunt 响应定义接口类型 |
| P2 | 后端 | 9 个文件超 400 行 | 逐步拆分 `scheduler.service.ts`、`report.service.ts`、`research.service.ts` |

### 🟢 低优先级（有余力时优化）

| 优先级 | 模块 | 问题 | 建议方案 |
|--------|------|------|----------|
| P3 | 前端 | 业务表单 label 无 htmlFor/id | 统一为 label+id 关联 |
| P3 | 前端 | 页面缺少语义 HTML | 添加 `<main>`/`<section>` 地标 |
| P3 | 前端 | React Query 缺 per-query staleTime | 高频查询（tasks/projects）配置更长 staleTime |
| P3 | 前端 | 部分页面空 catch 块 | 补充 console.error 或 toast 提示 |

---

### 评分总览

| 维度 | PASS | PARTIAL | FAIL |
|------|------|---------|------|
| 后端（12 项） | 8 | 3 | 1 |
| 前端（14 项） | 7 | 6 | 1 |
| **总计（26 项）** | **15** | **9** | **2** |

> **整体评价**：系统安全基础扎实（JWT/bcrypt/AES/Zod/Prisma 参数化查询/限流），核心业务逻辑完整。主要不足集中在代码组织（文件过大）和用户体验细节（业务表单校验、骨架屏、Code Splitting）。无 CRITICAL 级安全漏洞。
