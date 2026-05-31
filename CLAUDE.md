# TaskFlow+ 项目规则

## 项目概述
智能项目管理系统，前后端分离架构。

## 技术栈
- **前端**: Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui + React Query + Zustand
- **后端**: Express 5 + Prisma 6 + SQLite + Zod 3
- **AI**: OpenAI SDK（多供应商适配：DeepSeek / Claude / Ollama）
- **自动化**: n8n

## 开发原则

### 前端（精美优先）
- **必须用 shadcn/ui 组件**，不要手写基础 UI
- **必须用 Tailwind CSS**，不要写 CSS 文件
- **配色统一**：使用 CSS 变量，参考 `globals.css` 中的设计 token
- **间距节奏**：不要均匀 padding，要有层次感（大区块间距 > 小组件间距）
- **交互状态**：所有可点击元素必须有 hover/active/focus 状态
- **响应式**：所有页面必须适配 768px 和 1024px 断点
- **动画适度**：用 `transition` 做状态变化，不要过度动画
- **空状态**：列表为空时必须有友好的空状态提示，不能留白
- **加载状态**：数据请求时必须有 loading 骨架屏或 spinner
- **错误状态**：请求失败必须有错误提示，不能静默失败

### 后端（正确性优先）
- **所有接口必须 Zod 校验**，不信任任何前端传参
- **所有错误必须统一格式**：`{ success: false, error: { code, message } }`
- **所有成功必须统一格式**：`{ success: true, data: ... }`
- **Service 层不直接操作数据库**，通过 Prisma Client
- **Controller 层不写业务逻辑**，只做参数校验和调用 Service
- **金额用整数（分）**，不用浮点数
- **敏感配置用 AES 加密**，不存明文
- **JWT 必须验证过期时间**
- **路由必须挂载校验中间件**

### 代码风格
- TypeScript strict 模式
- 函数不超过 50 行
- 文件不超过 400 行
- 不用 `any`，必须定义类型
- 错误用 try-catch，不吞异常
- 异步函数必须处理 rejection

## 目录约定
- 后端路由：`backend/src/routes/*.routes.ts`
- 后端服务：`backend/src/services/*.service.ts`
- 后端校验：`backend/src/validators/*.schema.ts`
- 前端页面：`frontend/src/app/main/*/page.tsx`
- 前端组件：`frontend/src/components/features/*/`
- 前端 hooks：`frontend/src/hooks/use*.ts`

## 路由注册机制

### 请求流转路径
```
HTTP 请求
  → app.ts          （CORS / JSON解析 / Cookie解析）
    → routes/index.ts   （路由分发 + auth 中间件）
      → routes/xxx.routes.ts  （具体路由定义）
        → validators/xxx.schema.ts  （Zod 参数校验）
          → services/xxx.service.ts   （业务逻辑 + Prisma 操作）
            → 返回 { success: true, data }
```

### 路由注册规则
- 所有路由在 `routes/index.ts` 中统一注册
- 公开接口（auth/webhooks）不加 auth 中间件
- 需要登录的接口必须加 `auth` 中间件
- 限频中间件按需加（登录接口加 `loginLimit`，普通接口加 `apiLimit`）
- 新模块必须在 index.ts 中 import + router.use()，否则接口 404

## 单模块开发流程

每个模块按以下 8 步顺序开发，后端先行，前端跟进：

### 第 1 步：定义数据库 Schema
```
编辑 backend/prisma/schema.prisma
  → 添加或修改模型
  → 运行 npx prisma db push
  → 运行 npx prisma generate
```

### 第 2 步：写 Zod 校验 Schema
```
创建 backend/src/validators/xxx.schema.ts
  → 定义 createXxxSchema / updateXxxSchema
  → 导出类型 CreateXxxInput / UpdateXxxInput
```

### 第 3 步：写 Service 业务逻辑
```
创建 backend/src/services/xxx.service.ts
  → 实现 findAll / findById / create / update / delete
  → 所有 Prisma 操作在这里
  → 返回数据，不依赖 req/res
```

### 第 4 步：写路由接口
```
创建 backend/src/routes/xxx.routes.ts
  → 定义 GET/POST/PUT/DELETE 路由
  → 挂载 validate 中间件（Zod 校验）
  → 调用 service 方法
  → 统一响应格式
  → 在 routes/index.ts 中注册
```

### 第 5 步：后端测试
```
启动后端 npm run dev
  → 用 curl 或 Postman 测试每个接口
  → 验证：正常返回、参数错误、未授权、重复创建
```

### 第 6 步：写前端 Hook
```
创建 frontend/src/hooks/useXxx.ts
  → 用 React Query 的 useQuery / useMutation
  → 封装 api.ts 调用
  → 处理 loading / error / success 状态
```

### 第 7 步：写前端组件和页面
```
创建组件 frontend/src/components/features/xxx/XxxForm.tsx
创建组件 frontend/src/components/features/xxx/XxxList.tsx
创建页面 frontend/src/app/main/xxx/page.tsx
  → 用 shadcn/ui 组件
  → 用 useXxx hook 获取数据
  → 处理空状态 / 加载状态 / 错误状态
```

### 第 8 步：前端验证
```
启动前端 npm run dev
  → 浏览器打开页面
  → 测试完整流程：创建 / 编辑 / 删除 / 列表
  → 检查响应式（768px / 1024px）
```

### 开发顺序建议
```
认证模块（auth）        → 一切的基础，先做
项目模块（projects）    → 核心业务
任务模块（tasks）       → 依赖项目
成本模块（costs）       → 依赖项目
仪表盘（dashboard）     → 聚合数据
其余模块按需推进
```

## 并行开发规范

### 前置条件（已完成）
以下准备工作已就绪，**无需重复操作**：
- `routes/index.ts` 中所有 16 个模块的 import + router.use 已预注册
- 前端所有骨架页面已创建（空占位，可直接替换）
- 数据库 Schema 已定稿（开发过程中一般不新增表）

### 三轨道并行分工

```
轨道 A（核心业务）:
  模块: projects → costs → reports
  依赖: 仅需 User（✅已完成）
  起点: 先做 projects，costs 和 reports 可后续跟进

轨道 B（任务客户）:
  模块: tasks → customers → goals
  依赖: User（✅已完成）+ Project（⚠️ 测试时需要 projects API 已就绪）
  策略: 代码可与 A 并行写，联调等 A 完成 Project 后

轨道 C（智能辅助）:
  模块: settings → search/research → scheduler → llm → webhooks
  依赖: 仅需 User（✅已完成），完全独立
  起点: 任意顺序，互不阻塞
```

### 文件冲突规则

**唯一共享文件**：`backend/src/routes/index.ts` — 已预注册完毕，开发过程中**不得修改**。

**每个模块的独占文件清单**（以 projects 为例）：
```
backend/src/validators/project.schema.ts   ← 不与他模块共享
backend/src/services/project.service.ts    ← 不与他模块共享
backend/src/routes/project.routes.ts       ← 不与他模块共享
frontend/src/hooks/useProjects.ts          ← 不与他模块共享
frontend/src/components/features/projects/ ← 不与他模块共享
frontend/src/app/main/projects/            ← 不与他模块共享
```

> 这意味着**三个人同时开发三个不同模块，不会有任何文件冲突**。

### 模块标准开发流程（后端 4 步 + 前端 3 步）

每开发一个新模块，严格按以下顺序：

```
后端:
  1. validators/xxx.schema.ts  ← 定义 createXxxSchema / updateXxxSchema
  2. services/xxx.service.ts   ← 实现 CRUD 方法（findAll / findById / create / update / delete）
  3. routes/xxx.routes.ts      ← 定义 GET/POST/PUT/DELETE，挂 validate 中间件
  4. curl 测试每个接口 ← 正常返回 / 参数错误 / 未授权 / 重复创建

前端:
  5. hooks/useXxx.ts           ← React Query hooks（useQuery / useMutation）
  6. components/features/xxx/  ← 业务组件（XxxForm / XxxList / XxxCard）
  7. app/main/xxx/page.tsx     ← 页面组装，必须处理三种状态：
       - 加载态: Skeleton / Spinner
       - 空状态: 图标 + 提示文字 + 引导按钮
       - 错误态: 错误提示，不静默失败
```

### 后端 Service 模板

```typescript
import { prisma } from '../server';

export async function findAll(userId: string, filters: {
  page?: number; limit?: number; status?: string;
}) {
  const { page = 1, limit = 20, status } = filters;
  const where = { ownerId: userId, ...(status ? { status } : {}) };

  const [data, total] = await Promise.all([
    prisma.xxx.findMany({ where, skip: (page - 1) * limit, take: limit }),
    prisma.xxx.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function findById(userId: string, id: string) {
  return prisma.xxx.findFirst({ where: { id, ownerId: userId } });
}

export async function create(userId: string, data: CreateInput) {
  return prisma.xxx.create({ data: { ...data, ownerId: userId } });
}

export async function update(userId: string, id: string, data: UpdateInput) {
  return prisma.xxx.updateMany({ where: { id, ownerId: userId }, data });
}

export async function remove(userId: string, id: string) {
  return prisma.xxx.deleteMany({ where: { id, ownerId: userId } });
}
```

### 前端 Hook 模板

```typescript
// hooks/useXxx.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const QUERY_KEY = 'xxx';

export function useXxxList(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => api.get('/xxx', params),
  });
}

export function useCreateXxx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.post('/xxx', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}
```

### 新模块加入检查清单

- [ ] 后端 `validators/xxx.schema.ts` — Zod 校验完善，中文错误提示
- [ ] 后端 `services/xxx.service.ts` — 所有数据查询加 `ownerId` 过滤
- [ ] 后端 `routes/xxx.routes.ts` — auth 中间件 + validate 中间件 + try-catch
- [ ] 后端 API 测试通过（curl 至少 4 条：正常/异常/未登录/重复）
- [ ] 前端 `hooks/useXxx.ts` — React Query 封装
- [ ] 前端 `components/features/xxx/` — 组件实现
- [ ] 前端 `app/main/xxx/page.tsx` — loading / empty / error 三态完整
- [ ] TypeScript 编译零错误（`npx tsc --noEmit`）

## 数据库说明

### 当前状态
- 数据库文件：`backend/prisma/dev.db`（SQLite 单文件，无需安装数据库服务）
- 表结构定义：`backend/prisma/schema.prisma`（16 张表）
- 连接配置：`backend/.env` 中 `DATABASE_URL="file:./dev.db"`
- 测试数据：已通过 seed 填充（2 用户 / 2 项目 / 6 任务 / 5 成本 / 3 客户）

### 数据流
```
service.ts 中调用 prisma.user.findMany()
  → Prisma Client 将 TypeScript 翻译成 SQL
    → SQLite 读写 dev.db 文件
      → 返回结果
```

### 常用命令
| 场景 | 命令 |
|------|------|
| 改了 schema 后同步 | `npx prisma db push && npx prisma generate` |
| 重新填充测试数据 | `npx prisma db seed` |
| 浏览器可视化看数据 | `npx prisma studio`（http://localhost:5555） |
| 重置数据库（清空重建） | `npx prisma db push --force-reset` |

### 开发注意
- 不需要写 SQL，全部用 Prisma API（findMany / create / update / delete）
- 金额字段存**分**（100.50 元 = 10050），前端 ÷100 显示
- `prisma db push` 用于开发阶段，上线前改用 `prisma migrate dev`
- `force-reset` 会清空所有数据，需要重新 seed
- Prisma Client 已在 `server.ts` 中初始化并导出，service 中直接 import 使用

### 测试账号
| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | admin@taskflow.com | 123456 |
| 普通用户 | user@taskflow.com | 123456 |
