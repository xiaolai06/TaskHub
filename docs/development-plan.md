# TaskFlow+ 开发分工文档

## 一、团队与技术栈

### 团队分工

| 成员 | 角色 | 负责方向 |
|------|------|----------|
| 开发者 A | 全栈 | 用户认证、项目管理、成本管理、仪表盘、报表 |
| 开发者 B | 全栈 | 任务管理、客户管理、页面布局与通用组件、设置 |
| 开发者 C | 全栈 | 排期引擎、AI 智能能力、业务研究、n8n 工作流 |

### 统一技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端框架 | Next.js 14+ (App Router) | 全员统一 |
| UI 库 | Tailwind CSS + shadcn/ui | 全员统一 |
| 数据请求 | React Query | 全员统一 |
| 状态管理 | Zustand | 全员统一 |
| 图表 | Recharts | 仪表盘/报表用 |
| 后端框架 | Express | 全员统一 |
| ORM | Prisma | 全员统一 |
| 数据库 | SQLite（本地）/ PostgreSQL（线上） | 全员统一 |
| 认证 | JWT + bcryptjs | A 负责，全员调用 |
| 校验 | Zod | 全员统一 |
| 测试 | Jest + Supertest | 全员统一 |

---

## 二、统一开发模块

以下模块由全员共同维护，不单独分配。

### 2.1 数据库（Schema）

**负责人**：开发者 A 主导，全员确认

**说明**：数据库 Schema 统一由 A 设计和维护，其他人通过 Prisma Client 调用，不直接改 Schema。

**表结构**

```prisma
// 用户
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String
  role      String   @default("USER")     // ADMIN | USER
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  sessions  Session[]
  projects  Project[]
  tasks     Task[]           @relation("TaskAssignee")
  customers Customer[]
  searchResults SearchResult[]
  savedResearch SavedResearch[]
}

// 会话
model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// 项目
model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  status      String   @default("ACTIVE")  // ACTIVE | ARCHIVED | COMPLETED
  startDate   DateTime
  endDate     DateTime?
  ownerId     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  owner       User     @relation(fields: [ownerId], references: [id])
  tasks       Task[]
  costRecords CostRecord[]
}

// 任务
model Task {
  id             String   @id @default(cuid())
  title          String
  description    String?
  status         String   @default("TODO")     // TODO | IN_PROGRESS | DONE | BLOCKED
  priority       String   @default("MEDIUM")   // LOW | MEDIUM | HIGH | URGENT
  estimatedHours Float
  actualHours    Float?
  startDate      DateTime?
  dueDate        DateTime?
  projectId      String
  assigneeId     String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  project        Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assignee       User?    @relation("TaskAssignee", fields: [assigneeId], references: [id])
  costRecords    CostRecord[]
}

// 成本记录
model CostRecord {
  id          String   @id @default(cuid())
  amount      Float
  category    String   // LABOR | MATERIAL | OVERHEAD | OTHER
  description String
  date        DateTime
  projectId   String
  taskId      String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  task        Task?    @relation(fields: [taskId], references: [id], onDelete: SetNull)
}

// 客户
model Customer {
  id        String   @id @default(cuid())
  name      String
  email     String?
  phone     String?
  company   String?
  address   String?
  notes     String?
  userId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id])
}

// 搜索结果
model SearchResult {
  id        String   @id @default(cuid())
  query     String
  source    String
  title     String
  content   String
  url       String?
  relevance Float
  saved     Boolean  @default(false)
  userId    String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
  savedResearch SavedResearch[]
}

// 已保存研究
model SavedResearch {
  id             String   @id @default(cuid())
  title          String
  summary        String
  content        String
  tags           String
  userId         String
  searchResultId String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  user           User          @relation(fields: [userId], references: [id])
  searchResult   SearchResult? @relation(fields: [searchResultId], references: [id], onDelete: SetNull)
}
```

**表关系**

```
User 1──* Project       (一个用户多个项目)
User 1──* Task          (一个用户多个任务)
User 1──* Session       (一个用户多个会话)
User 1──* Customer      (一个用户多个客户)
Project 1──* Task       (一个项目多个任务)
Project 1──* CostRecord (一个项目多条成本)
Task 1──* CostRecord    (一个任务多条成本)
SearchResult 1──* SavedResearch (一个搜索结果可被多次收藏)
```

**分工**
- A：设计 Schema、写迁移、写种子数据、维护 Prisma Client 配置
- B：使用 Prisma Client 查询数据，发现问题反馈给 A
- C：使用 Prisma Client 查询数据，发现问题反馈给 A

---

### 2.2 项目基础架构

**负责人**：开发者 A 搭建，全员使用

**说明**：项目骨架由 A 统一搭建，其他人在此基础上开发自己的模块。

**目录结构**

```
taskflow/
├── backend/
│   ├── src/
│   │   ├── app.ts                 # Express 应用入口
│   │   ├── server.ts              # 服务器启动
│   │   ├── config/                # 配置
│   │   ├── middleware/            # 中间件（auth、errorHandler、validate）
│   │   ├── routes/                # 路由
│   │   ├── controllers/           # 控制器
│   │   ├── services/              # 业务逻辑
│   │   ├── validators/            # 校验 Schema
│   │   ├── utils/                 # 工具函数
│   │   └── types/                 # 类型定义
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   ├── tests/
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── app/                   # 页面路由
│   │   ├── components/
│   │   │   ├── ui/                # 基础 UI 组件
│   │   │   ├── layout/            # 布局组件
│   │   │   └── features/          # 业务组件
│   │   ├── hooks/                 # 自定义 Hooks
│   │   ├── lib/                   # 工具函数、API 调用
│   │   └── styles/                # 样式
│   ├── package.json
│   └── next.config.js
├── n8n/
│   └── workflows/                 # n8n 工作流 JSON
├── docs/
└── package.json
```

**中间件（A 搭建，全员使用）**

| 中间件 | 说明 |
|--------|------|
| auth | 验证 JWT Token，注入 userId |
| errorHandler | 统一错误处理，返回标准格式 |
| validate | Zod Schema 校验请求参数 |

**统一响应格式（A 搭建，全员使用）**

```json
// 成功
{ "success": true, "data": {}, "message": "操作成功" }

// 失败
{ "success": false, "error": { "code": "ERROR_CODE", "message": "错误信息" } }
```

**分工**
- A：搭建项目骨架、中间件、工具函数、统一响应格式
- B：搭建前端基础布局、通用组件、API 调用封装
- C：使用已有架构，专注排期引擎和 n8n

---

### 2.3 前端通用组件与布局

**负责人**：开发者 B

**说明**：页面布局和通用 UI 组件由 B 统一维护，其他人复用。

**布局结构**

```
┌─────────────────────────────────────────┐
│  Header（Logo、用户信息、登出）           │
├──────────┬──────────────────────────────┤
│          │                              │
│ Sidebar  │        内容区域               │
│          │                              │
│ 仪表盘   │                              │
│ 项目     │                              │
│ 客户     │                              │
│ 报表     │                              │
│ 研究     │                              │
│ 设置     │                              │
│          │                              │
└──────────┴──────────────────────────────┘
```

**通用组件**

| 组件 | 说明 |
|------|------|
| Button | 按钮（primary / secondary / danger / ghost） |
| Card | 卡片容器 |
| Table | 表格（排序、筛选、分页） |
| Form | 表单组件 |
| Modal | 弹窗 |
| Drawer | 抽屉 |
| Loading | 加载状态 |
| Empty | 空状态 |
| Toast | 成功/错误提示 |
| StatusBadge | 状态标签 |
| PriorityBadge | 优先级标签 |

**分工**
- B：设计和实现布局、通用组件，提供使用文档
- A：使用通用组件开发自己的页面
- C：使用通用组件开发自己的页面

---

## 三、个人模块分工

### 开发者 A

#### 模块一：用户认证

| 功能 | 说明 |
|------|------|
| 注册 | 邮箱+密码注册，密码加密，邮箱去重 |
| 登录 | 验证密码，返回 JWT Token |
| 登出 | 清除 Token，失效 Session |
| 获取用户 | 根据 Token 返回当前用户信息 |
| 会话管理 | Token 7天过期 |

API：POST /api/auth/register, POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me

页面：/login（登录页）, /register（注册页）

验收：注册登录稳定，密码不明文，Token 过期返回 401

#### 模块二：项目管理

| 功能 | 说明 |
|------|------|
| 创建项目 | 名称、描述、开始日期、结束日期 |
| 项目列表 | 表格展示，状态筛选，分页 |
| 项目详情 | 项目信息 + 任务统计 + 成本汇总 |
| 编辑项目 | 修改名称、描述、状态、日期 |
| 删除项目 | 级联删除关联任务和成本 |
| 状态流转 | ACTIVE → COMPLETED / ARCHIVED |

API：GET /api/projects, POST /api/projects, GET /api/projects/:id, PUT /api/projects/:id, DELETE /api/projects/:id

页面：/projects（项目列表）, /projects/:id（项目详情）

验收：只能操作自己的项目，删除级联清除，列表支持分页筛选

#### 模块四：成本管理

| 功能 | 说明 |
|------|------|
| 录入成本 | 金额、类别、描述、日期，可选关联任务 |
| 成本列表 | 按项目展示，按类别筛选 |
| 编辑成本 | 修改金额、类别、描述 |
| 删除成本 | 删除记录 |
| 成本汇总 | 按项目汇总、按类别汇总 |

类别：LABOR(人工) / MATERIAL(材料) / OVERHEAD(管理) / OTHER(其他)

API：GET /api/projects/:projectId/costs, POST /api/projects/:projectId/costs, GET /api/costs/:id, PUT /api/costs/:id, DELETE /api/costs/:id

页面：嵌在项目详情页内

验收：金额大于0，类别必选，汇总计算正确

#### 模块八：仪表盘

| 功能 | 说明 |
|------|------|
| 项目概览 | 项目总数、进行中数 |
| 任务统计 | 总数、完成数、完成率 |
| 成本统计 | 总成本金额 |
| 最近活动 | 最近更新的任务列表 |
| 图表展示 | 状态分布、优先级分布、成本分布 |

API：GET /api/dashboard/summary, GET /api/dashboard/recent-activity, GET /api/dashboard/statistics

页面：/dashboard（仪表盘页）

验收：数据准确，图表可渲染，完成率计算正确

#### 模块九：报表

| 功能 | 说明 |
|------|------|
| 项目进度报表 | 各项目完成情况、进度百分比 |
| 成本分析报表 | 按项目、按类别汇总 |
| 时间线报表 | 项目/任务时间线展示 |

API：GET /api/reports/project-progress, GET /api/reports/cost-analysis, GET /api/reports/timeline

页面：/reports（报表页）

验收：进度计算正确，预估 vs 实际工时对比正确

---

### 开发者 B

#### 模块三：任务管理

| 功能 | 说明 |
|------|------|
| 创建任务 | 标题、描述、优先级、预估工时、截止日期 |
| 任务列表 | 按项目展示，状态/优先级筛选 |
| 任务详情 | 任务信息 + 关联成本 |
| 编辑任务 | 修改标题、描述、状态、优先级、工时 |
| 删除任务 | 级联删除关联成本 |
| 状态流转 | TODO → IN_PROGRESS → DONE / BLOCKED |
| 任务分配 | 分配给指定用户 |
| 看板视图 | TODO / IN_PROGRESS / DONE 三列拖拽 |

API：GET /api/projects/:projectId/tasks, POST /api/projects/:projectId/tasks, GET /api/tasks/:id, PUT /api/tasks/:id, DELETE /api/tasks/:id

页面：/projects/:projectId/tasks（任务列表+看板）

验收：任务必须属于项目，状态流转合理，看板拖拽可用

#### 模块五：客户管理

| 功能 | 说明 |
|------|------|
| 添加客户 | 名称、邮箱、电话、公司、地址、备注 |
| 客户列表 | 表格展示，支持搜索 |
| 客户详情 | 展示完整信息 |
| 编辑客户 | 修改客户信息 |
| 删除客户 | 删除记录 |

API：GET /api/customers, POST /api/customers, GET /api/customers/:id, PUT /api/customers/:id, DELETE /api/customers/:id

页面：/customers（客户列表）

验收：名称必填，支持按名称/公司搜索

#### 模块十二：页面布局与通用组件

| 功能 | 说明 |
|------|------|
| 整体布局 | Sidebar + Header + 内容区 |
| 通用组件 | Button、Card、Table、Form、Modal、Toast 等 |
| 响应式 | 桌面常见宽度不挤压 |
| 主题 | 统一配色和字体 |

验收：组件样式统一，布局在常见桌面宽度正常

#### 模块十三：设置

| 功能 | 说明 |
|------|------|
| 个人信息修改 | 修改姓名、邮箱 |
| 密码修改 | 验证旧密码，设置新密码 |

API：PUT /api/auth/profile, PUT /api/auth/password

页面：/settings（设置页）

---

### 开发者 C

#### 模块六：排期引擎

| 功能 | 说明 |
|------|------|
| 排期计算 | 按优先级、截止日期、工时排序 |
| 延期检测 | 识别已延期任务，计算延期天数 |
| 冲突检测 | 识别任务时间重叠 |
| 插单模拟 | 模拟新任务插入影响，返回原计划 vs 新计划 |
| 排期对比 | 被延期任务列表和总延期天数 |

排期规则：URGENT > HIGH > MEDIUM > LOW，同优先级按截止日期升序，无截止日期排最后

API：POST /api/scheduler/calculate, POST /api/scheduler/insertion, GET /api/scheduler/delays/:projectId, GET /api/scheduler/conflicts/:projectId

页面：/projects/:projectId/schedule（排期甘特图 + 插单模拟弹窗）

验收：排期按优先级正确排序，插单模拟返回延期差异，测试可跑

#### 模块七：AI 智能能力

| 功能 | 说明 |
|------|------|
| AI 任务解析 | 自然语言输入 → 结构化任务（标题、工时、优先级） |
| 智能排期建议 | 分析项目任务，给出最优执行顺序 |
| LLM 适配层 | 统一接口，支持切换 OpenAI / Claude / Mock |

API：POST /api/llm/parse, POST /api/llm/schedule-suggest

页面：AI 创建任务入口嵌在任务管理页面内

验收：自然语言能解析出结构化任务，LLM 不可用时 Mock 降级

#### 模块十：业务研究

| 功能 | 说明 |
|------|------|
| 执行搜索 | 输入关键词搜索行业资讯 |
| 结果展示 | 标题、摘要、来源、相关度 |
| 保存结果 | 收藏感兴趣的结果 |
| 收藏管理 | 查看、编辑标签、删除 |

API：POST /api/search, GET /api/search/history, POST /api/research/save, GET /api/research, PUT /api/research/:id, DELETE /api/research/:id

页面：/research/search（搜索页）, /research/saved（已保存页）

验收：搜索结果含标题/摘要/来源，支持保存和标签管理

#### 模块十一：n8n 工作流

| 工作流 | 触发 | 说明 |
|--------|------|------|
| AI 任务解析 | Webhook | 文本 → 调 LLM → 返回任务 JSON |
| 智能排期建议 | Webhook | 任务列表 → 调 LLM → 返回建议 |
| 自动周报 | 定时（每周一） | 拉数据 → LLM 生成周报 → 通知 |
| 到期提醒 | 定时（每天） | 检查到期/延期任务 → 提醒 |
| 业务搜索 | Webhook | 关键词 → 搜索 API → LLM 分析 |

验收：工作流能正常触发和回调，定时任务按计划执行

---

## 四、API 总览

### 认证相关（A）
```
POST /api/auth/register        注册
POST /api/auth/login           登录
POST /api/auth/logout          登出
GET  /api/auth/me              获取当前用户
PUT  /api/auth/profile         修改个人信息（B）
PUT  /api/auth/password        修改密码（B）
```

### 项目相关（A）
```
GET    /api/projects            项目列表
POST   /api/projects            创建项目
GET    /api/projects/:id        项目详情
PUT    /api/projects/:id        编辑项目
DELETE /api/projects/:id        删除项目
```

### 任务相关（B）
```
GET    /api/projects/:projectId/tasks   任务列表
POST   /api/projects/:projectId/tasks   创建任务
GET    /api/tasks/:id                   任务详情
PUT    /api/tasks/:id                   编辑任务
DELETE /api/tasks/:id                   删除任务
```

### 成本相关（A）
```
GET    /api/projects/:projectId/costs   成本列表
POST   /api/projects/:projectId/costs   录入成本
GET    /api/costs/:id                   成本详情
PUT    /api/costs/:id                   编辑成本
DELETE /api/costs/:id                   删除成本
```

### 客户相关（B）
```
GET    /api/customers            客户列表
POST   /api/customers            添加客户
GET    /api/customers/:id        客户详情
PUT    /api/customers/:id        编辑客户
DELETE /api/customers/:id        删除客户
```

### 排期相关（C）
```
POST /api/scheduler/calculate              计算排期
POST /api/scheduler/insertion              插单模拟
GET  /api/scheduler/delays/:projectId      延期任务
GET  /api/scheduler/conflicts/:projectId   冲突检测
```

### AI 相关（C）
```
POST /api/llm/parse              AI 解析任务
POST /api/llm/schedule-suggest   智能排期建议
```

### 搜索相关（C）
```
POST /api/search                 执行搜索
GET  /api/search/history         搜索历史
POST /api/research/save          保存结果
GET  /api/research               已保存列表
PUT  /api/research/:id           编辑
DELETE /api/research/:id         删除
```

### 仪表盘/报表（A）
```
GET /api/dashboard/summary           摘要
GET /api/dashboard/recent-activity   最近活动
GET /api/dashboard/statistics        图表数据
GET /api/reports/project-progress    项目进度
GET /api/reports/cost-analysis       成本分析
GET /api/reports/timeline            时间线
```

### Webhook（C 配置 n8n，A 提供接口）
```
POST /api/webhooks/llm-result        LLM 结果回调
POST /api/webhooks/report-ready      报告完成回调
```

---

## 五、页面总览

| 页面 | 路由 | 负责人 |
|------|------|--------|
| 登录页 | /login | A |
| 注册页 | /register | A |
| 仪表盘 | /dashboard | A |
| 项目列表 | /projects | A |
| 项目详情 | /projects/:id | A（框架）+ B（任务区）+ A（成本区） |
| 排期视图 | /projects/:projectId/schedule | C |
| 客户列表 | /customers | B |
| 报表 | /reports | A |
| 搜索 | /research/search | C |
| 已保存研究 | /research/saved | C |
| 设置 | /settings | B |

---

## 六、开发顺序

```
第 1 天：全员
  A：项目初始化 + 数据库 Schema + 基础架构搭建
  B：前端项目初始化 + 布局 + 通用组件
  C：排期引擎核心逻辑 + 单元测试

第 2 天：
  A：用户认证（API + 登录/注册页面）
  B：任务管理（API + 列表/看板页面）
  C：排期引擎完善 + LLM 适配层

第 3 天：
  A：项目管理（API + 列表/详情页面）
  B：客户管理（API + 列表页面）
  C：n8n 工作流配置（AI 解析 + 排期建议）

第 4 天：
  A：成本管理（API + 嵌入项目详情）
  B：页面布局优化 + 通用组件完善
  C：业务搜索（API + n8n + 页面）

第 5 天：
  A：仪表盘（API + 页面 + 图表）
  B：设置页面 + 交互优化
  C：插单模拟页面 + 排期甘特图

第 6 天：
  A：报表（API + 页面）
  B：空状态、加载态、错误提示完善
  C：n8n 自动化（周报 + 提醒）

第 7 天：全员联调
  A：修 Bug + API 优化
  B：修 Bug + 页面优化
  C：修 Bug + n8n 调试
```

---

## 七、依赖关系

```
B 依赖 A：任务管理 API 需要项目表结构先定好
C 依赖 A：排期引擎需要任务/项目数据结构稳定
B 和 C 解耦：B 不改排期规则，C 不改页面布局
```

---

## 八、第一阶段验收标准

- [ ] 登录注册稳定，数据进数据库
- [ ] 项目和任务可增删改查
- [ ] 成本记录能录入和查看
- [ ] 客户信息可管理
- [ ] 排期结果稳定展示
- [ ] 插单模拟能返回延期差异
- [ ] 仪表盘数据正确显示
- [ ] 报表数据正确
- [ ] 页面在常见桌面宽度下不挤压
- [ ] 有加载态、空状态、错误提示
