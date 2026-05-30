# TaskFlow+ 技术栈设计文档

## 概述

TaskFlow+ 是一个智能项目管理工具，核心差异化能力是智能协调（LLM 任务解析、智能排期建议、插单模拟）。本文档详细说明技术栈选择、架构设计和开发流程。

## 技术栈选择

### 方案选择：混合方案

**选择理由：**
1. 时间紧迫（1周），n8n 可以加速 LLM 集成部分
2. 团队有一定 n8n 经验，可以快速上手
3. 本地开发环境友好（n8n 可选）
4. 核心业务用代码保证质量，LLM 用 n8n 提高效率

### 技术栈详情

**前端**
- 框架：Next.js 14+ (App Router)
- UI 库：Tailwind CSS + shadcn/ui
- 状态管理：Zustand / React Query
- 图表：Chart.js / Recharts

**后端**
- 运行时：Node.js 18+
- 框架：Express / Fastify
- ORM：Prisma
- 数据库：SQLite (本地) / PostgreSQL (云)

**智能协调**
- n8n：工作流自动化
- LLM：OpenAI GPT-4 / Claude
- 搜索：Google Search API / 行业数据库

**部署**
- 本地：Docker Compose
- 云：轻量云服务器 / Serverless

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    TaskFlow+ 整体架构                        │
├─────────────────────────────────────────────────────────────┤
│  前端层 (React/Next.js)                                      │
│  ├─ Auth 模块 (登录/注册)                                    │
│  ├─ Dashboard 模块 (仪表盘)                                  │
│  ├─ Projects 模块 (项目管理)                                 │
│  ├─ Tasks 模块 (任务管理)                                    │
│  ├─ Reports 模块 (报表)                                      │
│  └─ Settings 模块 (设置)                                     │
├─────────────────────────────────────────────────────────────┤
│  API 层 (Node.js + Express/Fastify)                          │
│  ├─ /api/auth (认证)                                        │
│  ├─ /api/projects (项目 CRUD)                                │
│  ├─ /api/tasks (任务管理)                                    │
│  ├─ /api/costs (成本记录)                                    │
│  ├─ /api/scheduler (排期引擎)                                │
│  ├─ /api/llm (LLM 解析)                                     │
│  └─ /api/webhooks (n8n 回调)                                 │
├─────────────────────────────────────────────────────────────┤
│  业务逻辑层                                                   │
│  ├─ 核心业务 (纯代码)                                        │
│  │   ├─ 认证逻辑                                            │
│  │   ├─ 项目/任务 CRUD                                      │
│  │   ├─ 排期引擎 (core.js)                                   │
│  │   └─ 成本计算                                            │
│  └─ n8n 工作流 (自动化 + 智能协调)                            │
│      ├─ LLM 任务解析                                        │
│      ├─ 智能排期建议                                        │
│      ├─ 插单模拟计算                                        │
│      ├─ 自动生成报告                                        │
│      └─ 定时通知提醒                                        │
├─────────────────────────────────────────────────────────────┤
│  数据层 (SQLite + Prisma)                                    │
│  ├─ User 表                                                 │
│  ├─ Project 表                                              │
│  ├─ Task 表                                                 │
│  ├─ CostRecord 表                                           │
│  ├─ Customer 表                                             │
│  ├─ SearchResult 表                                         │
│  ├─ SavedResearch 表                                        │
│  └─ Session 表                                              │
└─────────────────────────────────────────────────────────────┘
```

## 数据层设计

### 表结构设计

**User 表**
```sql
User {
  id: String (PK)
  email: String (unique)
  password: String (hashed)
  name: String
  role: Enum (ADMIN, USER)
  createdAt: DateTime
  updatedAt: DateTime
}
```

**Project 表**
```sql
Project {
  id: String (PK)
  name: String
  description: String?
  status: Enum (ACTIVE, ARCHIVED, COMPLETED)
  startDate: DateTime
  endDate: DateTime?
  ownerId: String (FK → User)
  createdAt: DateTime
  updatedAt: DateTime
}
```

**Task 表**
```sql
Task {
  id: String (PK)
  title: String
  description: String?
  status: Enum (TODO, IN_PROGRESS, DONE, BLOCKED)
  priority: Enum (LOW, MEDIUM, HIGH, URGENT)
  estimatedHours: Float
  actualHours: Float?
  startDate: DateTime?
  dueDate: DateTime?
  projectId: String (FK → Project)
  assigneeId: String (FK → User?)
  createdAt: DateTime
  updatedAt: DateTime
}
```

**CostRecord 表**
```sql
CostRecord {
  id: String (PK)
  amount: Float
  category: Enum (LABOR, MATERIAL, OVERHEAD, OTHER)
  description: String
  date: DateTime
  projectId: String (FK → Project)
  taskId: String (FK → Task?)
  createdAt: DateTime
  updatedAt: DateTime
}
```

**Customer 表**
```sql
Customer {
  id: String (PK)
  name: String
  email: String?
  phone: String?
  company: String?
  address: String?
  notes: String?
  createdAt: DateTime
  updatedAt: DateTime
}
```

**SearchResult 表**
```sql
SearchResult {
  id: String (PK)
  query: String
  source: String
  title: String
  content: String
  url: String?
  relevance: Float
  saved: Boolean (default: false)
  userId: String (FK → User)
  createdAt: DateTime
}
```

**SavedResearch 表**
```sql
SavedResearch {
  id: String (PK)
  title: String
  summary: String
  content: String
  tags: String[]
  userId: String (FK → User)
  searchResultId: String (FK → SearchResult?)
  createdAt: DateTime
  updatedAt: DateTime
}
```

**Session 表**
```sql
Session {
  id: String (PK)
  userId: String (FK → User)
  token: String (unique)
  expiresAt: DateTime
  createdAt: DateTime
}
```

### 表关系

```
User 1──* Project (owner)
User 1──* Task (assignee)
Project 1──* Task
Project 1──* CostRecord
Task 1──* CostRecord
User 1──* Customer
User 1──* SearchResult
User 1──* SavedResearch
SearchResult 1──* SavedResearch
User 1──* Session
```

## API 设计

### 认证相关

```
POST   /api/auth/register    - 用户注册
POST   /api/auth/login       - 用户登录
POST   /api/auth/logout      - 用户登出
GET    /api/auth/me          - 获取当前用户信息
```

### 项目相关

```
GET    /api/projects         - 获取项目列表
POST   /api/projects         - 创建项目
GET    /api/projects/:id     - 获取项目详情
PUT    /api/projects/:id     - 更新项目
DELETE /api/projects/:id     - 删除项目
```

### 任务相关

```
GET    /api/projects/:projectId/tasks  - 获取项目任务列表
POST   /api/projects/:projectId/tasks  - 创建任务
GET    /api/tasks/:id                  - 获取任务详情
PUT    /api/tasks/:id                  - 更新任务
DELETE /api/tasks/:id                  - 删除任务
```

### 成本记录相关

```
GET    /api/projects/:projectId/costs  - 获取项目成本记录
POST   /api/projects/:projectId/costs  - 创建成本记录
GET    /api/costs/:id                  - 获取成本记录详情
PUT    /api/costs/:id                  - 更新成本记录
DELETE /api/costs/:id                  - 删除成本记录
```

### 客户管理相关

```
GET    /api/customers              - 获取客户列表
POST   /api/customers              - 创建客户
GET    /api/customers/:id          - 获取客户详情
PUT    /api/customers/:id          - 更新客户
DELETE /api/customers/:id          - 删除客户
```

### 排期引擎相关

```
POST   /api/scheduler/calculate        - 计算排期
POST   /api/scheduler/insertion        - 插单模拟
GET    /api/scheduler/suggestions      - 获取排期建议
GET    /api/scheduler/schedule         - 获取当前排期
GET    /api/scheduler/conflicts        - 获取排期冲突
GET    /api/scheduler/delays           - 获取延期任务
```

### 业务数据搜索相关

```
POST   /api/search                 - 执行搜索
GET    /api/search/history         - 获取搜索历史
GET    /api/search/results/:id     - 获取搜索结果详情
POST   /api/research/save          - 保存搜索结果
GET    /api/research               - 获取已保存的研究
GET    /api/research/:id           - 获取研究详情
PUT    /api/research/:id           - 更新研究
DELETE /api/research/:id           - 删除研究
```

### 仪表盘数据相关

```
GET    /api/dashboard/summary          - 获取仪表盘摘要
GET    /api/dashboard/recent-activity  - 获取最近活动
GET    /api/dashboard/statistics       - 获取统计数据
```

### 报表数据相关

```
GET    /api/reports/project-progress   - 项目进度报表
GET    /api/reports/task-distribution  - 任务分布报表
GET    /api/reports/cost-analysis      - 成本分析报表
GET    /api/reports/timeline           - 时间线报表
```

### n8n 回调相关

```
POST   /api/webhooks/llm-result        - LLM 解析结果回调
POST   /api/webhooks/report-ready      - 报告生成完成回调
```

### 响应格式

**成功响应**
```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

**错误响应**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "输入验证失败",
    "details": [ ... ]
  }
}
```

## 前端模块设计

### 模块划分

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # 认证相关页面
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/        # 仪表盘
│   │   └── page.tsx
│   ├── (projects)/         # 项目管理
│   │   ├── page.tsx        # 项目列表
│   │   └── [id]/           # 项目详情
│   ├── (tasks)/            # 任务管理
│   │   └── page.tsx
│   ├── (reports)/          # 报表
│   │   └── page.tsx
│   ├── (research)/         # 业务研究
│   │   ├── search/         # 搜索
│   │   └── saved/          # 已保存
│   ├── (customers)/        # 客户管理
│   │   └── page.tsx
│   ├── (settings)/         # 设置
│   │   └── page.tsx
│   └── layout.tsx          # 根布局
├── components/             # 通用组件
│   ├── ui/                 # 基础 UI 组件
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Table.tsx
│   │   ├── Form.tsx
│   │   └── Modal.tsx
│   ├── layout/             # 布局组件
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   └── features/           # 功能组件
│       ├── auth/
│       ├── projects/
│       ├── tasks/
│       ├── reports/
│       ├── research/
│       └── customers/
├── hooks/                  # 自定义 Hooks
│   ├── useAuth.ts
│   ├── useProjects.ts
│   ├── useTasks.ts
│   ├── useSearch.ts
│   └── useCustomers.ts
├── lib/                    # 工具函数
│   ├── api.ts              # API 调用
│   ├── utils.ts            # 通用工具
│   └── constants.ts        # 常量定义
└── styles/                 # 样式文件
    ├── globals.css
    └── components.css
```

### 页面设计

**仪表盘页面**
- 项目概览卡片
- 任务统计图表
- 最近活动列表
- 快速操作入口

**项目列表页面**
- 表格布局展示项目
- 筛选条件：状态、日期范围
- 排序：名称、创建时间、状态
- 操作：编辑、删除、查看详情

**任务管理页面**
- 看板视图 / 列表视图切换
- 任务卡片展示
- 拖拽排序
- 快速编辑

**报表页面**
- 项目进度图表
- 成本分析图表
- 任务分布图表
- 导出功能

**业务研究页面**
- 搜索输入框
- 搜索结果列表
- 保存按钮
- 已保存研究列表

**客户管理页面**
- 客户列表表格
- 客户详情页
- 关联项目/任务

## 开发流程与团队协调

### 开发阶段划分

**第一阶段：基础架构（第 1-2 天）**
- 开发者 A：数据库设计 + Prisma 配置
- 开发者 B：前端基础框架 + 通用组件
- 开发者 C：排期引擎核心逻辑

**第二阶段：核心功能（第 3-4 天）**
- 开发者 A：认证系统 + 项目/任务 CRUD API
- 开发者 B：仪表盘 + 项目/任务页面
- 开发者 C：排期引擎测试 + LLM 适配层

**第三阶段：智能协调（第 5-6 天）**
- 开发者 A：成本记录 API + 数据优化
- 开发者 B：报表页面 + 业务研究页面
- 开发者 C：n8n 工作流配置 + 插单模拟

**第四阶段：整合优化（第 7 天）**
- 全员：联调测试 + Bug 修复 + 性能优化

### 分支策略

```
main
├── feat/prisma-schema        # 数据库 schema
├── feat/auth-api             # 认证 API
├── feat/project-api          # 项目 API
├── feat/task-api             # 任务 API
├── feat/cost-api             # 成本 API
├── feat/scheduler-engine     # 排期引擎
├── feat/frontend-base        # 前端基础
├── feat/dashboard            # 仪表盘
├── feat/project-ui           # 项目页面
├── feat/task-ui              # 任务页面
├── feat/report-ui            # 报表页面
├── feat/research-ui          # 业务研究页面
├── feat/customer-ui          # 客户管理页面
├── feat/n8n-workflows        # n8n 工作流
└── feat/llm-integration      # LLM 集成
```

### PR 规则

1. **单一职责**：每个 PR 只做一件事
2. **标题规范**：`feat: add project CRUD API`
3. **描述清晰**：说明做了什么、为什么做
4. **测试覆盖**：新功能必须有测试
5. **代码审查**：至少一人审查

### 合并顺序

```
1. feat/prisma-schema          # 数据库基础
2. feat/auth-api               # 认证系统
3. feat/frontend-base          # 前端基础
4. feat/project-api            # 项目 API
5. feat/project-ui             # 项目页面
6. feat/task-api               # 任务 API
7. feat/task-ui                # 任务页面
8. feat/scheduler-engine       # 排期引擎
9. feat/cost-api               # 成本 API
10. feat/dashboard             # 仪表盘
11. feat/report-ui             # 报表页面
12. feat/research-ui           # 业务研究页面
13. feat/customer-ui           # 客户管理页面
14. feat/n8n-workflows         # n8n 工作流
15. feat/llm-integration       # LLM 集成
```

### 依赖关系

```
开发者 B 依赖开发者 A：
- 前端需要 API 接口
- 数据结构变更需要同步

开发者 C 依赖开发者 A：
- 排期引擎需要任务/项目数据
- n8n 需要 API 接口

开发者 B 和开发者 C 解耦：
- B 不改排期规则
- C 不改页面布局
```

## n8n 工作流设计

### 工作流概览

**1. LLM 任务解析工作流**
```
触发器：Webhook - POST /api/webhooks/llm-parse
│
├── 接收任务描述
├── 调用 OpenAI/Claude API
│   └── Prompt：解析任务描述成结构化数据
├── 处理 LLM 响应
│   ├── 提取标题
│   ├── 提取描述
│   ├── 提取优先级
│   ├── 提取预估工时
│   └── 提取截止日期
├── 保存到数据库
└── 返回结果给前端
```

**2. 智能排期建议工作流**
```
触发器：Webhook - POST /api/webhooks/schedule-suggest
│
├── 获取项目所有任务
├── 获取历史排期数据
├── 调用 LLM 分析
│   └── Prompt：分析任务依赖和资源冲突
├── 生成排期建议
│   ├── 任务排序建议
│   ├── 资源分配建议
│   └── 时间调整建议
└── 返回建议给前端
```

**3. 插单模拟计算工作流**
```
触发器：Webhook - POST /api/webhooks/insertion-simulate
│
├── 获取当前排期
├── 获取新任务信息
├── 模拟插入计算
│   ├── 计算影响范围
│   ├── 识别延期任务
│   └── 计算延期天数
├── 生成对比报告
│   ├── 原计划 vs 新计划
│   ├── 延期任务列表
│   └── 建议调整方案
└── 返回结果给前端
```

**4. 自动生成报告工作流**
```
触发器：Cron - 每周一 9:00
│
├── 获取项目数据
│   ├── 项目进度
│   ├── 任务完成情况
│   └── 成本数据
├── 调用 LLM 生成报告
│   └── Prompt：生成周报摘要
├── 保存报告到数据库
└── 发送通知
    ├── 邮件通知
    └── 站内消息
```

**5. 业务数据搜索工作流**
```
触发器：Webhook - POST /api/webhooks/search
│
├── 接收搜索关键词
├── 调用搜索 API
│   ├── Google Search API
│   └── 行业数据库 API
├── 调用 LLM 分析结果
│   ├── 提取关键信息
│   ├── 评估相关性
│   └── 生成摘要
├── 保存搜索结果
└── 返回结构化数据
```

## 测试策略

### 测试类型

**1. 单元测试**
- 工具函数测试
- 业务逻辑测试
- 数据转换测试

**2. 集成测试**
- API 端点测试
- 数据库操作测试
- n8n 工作流测试

**3. E2E 测试**
- 用户登录流程
- 项目创建流程
- 任务管理流程
- 报表生成流程

### 测试覆盖率目标

| 模块 | 覆盖率目标 |
|------|-----------|
| 核心业务逻辑 | 90%+ |
| API 端点 | 80%+ |
| 前端组件 | 70%+ |
| n8n 工作流 | 60%+ |

### 测试工具

**后端测试**
- Jest：单元测试和集成测试
- Supertest：API 端点测试
- Prisma 测试工具：数据库测试

**前端测试**
- Jest：单元测试
- React Testing Library：组件测试
- Playwright：E2E 测试

**n8n 测试**
- n8n 内置测试功能
- Webhook 测试工具

## 部署与环境配置

### 混合部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                    混合部署架构                              │
├─────────────────────────────────────────────────────────────┤
│  本地开发环境                                                │
│  ├─ 前端开发 (Next.js)                                      │
│  ├─ 后端开发 (Node.js)                                      │
│  └─ n8n 工作流编辑                                          │
├─────────────────────────────────────────────────────────────┤
│  云服务器 (测试/演示)                                        │
│  ├─ 后端服务 (API)                                          │
│  ├─ 数据库 (PostgreSQL)                                     │
│  ├─ n8n 服务                                                │
│  └─ 前端静态资源                                            │
├─────────────────────────────────────────────────────────────┤
│  云服务 (外部)                                               │
│  ├─ LLM API (OpenAI/Claude)                                 │
│  ├─ 搜索 API                                                │
│  └─ 文件存储 (可选)                                          │
└─────────────────────────────────────────────────────────────┘
```

### 推荐云服务方案

**方案一：轻量云服务器（推荐）**
```
服务器配置：
- 阿里云/腾讯云 轻量应用服务器
- 2核 4GB 内存
- 50GB SSD
- 带宽 5Mbps
- 费用：约 50-100 元/月

部署内容：
- 后端 API 服务
- PostgreSQL 数据库
- n8n 服务
- 前端静态资源
```

**方案二：Serverless 方案**
```
服务选择：
- 前端：Vercel (免费)
- 后端：Railway / Render (免费额度)
- 数据库：Supabase (免费额度)
- n8n：n8n Cloud (免费额度)

优点：
- 无需管理服务器
- 自动扩缩容
- 成本低

缺点：
- 配置复杂
- 冷启动延迟
```

**方案三：Docker 容器化**
```
服务器配置：
- 任意云服务器 2核 4GB
- Docker + Docker Compose

服务容器：
- frontend (Next.js)
- backend (Node.js)
- postgres (PostgreSQL)
- n8n (n8n 服务)
```

### 环境变量配置

```env
# 数据库
DATABASE_URL="postgresql://user:password@cloud-host:5432/taskflow"

# 认证
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# LLM
OPENAI_API_KEY="your-openai-key"
LLM_MODEL="gpt-4"

# n8n
N8N_WEBHOOK_URL="https://your-n8n-domain.com/webhook"
N8N_API_KEY="your-n8n-key"

# 搜索 API
SEARCH_API_KEY="your-search-key"
SEARCH_API_URL="https://api.search.com"

# 服务器配置
PORT=3000
NODE_ENV=production
```

## 风险评估与应对

### 技术风险

**1. n8n 集成风险**
- 风险：n8n 工作流调试困难
- 应对：提供详细的日志记录，使用 n8n 内置测试功能
- 备选：关键流程用代码实现，n8n 作为辅助

**2. LLM API 稳定性风险**
- 风险：API 调用失败或延迟
- 应对：实现重试机制，设置超时时间
- 备选：提供 mock 数据，支持离线模式

**3. 数据库性能风险**
- 风险：数据量大时查询变慢
- 应对：添加索引，优化查询
- 备选：使用缓存，分页查询

**4. 前端性能风险**
- 风险：页面加载慢，交互卡顿
- 应对：代码分割，懒加载，优化渲染
- 备选：使用 CDN，压缩资源

### 团队风险

**1. 开发进度风险**
- 风险：任务延期，无法按时完成
- 应对：每日站会，及时沟通，调整优先级
- 备选：砍掉非核心功能

**2. 技术能力风险**
- 风险：团队成员技术不熟悉
- 应对：提供培训，结对编程，代码审查
- 备选：简化技术方案

**3. 沟通协调风险**
- 风险：信息不对称，重复工作
- 应对：使用项目管理工具，定期同步
- 备选：明确分工，减少依赖

### 应急预案

**场景一：n8n 集成失败**
```
1. 切换到纯代码实现
2. 使用 mock 数据
3. 延后 n8n 功能
```

**场景二：LLM API 不可用**
```
1. 使用 mock 数据
2. 实现离线模式
3. 切换到其他 LLM 服务
```

**场景三：进度严重滞后**
```
1. 砍掉非核心功能
2. 增加开发资源
3. 延长开发时间
```

## 总结与下一步

### 核心功能清单

**第一阶段验收标准**
- [ ] 登录注册稳定
- [ ] 数据进数据库
- [ ] 项目和任务可增删改
- [ ] 排期结果稳定展示
- [ ] 成本记录能录入和查看
- [ ] 插单模拟能返回延期差异

**智能协调功能**
- [ ] LLM 任务解析
- [ ] 智能排期建议
- [ ] 插单模拟计算
- [ ] 自动生成报告
- [ ] 业务数据搜索

### 开发时间表

```
第 1 天：环境搭建 + 数据库设计
第 2 天：认证系统 + 基础 API
第 3 天：项目/任务管理 + 前端基础
第 4 天：排期引擎 + 成本记录
第 5 天：n8n 工作流 + LLM 集成
第 6 天：报表 + 业务研究
第 7 天：联调测试 + 优化部署
```

### 下一步行动

1. **立即行动**
   - 搭建开发环境
   - 初始化项目结构
   - 配置云服务器

2. **第一周**
   - 实现核心功能
   - 完成第一阶段验收
   - 部署测试环境

3. **后续优化**
   - 性能优化
   - 功能完善
   - 用户反馈
