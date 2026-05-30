# 后端开发规则

## 技术栈
- Express 5 + Prisma 6 + SQLite + Zod 3 + TypeScript

## 核心原则：功能正确性第一

### 分层架构（严格遵守）
```
路由层 (routes/*.routes.ts)
  → 只做路由挂载和中间件绑定，不写业务逻辑

校验层 (validators/*.schema.ts)
  → Zod Schema 定义入参规则，路由层用 validate 中间件调用

服务层 (services/*.service.ts)
  → 所有业务逻辑在这里，操作 Prisma，不依赖 req/res

控制器层 (可选，复杂接口拆分)
  → 调用 service，组装响应，返回给前端
```

### 接口规范

#### 统一响应格式
```typescript
// 成功
{ success: true, data: T }

// 成功（列表）
{ success: true, data: T[], meta: { total, page, limit } }

// 失败
{ success: false, error: { code: string, message: string } }
```

#### HTTP 状态码
```
200 - 成功
201 - 创建成功
400 - 参数校验失败
401 - 未登录/token 无效
403 - 无权限
404 - 资源不存在
409 - 冲突（如邮箱已注册）
500 - 服务器错误
```

### Prisma 规范
- 金额字段用 Int（单位：分），不用 Float
- 所有查询加 `where` 条件，禁止裸查全表
- 删除用软删除（如果 schema 有 deletedAt），否则用 `delete`
- 关联查询用 `include`，不要 N+1
- 分页必须有 `skip` + `take`，默认 limit 20

### Zod 校验规范
- 所有 POST/PUT/PATCH 接口必须有 Zod schema
- 错误信息用中文，面向用户
- 可选字段用 `.optional()`，不用 `.nullable()`
- 枚举值用 `z.enum()`，不用 `z.string()`

### 错误处理
- 业务错误抛 `AppError`（带 code + message）
- Prisma 错误捕获后转为友好提示（如 P2002 → "已存在"）
- 未知错误打日志，返回通用 500 提示
- 异步路由必须 try-catch，不靠全局 errorHandler 兜底

### 安全要求
- 密码用 bcryptjs hash，salt rounds 10
- JWT 必须验证 exp
- 敏感配置（API Key）用 AES-256 加密存储
- 接口限频：登录 5次/分钟，普通接口 60次/分钟
- CORS 只允许 FRONTEND_URL

### 文件模板

#### 路由文件模板
```typescript
import { Router } from 'express';
import { validate } from '../middleware/validate';
import { xxxSchema } from '../validators/xxx.schema';
import * as xxxService from '../services/xxx.service';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await xxxService.findAll(req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

export default router;
```

#### Service 文件模板
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function findAll(filters: any) {
  return prisma.xxx.findMany({ where: filters });
}
```

#### Validator 文件模板
```typescript
import { z } from 'zod';

export const createXxxSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
});

export type CreateXxxInput = z.infer<typeof createXxxSchema>;
```

## 开发技能使用指南

### 写接口前（设计阶段）
- `/ecc:backend-patterns` — 查 Express 5 路由/中间件/错误处理最佳实践
- `/ecc:prisma-patterns` — 查 Prisma 6 查询优化/事务/关联查询模式
- `/ecc:database-migrations` — 数据库迁移策略，schema 变更如何安全推送

### 写业务逻辑时
- `/ecc:error-handling` — 统一错误处理方案，AppError 类设计
- `/ecc:tdd-workflow` — 测试驱动开发：先写测试 → 写实现 → 重构

### 查文档（遇到 API 不确定时）
- 使用 context7 MCP 查询 Prisma / Express / Zod 最新文档
- 示例：查 Prisma findMany 的 where 写法、Express 5 错误中间件签名、Zod refine 用法

### 写完接口后
- `/ecc:code-review` — 代码审查：检查逻辑正确性/边界条件/类型安全
- `/ecc:security-review` — 安全审查：JWT 验证/SQL 注入/敏感数据泄露/权限绕过
- `/ecc:test-coverage` — 检查测试覆盖率是否达标 80%

### 构建报错时
- `/ecc:build-fix` — 修复 TypeScript 编译错误、Prisma generate 失败、依赖冲突

### 复杂问题推理
- 使用 sequential-thinking MCP 做链式推理
- 适用场景：多表联查优化、复杂业务逻辑拆解、架构决策分析
