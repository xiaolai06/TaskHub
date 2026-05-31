# TaskFlow+ 模块并行开发方案

> 本文档说明如何同时开发多个模块而不产生文件冲突。

---

## 当前状态

| 状态 | 模块 | 文件 |
|------|------|------|
| ✅ 已完成 | 认证 (auth) | routes + service + validator |
| ✅ 已完成 | 仪表盘 (dashboard) | routes + service |
| ✅ 已完成 | 主界面布局 | Sidebar + Header + AppLayout |
| ✅ 已完成 | 登录/注册页 | login/register page.tsx |
| ✅ 已完成 | AI 对话面板 (MVP) | AiPanel.tsx |
| ❌ 待开发 | 其余 14 个模块 | 全部为 TODO 骨架 |

**已完工的基础设施**：Prisma Schema (16 表)、JWT 工具、密码哈希、统一响应、错误处理、Zod 校验中间件、CORS/Cookie、API 客户端封装。

---

## 数据依赖分析

从 Prisma Schema 提取外键关系：

```
User (已完成)
 ├── Session        ← 无需单独开发
 ├── Project        ← 依赖 User (ownerId)，✅ User 已完成
 ├── Task           ← 依赖 Project + User，⚠️ 依赖 Project
 ├── CostRecord     ← 依赖 Project + Task?，⚠️ 依赖 Project
 ├── Customer       ← 依赖 User，✅ User 已完成
 ├── Goal           ← 依赖 User，✅ User 已完成
 ├── TimeEntry      ← 依赖 User + Task? + Project?，⚠️ 依赖 Project
 ├── Communication  ← 依赖 User + Customer? + Project?，⚠️ 依赖 Customer/Project
 ├── AiInsight      ← 依赖 User，✅ User 已完成
 ├── Notification   ← 依赖 User，✅ User 已完成
 ├── SearchResult   ← 依赖 User，✅ User 已完成
 ├── SavedResearch  ← 依赖 User + SearchResult?，✅ User 已完成
 ├── Conversation   ← 依赖 User，✅ User 已完成
 ├── UserMemory     ← 依赖 User，✅ User 已完成
 └── Setting        ← 依赖 User (默认 "system")，✅ User 已完成
```

**关键结论**：Prisma 的 FK 是数据库层级的约束，不阻止你写代码。唯一真正需要先完成的是 **Project**（因为 Task、CostRecord 都引用它）。其他所有模块只需要 User 表，而 User + Auth 已经完工。

---

## 前置工作（已完成）

以下准备工作已经就绪，`routes/index.ts` 中所有 14 个模块的 import + router.use 已全部预注册，后续开发各模块时**无需再修改此文件**。

| 模块 | 路由前缀 | auth 中间件 | 代码文件 | 状态 |
|------|----------|------------|----------|------|
| auth | `/api/auth/*` | ❌ 公开 | routes/auth + services/auth + validators/auth | ✅ |
| webhooks | `/api/webhooks/*` | ❌ 公开 | routes/webhook | ❌ |
| projects | `/api/projects/*` | ✅ 需要 | routes/project + services/project + validators/project | ❌ |
| tasks | `/api/tasks/*` | ✅ 需要 | routes/task + services/task + validators/task | ❌ |
| costs | `/api/costs/*` | ✅ 需要 | routes/cost + services/cost + validators/cost | ❌ |
| customers | `/api/customers/*` | ✅ 需要 | routes/customer + services/customer + validators/customer | ❌ |
| goals | `/api/goals/*` | ✅ 需要 | routes/goal + services/goal | ❌ |
| scheduler | `/api/scheduler/*` | ✅ 需要 | routes/scheduler + services/scheduler + validators/scheduler | ❌ |
| dashboard | `/api/dashboard/*` | ✅ 需要 | routes/dashboard + services/dashboard | ✅ |
| reports | `/api/reports/*` | ✅ 需要 | routes/report + services/report | ❌ |
| search | `/api/search/*` | ✅ 需要 | routes/search + services/search | ❌ |
| research | `/api/research/*` | ✅ 需要 | routes/research + services/research | ❌ |
| llm | `/api/llm/*` | ✅ 需要 | routes/llm + services/ai | ❌ |
| notifications | `/api/notifications/*` | ✅ 需要 | routes/notification + services/notification | ❌ |
| settings | `/api/settings/*` | ✅ 需要 | routes/setting + services/setting + validators/setting | ❌ |

---

## 三轨道并行开发方案

### 🟢 轨道 A：项目管理 → 成本 → 报表
**依赖链**：Project → CostRecord → Reports

| 步骤 | 模块 | 工作量 |
|------|------|--------|
| A1 | projects (CRUD) | 路由 + service + validator + 前端 |
| A2 | costs (CRUD) | 路由 + service + validator + 前端 |
| A3 | reports (聚合查询) | 路由 + service + 前端 |

### 🟡 轨道 B：任务管理 → 客户 → 目标
**依赖链**：Task（依赖 Project，但可先写完等 Project 接上）→ Customer / Goal

| 步骤 | 模块 | 工作量 |
|------|------|--------|
| B1 | tasks (CRUD + 看板) | 路由 + service + validator + 前端 |
| B2 | customers (CRUD) | 路由 + service + validator + 前端 |
| B3 | goals (CRUD) | 路由 + service + validator + 前端 |

> ⚠️ Task 的 CRUD 代码可以独立写，只是测试时需要先有一个 Project。建议 B1 和 A1 并行开发代码，A1 先部署后再联调 B1。

### 🔵 轨道 C：设置 → 通知 → 搜索/研究 → 排期/AI
**依赖链**：完全独立，不依赖 A/B 轨道

| 步骤 | 模块 | 工作量 |
|------|------|--------|
| C1 | settings (CRUD) | 路由 + service + validator + 前端 |
| C2 | notifications (CRUD) | 路由 + service + 前端 |
| C3 | search + research | 路由 + service + 前端 |
| C4 | scheduler (排期引擎) | 路由 + service + 前端 |
| C5 | llm (AI 对话) | 路由 + service + AI 面板升级 |
| C6 | webhooks (n8n 回调) | 路由 + service |

---

## 文件冲突分析

每个模块对应的文件列表——**没有共享文件**：

```
模块 projects:
  backend/src/validators/project.schema.ts    (独立)
  backend/src/services/project.service.ts     (独立)
  backend/src/routes/project.routes.ts        (独立)
  frontend/src/hooks/useProjects.ts          (独立)
  frontend/src/app/main/projects/**          (独立)

模块 tasks:
  backend/src/validators/task.schema.ts      (独立)
  backend/src/services/task.service.ts       (独立)
  backend/src/routes/task.routes.ts          (独立)
  frontend/src/hooks/useTasks.ts             (独立)
  frontend/src/app/main/projects/detail/     (独立)

模块 customers:
  backend/src/validators/customer.schema.ts   (独立)
  backend/src/services/customer.service.ts    (独立)
  backend/src/routes/customer.routes.ts       (独立)
  frontend/src/hooks/useCustomers.ts          (独立)
  frontend/src/app/main/customers/**          (独立)

模块 settings:
  backend/src/validators/setting.schema.ts   (独立)
  backend/src/services/setting.service.ts    (独立)
  backend/src/routes/setting.routes.ts       (独立)
  frontend/src/app/main/settings/**           (独立)

... 其余模块同理
```

> **唯一共享文件 `routes/index.ts` 已预注册完毕，后续无需修改。**

---

## 推荐开发顺序

```
Day 1-2  ┃ 轨道A: projects       ┃ 轨道B: tasks          ┃ 轨道C: settings + customers
Day 2-3  ┃ 轨道A: costs          ┃ 轨道B: customers      ┃ 轨道C: goals + search
Day 3-4  ┃ 轨道A: reports        ┃ 轨道B: goals          ┃ 轨道C: research + notifications
Day 4-5  ┃ 联调 A+B              ┃ 联调 A+B              ┃ 轨道C: scheduler + llm
Day 5    ┃ 三方合流              ┃                       ┃ webhooks 收尾
```

### 每个模块标准开发步骤（7 步）

```
1. validators/xxx.schema.ts  ← Zod 校验 Schema
2. services/xxx.service.ts   ← Prisma CRUD 业务逻辑
3. routes/xxx.routes.ts      ← 路由定义 + 挂载 validate 中间件
4. curl 测试每个接口
5. hooks/useXxx.ts           ← React Query hooks
6. components/features/xxx/  ← 业务组件（Form/List/Card）
7. app/main/xxx/page.tsx     ← 页面组装 + 三种状态（loading/empty/error）
```

---

## 验证方式

```bash
# 启动后端（tsx watch 自动热更新）
cd backend && npm run dev

# 测试 API
curl http://localhost:3001/api/projects
curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  -H "Cookie: token=xxx" \
  -d '{"name":"测试项目","startDate":"2026-06-01"}'

# 启动前端
cd frontend && npm run dev
# 浏览器访问 http://localhost:3000/main/xxx
```

---

## 预注册状态

`routes/index.ts` 中已批量注册的模块：

```typescript
// ✅ 已完成预注册（import + router.use 均已添加）
import authRoutes from './auth.routes';
import projectRoutes from './project.routes';
import taskRoutes from './task.routes';
import costRoutes from './cost.routes';
import customerRoutes from './customer.routes';
import goalRoutes from './goal.routes';
import schedulerRoutes from './scheduler.routes';
import dashboardRoutes from './dashboard.routes';
import reportRoutes from './report.routes';
import searchRoutes from './search.routes';
import researchRoutes from './research.routes';
import llmRoutes from './llm.routes';
import notificationRoutes from './notification.routes';
import settingRoutes from './setting.routes';
import webhookRoutes from './webhook.routes';
```
