# 并行开发指南

## 当前状态

### 已完成模块
| 模块 | 前端 | 后端 | 说明 |
|------|------|------|------|
| auth（认证） | ✅ | ✅ | 登录/注册/登出/获取用户 |
| dashboard（仪表盘） | ✅ | ✅ | 统计卡片/项目概览/最近活动/客户/任务分布 |
| layout（布局） | ✅ | — | Sidebar/Header/AppLayout/AiPanel |

### 待开发模块（14 个）

---

## 三轨道并行分工

```
轨道 A（核心业务）:  projects → costs → reports
轨道 B（任务客户）:  tasks → customers → goals
轨道 C（智能辅助）:  settings → search → research → scheduler → llm → webhooks
```

### 文件冲突规则

**唯一共享文件**：`backend/src/routes/index.ts` — 已预注册完毕，**不得修改**。

每个模块的文件完全独立，三轨道可同时开发无冲突。

---

## 模块开发清单

### 轨道 A：projects → costs → reports

#### A1: projects（项目管理）
```
后端:
  [ ] backend/src/validators/project.schema.ts    — Zod 校验（createProject/updateProject）
  [ ] backend/src/services/project.service.ts     — CRUD（findAll/findById/create/update/remove）
  [ ] backend/src/routes/project.routes.ts        — GET/POST/PUT/DELETE + auth + validate
  [ ] curl 测试 4 条接口

前端:
  [ ] frontend/src/hooks/useProjects.ts           — React Query hooks
  [ ] frontend/src/components/features/projects/  — ProjectList/ProjectForm/ProjectCard
  [ ] frontend/src/app/main/projects/page.tsx     — 页面（loading/empty/error 三态）
```

#### A2: costs（成本管理）— 依赖 projects
```
后端:
  [ ] backend/src/validators/cost.schema.ts
  [ ] backend/src/services/cost.service.ts
  [ ] backend/src/routes/cost.routes.ts

前端:
  [ ] frontend/src/hooks/useCosts.ts
  [ ] frontend/src/components/features/costs/
  [ ] frontend/src/app/main/costs/page.tsx        — 需新建目录
```

#### A3: reports（报表分析）— 依赖 projects + costs
```
后端:
  [ ] backend/src/services/report.service.ts      — 聚合查询（按项目/按时间/按类型）
  [ ] backend/src/routes/report.routes.ts

前端:
  [ ] frontend/src/hooks/useReports.ts
  [ ] frontend/src/components/features/reports/
  [ ] frontend/src/app/main/reports/page.tsx
```

---

### 轨道 B：tasks → customers → goals

#### B1: tasks（任务管理）— 依赖 projects
```
后端:
  [ ] backend/src/validators/task.schema.ts
  [ ] backend/src/services/task.service.ts
  [ ] backend/src/routes/task.routes.ts

前端:
  [ ] frontend/src/hooks/useTasks.ts
  [ ] frontend/src/components/features/tasks/     — TaskList/TaskForm/TaskCard/KanbanBoard
  [ ] frontend/src/app/main/tasks/page.tsx        — 需新建目录
```

#### B2: customers（客户管理）
```
后端:
  [ ] backend/src/validators/customer.schema.ts
  [ ] backend/src/services/customer.service.ts
  [ ] backend/src/routes/customer.routes.ts

前端:
  [ ] frontend/src/hooks/useCustomers.ts
  [ ] frontend/src/components/features/customers/
  [ ] frontend/src/app/main/customers/page.tsx
```

#### B3: goals（目标管理）
```
后端:
  [ ] backend/src/validators/goal.schema.ts
  [ ] backend/src/services/goal.service.ts
  [ ] backend/src/routes/goal.routes.ts

前端:
  [ ] frontend/src/hooks/useGoals.ts
  [ ] frontend/src/components/features/goals/
  [ ] frontend/src/app/main/goals/page.tsx
```

---

### 轨道 C：settings → search → research → scheduler → llm → webhooks

#### C1: settings（系统设置）
```
后端:
  [ ] backend/src/validators/settings.schema.ts
  [ ] backend/src/services/settings.service.ts
  [ ] backend/src/routes/settings.routes.ts

前端:
  [ ] frontend/src/hooks/useSettings.ts
  [ ] frontend/src/components/features/settings/
  [ ] frontend/src/app/main/settings/page.tsx
```

#### C2: search（全局搜索）
```
后端:
  [ ] backend/src/services/search.service.ts      — 跨表搜索（projects/tasks/customers）
  [ ] backend/src/routes/search.routes.ts

前端:
  [ ] frontend/src/hooks/useSearch.ts
  [ ] frontend/src/components/features/search/    — SearchModal/SearchResults
  [ ] 挂载到 Header 搜索框的 ⌘K 快捷键
```

#### C3: research（业务研究）
```
后端:
  [ ] backend/src/services/research.service.ts
  [ ] backend/src/routes/research.routes.ts

前端:
  [ ] frontend/src/hooks/useResearch.ts
  [ ] frontend/src/components/features/research/
  [ ] frontend/src/app/main/research/page.tsx
```

#### C4: scheduler（排期管理）
```
后端:
  [ ] backend/src/services/scheduler.service.ts
  [ ] backend/src/routes/scheduler.routes.ts

前端:
  [ ] frontend/src/hooks/useScheduler.ts
  [ ] frontend/src/components/features/scheduler/ — CalendarView/GanttChart
  [ ] frontend/src/app/main/scheduler/page.tsx    — 需新建目录
```

#### C5: llm（AI 对接）
```
后端:
  [ ] backend/src/services/llm.service.ts         — 多供应商适配（DeepSeek/Claude/Ollama）
  [ ] backend/src/routes/llm.routes.ts

前端:
  [ ] 将 AiPanel 中的 mock 替换为真实 API 调用
```

#### C6: webhooks（Webhook 管理）
```
后端:
  [ ] backend/src/validators/webhook.schema.ts
  [ ] backend/src/services/webhook.service.ts
  [ ] backend/src/routes/webhook.routes.ts

前端:
  [ ] frontend/src/hooks/useWebhooks.ts
  [ ] frontend/src/components/features/webhooks/
  [ ] frontend/src/app/main/webhooks/page.tsx     — 需新建目录
```

---

## 开发流程模板

### 后端 4 步

```bash
# 1. Zod 校验
cat > backend/src/validators/xxx.schema.ts << 'EOF'
import { z } from 'zod';

export const createXxxSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100),
  // ...其他字段
});

export const updateXxxSchema = createXxxSchema.partial();

export type CreateXxxInput = z.infer<typeof createXxxSchema>;
export type UpdateXxxInput = z.infer<typeof updateXxxSchema>;
EOF

# 2. Service
cat > backend/src/services/xxx.service.ts << 'EOF'
import { prisma } from '../server';
import { CreateXxxInput, UpdateXxxInput } from '../validators/xxx.schema';

export async function findAll(userId: string, filters: { page?: number; limit?: number }) {
  const { page = 1, limit = 20 } = filters;
  const where = { ownerId: userId };
  const [data, total] = await Promise.all([
    prisma.xxx.findMany({ where, skip: (page - 1) * limit, take: limit }),
    prisma.xxx.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function findById(userId: string, id: string) {
  return prisma.xxx.findFirst({ where: { id, ownerId: userId } });
}

export async function create(userId: string, data: CreateXxxInput) {
  return prisma.xxx.create({ data: { ...data, ownerId: userId } });
}

export async function update(userId: string, id: string, data: UpdateXxxInput) {
  return prisma.xxx.updateMany({ where: { id, ownerId: userId }, data });
}

export async function remove(userId: string, id: string) {
  return prisma.xxx.deleteMany({ where: { id, ownerId: userId } });
}
EOF

# 3. 路由
cat > backend/src/routes/xxx.routes.ts << 'EOF'
import { Router } from 'express';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createXxxSchema, updateXxxSchema } from '../validators/xxx.schema';
import * as xxxService from '../services/xxx.service';
import { success, error } from '../utils/response';

const router = Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await xxxService.findAll(req.userId!, { page: Number(req.query.page), limit: Number(req.query.limit) });
    success(res, result);
  } catch (err) { error(res, 'INTERNAL_ERROR', '获取列表失败', 500); }
});

router.post('/', auth, validate(createXxxSchema), async (req, res) => {
  try {
    const item = await xxxService.create(req.userId!, req.body);
    success(res, item, 201);
  } catch (err) { error(res, 'INTERNAL_ERROR', '创建失败', 500); }
});

// PUT /:id, DELETE /:id 同理
export default router;
EOF

# 4. 测试
curl -X GET http://localhost:3001/api/xxx -b "token=YOUR_JWT"
```

### 前端 3 步

```bash
# 1. React Query Hook
cat > frontend/src/hooks/useXxx.ts << 'EOF'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const QUERY_KEY = 'xxx';

export function useXxxList(params?: Record<string, unknown>) {
  return useQuery({ queryKey: [QUERY_KEY, params], queryFn: () => api.get('/xxx', params) });
}

export function useCreateXxx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.post('/xxx', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}
EOF

# 2. 组件（在 frontend/src/components/features/xxx/ 下）
# 3. 页面（替换 frontend/src/app/main/xxx/page.tsx）
```

---

## 依赖关系图

```
auth ✅
 ├── projects ← costs ← reports
 ├── tasks ← (依赖 projects)
 ├── customers
 ├── goals
 ├── settings
 ├── search
 ├── research
 ├── scheduler
 ├── llm
 └── webhooks
```

**关键路径**：projects 是 tasks 和 costs 的前置依赖，优先完成。

---

## 检查清单（每个模块完成时）

- [ ] 后端 4 步完成（schema → service → routes → curl 测试）
- [ ] 前端 3 步完成（hook → 组件 → 页面）
- [ ] 页面三态完整（loading / empty / error）
- [ ] TypeScript 编译零错误
- [ ] 所有数据查询加 `ownerId` 过滤
- [ ] 所有接口加 auth 中间件 + Zod 校验
- [ ] 金额用整数（分），不用浮点数
