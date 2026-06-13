# 经营看板优化方案

> 文档日期：2026-06-12
> 涉及页面：仪表盘 `/dashboard`、经营看板 `/reports`
> 涉及后端：`dashboard.service.ts`、`report.service.ts`

---

## 目录

- [P0：修复数据准确性](#p0修复数据准确性)
  - [1. 统一利润计算口径](#1-统一利润计算口径)
  - [2. 收入判断逻辑修复](#2-收入判断逻辑修复)
  - [3. 成本去重验证与修复](#3-成本去重验证与修复)
- [P1：核心功能补全](#p1核心功能补全)
  - [4. KPI 卡片增加环比指标](#4-kpi-卡片增加环比指标)
  - [5. 增加趋势图（近6个月）](#5-增加趋势图近6个月)
  - [6. 增加回款记录模型](#6-增加回款记录模型)
  - [7. 经营看板改用 React Query](#7-经营看板改用-react-query)
- [P2：管理深度提升](#p2管理深度提升)
  - [8. 工时效率分析](#8-工时效率分析)
  - [9. 仪表盘增加时间选择器](#9-仪表盘增加时间选择器)
  - [10. 应收账款看板](#10-应收账款看板)
  - [11. 补全 Zod 校验](#11-补全-zod-校验)
  - [12. 移除重复卡片](#12-移除重复卡片)

---

## P0：修复数据准确性

### 1. 统一利润计算口径

**问题现状**

仪表盘的利润公式存在口径错配：

```
仪表盘（当前）:
  monthlyIncome  = 本月 COMPLETED 项目的 budget 合计（有时间过滤）
  totalCost      = 历史全部 costRecord + task.cost（无时间过滤）    ← ❌
  estimatedProfit = monthlyIncome - totalCost                       ← 口径不同

经营看板（正确）:
  income  = 同期 COMPLETED 项目的 budget 合计
  cost    = 同期 costRecord + task.cost（有时间过滤）              ← ✅
  profit  = income - cost                                          ← 口径一致
```

**影响**

老板看到"本月入款 5 万，已发生成本 15 万，利润 -10 万"，实际本月是赚钱的，只是成本累积了历史数据。

**优化方案**

给 `dashboard.service.ts` 的 `getStats()` 中的成本查询加上时间范围过滤，与 `monthlyIncome` 使用同一个时间段（本月）：

```typescript
// backend/src/services/dashboard.service.ts

export async function getStats(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [projectCount, taskStats, recordCostSum, taskCostSum, monthlyIncomeAgg, overdueCount] =
    await Promise.all([
      prisma.project.count({ where: { ownerId: userId } }),

      prisma.task.groupBy({
        by: ['status'],
        where: { project: { ownerId: userId } },
        _count: { id: true },
      }),

      // ✅ 成本也限定在本月
      prisma.costRecord.aggregate({
        where: {
          project: { ownerId: userId },
          date: { gte: startOfMonth },       // ← 加时间过滤
        },
        _sum: { amount: true },
      }),

      // ✅ 任务成本也限定在本月
      prisma.task.aggregate({
        where: {
          project: { ownerId: userId },
          cost: { gt: 0 },
          createdAt: { gte: startOfMonth },   // ← 加时间过滤
        },
        _sum: { cost: true },
      }),

      // 收入（不变）
      prisma.project.aggregate({
        where: {
          ownerId: userId,
          status: 'COMPLETED',
          updatedAt: { gte: startOfMonth },
        },
        _sum: { budget: true },
      }),

      prisma.task.count({
        where: {
          project: { ownerId: userId },
          dueDate: { lt: now },
          status: { not: 'DONE' },
        },
      }),
    ]);

  // ...后续计算不变
}
```

**改动范围：** 仅改 `dashboard.service.ts`，前端不需要动。

---

### 2. 收入判断逻辑修复

**问题现状**

当前用 `updatedAt` 判断项目是否"本月完成"：

```typescript
where: { status: 'COMPLETED', updatedAt: { gte: startOfMonth } }
```

`updatedAt` 在**任何字段修改**时都会更新——改个名字、换个标签都可能导致旧项目被重新计入当月收入。

**优化方案：分两步走**

#### 第一步：快速修复——用 `completedAt` 替代 `updatedAt`

Prisma Schema 中 `Task` 已经有 `completedAt` 字段，但 `Project` 没有。需要给 Project 加一个：

```prisma
// backend/prisma/schema.prisma → Project 模型新增字段
model Project {
  // ...现有字段...
  completedAt   DateTime?    // 标记为"已完成"的时间点
}
```

```bash
npx prisma db push && npx prisma generate
```

然后在 Project 状态变更为 `COMPLETED` 时自动记录时间：

```typescript
// backend/src/services/project.service.ts → update() 方法中

// 当状态切换为 COMPLETED 时，记录完成时间
const extraData: Record<string, unknown> = {};
if (data.status === 'COMPLETED') {
  extraData.completedAt = new Date();
}

return prisma.project.updateMany({
  where: { id, ownerId: userId },
  data: { ...data, ...extraData },
});
```

查询收入时改为：

```typescript
// dashboard.service.ts 和 report.service.ts 都要改
where: {
  ownerId: userId,
  status: 'COMPLETED',
  completedAt: { gte: startOfMonth },  // ✅ 用 completedAt
}
```

#### 第二步（中期）：引入 Payment 模型

见 [优化6：增加回款记录模型](#6-增加回款记录模型)。

**改动范围：** Schema（1字段）+ `project.service.ts` + `dashboard.service.ts` + `report.service.ts`

---

### 3. 成本去重验证与修复

**问题现状**

```typescript
// dashboard.service.ts
totalCost = recordCostSum + taskCostSum
//           ↑ costRecord 表的金额   ↑ task.cost 字段
```

需要先确认 `task.cost` 的数据来源。根据 Schema 推断，`task.cost` 可能是从关联的 `costRecord` 聚合而来的。如果确实如此，则存在双重计算。

**验证方法**

```bash
# 对比一下两个数字是否重复
# 在 backend 目录下用 prisma studio 或写一个脚本
npx prisma studio
# 检查：某个 task 的 cost 字段值 是否 = 它关联的 costRecord 的 amount 之和
```

**修复方案——二选一**

| 方案 | 思路 | 适用场景 |
|---|---|---|
| A：只用 costRecord | `totalCost = recordCostSum`，忽略 `task.cost` | 如果 `task.cost` 确实是从 costRecord 聚合来的 |
| B：只用 task.cost | `totalCost = taskCostSum`，不查 costRecord | 如果 `task.cost` 是独立维护的金额字段 |

推荐 **方案 A**，因为 costRecord 是最细粒度的真实记录：

```typescript
// dashboard.service.ts
export async function getStats(userId: string) {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [projectCount, taskStats, totalCostAgg, monthlyIncomeAgg, overdueCount] =
    await Promise.all([
      prisma.project.count({ where: { ownerId: userId } }),
      prisma.task.groupBy({ /* 不变 */ }),

      // ✅ 只查 costRecord，不再查 task.cost
      prisma.costRecord.aggregate({
        where: {
          project: { ownerId: userId },
          date: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),

      prisma.project.aggregate({ /* 不变 */ }),
      prisma.task.count({ /* 不变 */ }),
    ]);

  const totalCost = totalCostAgg._sum.amount || 0;
  // ...后续计算
}
```

同时 `report.service.ts` 中的 `getTaskCostByProject` 和 `getRecordCostByProject` 也需要对齐——要么全用 costRecord，要么明确区分两者的含义。

**改动范围：** `dashboard.service.ts` + `report.service.ts`（需同步修改）

---

## P1：核心功能补全

### 4. KPI 卡片增加环比指标

**问题现状**

6 个 KPI 数字都是静态快照，缺少"比上月如何"的对比基准。经营者看到数字的第一反应永远是"变好了还是变差了"。

**优化方案**

#### 后端：`getStats()` 返回上月同期数据

```typescript
// dashboard.service.ts

export async function getStats(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // 现有查询不变 ...

  // 新增：上月同期数据（并行查询，不增加延迟）
  const [
    lastMonthIncomeAgg,
    lastMonthCostAgg,
    lastMonthTaskStats,
  ] = await Promise.all([
    prisma.project.aggregate({
      where: {
        ownerId: userId,
        status: 'COMPLETED',
        completedAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
      _sum: { budget: true },
    }),
    prisma.costRecord.aggregate({
      where: {
        project: { ownerId: userId },
        date: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
      _sum: { amount: true },
    }),
    prisma.task.groupBy({
      by: ['status'],
      where: {
        project: { ownerId: userId },
        completedAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
      _count: { id: true },
    }),
  ]);

  const lastMonthIncome = lastMonthIncomeAgg._sum.budget || 0;
  const lastMonthCost = lastMonthCostAgg._sum.amount || 0;
  const lastMonthDone = lastMonthTaskStats.find(g => g.status === 'DONE')?._count.id || 0;

  return {
    // ...现有字段...

    // 新增：上月数据（前端用来算变化率）
    lastMonth: {
      income: lastMonthIncome,
      cost: lastMonthCost,
      doneTasks: lastMonthDone,
    },
  };
}
```

#### 前端：KPI 卡片显示变化率

```tsx
// dashboard/page.tsx → StatCard 组件增加 change 属性

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  toneClass,
  change,        // ← 新增
}: {
  // ...现有 props...
  change?: { value: number; label: string } | null;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
          <div className="mt-1 flex items-center gap-2">
            {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
            {change ? (
              <span className={cn(
                'text-[11px] font-medium',
                change.value > 0 ? 'text-emerald-600' : change.value < 0 ? 'text-red-500' : 'text-muted-foreground',
              )}>
                {change.value > 0 ? '↑' : change.value < 0 ? '↓' : '—'}
                {Math.abs(change.value)}% {change.label}
              </span>
            ) : null}
          </div>
        </div>
        <div className={cn('rounded-lg p-2', toneClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
```

使用方式：

```tsx
// 本月入款卡片
<StatCard
  icon={TrendingUp}
  label="本月入款"
  value={formatYuan(stats.monthlyIncome)}
  hint="已完成订单报价合计"
  toneClass="bg-emerald-100 text-emerald-600 ..."
  change={
    stats.lastMonth.income > 0
      ? {
          value: Math.round(((stats.monthlyIncome - stats.lastMonth.income) / stats.lastMonth.income) * 100),
          label: '环比上月',
        }
      : null
  }
/>
```

**改动范围：** `dashboard.service.ts` + `dashboard/page.tsx`（StatCard 组件 + 使用处）

---

### 5. 增加趋势图（近6个月）

**问题现状**

当前所有图表都是当前时段的静态数据，没有时间序列。管理者最需要的是"走势"——收入是在涨还是在跌。

**优化方案**

#### 后端：新增趋势接口

```typescript
// backend/src/services/dashboard.service.ts → 新增方法

export async function getTrends(userId: string) {
  const months: { start: Date; end: Date; label: string }[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const label = `${start.getMonth() + 1}月`;
    months.push({ start, end, label });
  }

  // 并行查询 6 个月的数据
  const results = await Promise.all(
    months.map(async ({ start, end, label }) => {
      const [incomeAgg, costAgg, taskGroup] = await Promise.all([
        prisma.project.aggregate({
          where: {
            ownerId: userId,
            status: 'COMPLETED',
            completedAt: { gte: start, lte: end },
          },
          _sum: { budget: true },
        }),
        prisma.costRecord.aggregate({
          where: {
            project: { ownerId: userId },
            date: { gte: start, lte: end },
          },
          _sum: { amount: true },
        }),
        prisma.task.groupBy({
          by: ['status'],
          where: {
            project: { ownerId: userId },
            completedAt: { gte: start, lte: end },
          },
          _count: { id: true },
        }),
      ]);

      const income = incomeAgg._sum.budget || 0;
      const cost = costAgg._sum.amount || 0;
      const doneTasks = taskGroup.find(g => g.status === 'DONE')?._count.id || 0;

      return { label, income, cost, profit: income - cost, doneTasks };
    }),
  );

  return results;
}
```

```typescript
// backend/src/routes/dashboard.routes.ts → 新增路由

router.get('/trends', async (req, res) => {
  try {
    const trends = await dashboardService.getTrends(req.userId);
    res.json({ success: true, data: { trends } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'TRENDS_ERROR', message: '获取趋势数据失败' } });
  }
});
```

#### 前端：趋势折线图组件

用 **Recharts**（项目已安装）实现，不要用 CSS 手搓：

```tsx
// frontend/src/components/features/dashboard/TrendChart.tsx

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface TrendData {
  label: string;
  income: number;
  cost: number;
  profit: number;
  doneTasks: number;
}

interface TrendChartProps {
  data: TrendData[];
}

function formatYuan(fen: number): string {
  const yuan = fen / 100;
  return yuan >= 10000 ? `${(yuan / 10000).toFixed(1)}w` : `${yuan}`;
}

export function TrendChart({ data }: TrendChartProps) {
  // 转为元，Recharts 直接渲染
  const chartData = data.map(d => ({
    ...d,
    income: d.income / 100,
    cost: d.cost / 100,
    profit: d.profit / 100,
  }));

  return (
    <Card className="border-border/60">
      <CardHeader className="border-b border-border px-4 py-3">
        <CardTitle className="text-sm font-semibold text-foreground">
          近6个月趋势
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-4">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={formatYuan} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number) => [`¥${value.toLocaleString()}`, '']}
              contentStyle={{ fontSize: 12 }}
            />
            <Line type="monotone" dataKey="income" stroke="#10b981" name="收入" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="cost" stroke="#f43f5e" name="成本" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="profit" stroke="#6366f1" name="利润" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

仪表盘页面引入：

```tsx
// dashboard/page.tsx
// 在 queryFn 中增加 /dashboard/trends 请求
// 在 JSX 中，替换或在"任务闭环检查"卡片位置放入 TrendChart
```

**改动范围：** `dashboard.service.ts`（新方法）+ `dashboard.routes.ts`（新路由）+ 新建 `TrendChart.tsx` + `dashboard/page.tsx`

---

### 6. 增加回款记录模型

**问题现状**

当前用 `Project.budget`（报价金额）等同于"收入"，但现实中：
- 项目报价 10 万，实际可能分期到账
- 尾款拖延 60 天是常态
- 无法区分"应收"和"已收"

**优化方案**

#### 数据库：新增 Payment 模型

```prisma
// backend/prisma/schema.prisma

model Payment {
  id          String   @id @default(cuid())
  amount      Int      // 金额（分）
  type        String   // DOWN_PAYMENT | PROGRESS | FINAL | OTHER
  method      String?  // BANK_TRANSFER | CASH | CHECK | OTHER
  receivedAt  DateTime // 实际到账日期
  note        String?  // 备注
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())

  @@index([projectId])
  @@index([receivedAt])
}

// Project 模型中新增
model Project {
  // ...现有字段...
  payments      Payment[]
  completedAt   DateTime?
}
```

```bash
npx prisma db push && npx prisma generate
```

#### 后端：Payment 服务和路由

```typescript
// backend/src/validators/payment.schema.ts

import { z } from 'zod';

export const createPaymentSchema = z.object({
  amount: z.number().int().positive('金额必须大于 0'),
  type: z.enum(['DOWN_PAYMENT', 'PROGRESS', 'FINAL', 'OTHER']),
  method: z.string().optional(),
  receivedAt: z.string().datetime(),
  note: z.string().max(200).optional(),
  projectId: z.string().cuid(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
```

```typescript
// backend/src/services/payment.service.ts

import { prisma } from '../server';

export async function create(userId: string, data: CreatePaymentInput) {
  // 验证项目属于当前用户
  const project = await prisma.project.findFirst({
    where: { id: data.projectId, ownerId: userId },
  });
  if (!project) throw new Error('项目不存在');

  return prisma.payment.create({
    data: {
      amount: data.amount,
      type: data.type,
      method: data.method,
      receivedAt: new Date(data.receivedAt),
      note: data.note,
      projectId: data.projectId,
    },
  });
}

export async function getByProject(userId: string, projectId: string) {
  return prisma.payment.findMany({
    where: { project: { ownerId: userId, id: projectId } },
    orderBy: { receivedAt: 'desc' },
  });
}

// 仪表盘用：本月实际回款
export async function getMonthlyReceived(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const agg = await prisma.payment.aggregate({
    where: {
      project: { ownerId: userId },
      receivedAt: { gte: startOfMonth },
    },
    _sum: { amount: true },
  });

  return agg._sum.amount || 0;
}

// 应收账款：每个项目的 待收 = 报价 - 已收
export async function getReceivables(userId: string) {
  const projects = await prisma.project.findMany({
    where: { ownerId: userId, status: { not: 'ARCHIVED' } },
    select: {
      id: true,
      name: true,
      budget: true,
      status: true,
      payments: { select: { amount: true } },
    },
  });

  return projects
    .map(p => ({
      id: p.id,
      name: p.name,
      budget: p.budget ?? 0,
      received: p.payments.reduce((s, pay) => s + pay.amount, 0),
      receivable: (p.budget ?? 0) - p.payments.reduce((s, pay) => s + pay.amount, 0),
      status: p.status,
    }))
    .filter(p => p.receivable > 0)
    .sort((a, b) => b.receivable - a.receivable);
}
```

#### 仪表盘集成

有了 Payment 模型后，仪表盘的"本月入款"应改为：

```typescript
// dashboard.service.ts
const monthlyReceived = await paymentService.getMonthlyReceived(userId);
// 用 monthlyReceived 替代 monthlyIncome
```

**改动范围：** Prisma Schema + 新建 `payment.schema.ts` + `payment.service.ts` + `payment.routes.ts` + `routes/index.ts`（注册）+ `dashboard.service.ts` + 前端回款管理页面

---

### 7. 经营看板改用 React Query

**问题现状**

`reports/page.tsx` 用原始 `useEffect` + `useState` + `Promise.all`，无缓存、无重试、错误被吞。

**优化方案**

```tsx
// frontend/src/app/main/reports/page.tsx

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, AlertTriangle, TrendingUp, TrendingDown, DollarSign, PieChart, Lightbulb, Calendar } from 'lucide-react';
import { MarkdownRenderer } from '@/components/features/ai/MarkdownRenderer';

// ...接口定义不变...

function getDefaultDate(mode: 'day' | 'month' | 'year'): string {
  const n = new Date();
  if (mode === 'day') return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  if (mode === 'year') return `${n.getFullYear()}`;
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

export default function ReportsPage() {
  const [viewMode, setViewMode] = useState<'day' | 'month' | 'year'>('month');
  const [selectedDate, setSelectedDate] = useState(getDefaultDate('month'));
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const period = viewMode === 'year' ? selectedDate.slice(0, 4) : selectedDate;
  const type = viewMode;

  // ✅ 改用 React Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', period, type],
    queryFn: async () => {
      const [ov, pr, cs, ta] = await Promise.all([
        api.get<Overview>(`/reports/overview?period=${period}&type=${type}`),
        api.get<ProjectRanking[]>(`/reports/project-ranking?period=${period}&type=${type}`),
        api.get<CostStructure[]>(`/reports/cost-structure?period=${period}&type=${type}`),
        api.get<TimeAnalysis>(`/reports/time-analysis?period=${period}&type=${type}`),
      ]);
      return { overview: ov, ranking: pr, structure: cs, time: ta };
    },
    staleTime: 30_000,     // 30秒内切回不重新请求
    gcTime: 5 * 60_000,    // 缓存保留5分钟
    retry: 1,              // 失败重试1次
  });

  const overview = data?.overview ?? null;
  const ranking = data?.ranking ?? [];
  const structure = data?.structure ?? [];
  const time = data?.time ?? null;

  function handleViewChange(mode: 'day' | 'month' | 'year') {
    setViewMode(mode);
    setSelectedDate(getDefaultDate(mode));
    setAiInsight(null);
    // 不需要手动 setState → React Query 自动根据 queryKey 重新请求
  }

  // 错误状态 ✅
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <AlertTriangle className="h-10 w-10 text-red-300" />
        <p className="mt-4 text-sm text-red-500">
          {error instanceof ApiError ? error.message : '加载报表数据失败'}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>;
  }

  // ...后续 JSX 不变...
}
```

**关键变化点：**

| 之前 | 之后 |
|---|---|
| `useEffect` + `Promise.all` + `useState` × 4 | `useQuery` 一个调用搞定 |
| 切日期 → 手动 `setLoading(true)` | React Query 自动管理 loading 状态 |
| `.catch(() => {})` 吞错误 | `error` 状态有 UI 处理 |
| 切走再切回 → 重新请求 | 30秒内直接用缓存 |
| 切日期时先 `setAiInsight(null)` 又在 effect 里再设一次 | 只在 `handleViewChange` 里设一次 |

**改动范围：** 仅改 `reports/page.tsx`

---

## P2：管理深度提升

### 8. 工时效率分析

**问题现状**

经营看板的"工时分析"只显示总工时和日均，缺少管理者最关心的**估时 vs 实时**对比和**人效**数据。

**优化方案**

#### 后端：增强 `getTimeAnalysis()`

```typescript
// report.service.ts

export async function getTimeAnalysis(userId: string, period?: string, type?: string) {
  const { start, end } = parseRange(period, (type as 'day' | 'month' | 'year') || 'month');

  const entries = await prisma.timeEntry.findMany({
    where: { userId, date: { gte: start, lte: end } },
    include: {
      project: { select: { name: true } },
      task: { select: { title: true, estimatedHours: true, actualHours: true } },
    },
  });

  const byProject: Record<string, { hours: number; estimatedHours: number }> = {};
  let total = 0;

  for (const entry of entries) {
    const name = entry.project?.name || '未关联项目';
    if (!byProject[name]) {
      byProject[name] = { hours: 0, estimatedHours: 0 };
    }
    byProject[name].hours += entry.hours;
    // 累加任务估时（去重——同一个任务只计一次）
    if (entry.task?.estimatedHours) {
      byProject[name].estimatedHours = entry.task.estimatedHours;
    }
    total += entry.hours;
  }

  const daysInPeriod = type === 'day' ? 1 : type === 'year' ? 365
    : new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();

  return {
    byProject: Object.entries(byProject).map(([project, data]) => ({
      project,
      hours: Math.round(data.hours * 10) / 10,
      estimatedHours: data.estimatedHours,
      efficiency: data.estimatedHours > 0
        ? Math.round((data.estimatedHours / data.hours) * 100)
        : null,  // 效率 = 估时/实时 × 100%，>100% 表示提前完成
    })),
    totalHours: Math.round(total * 10) / 10,
    avgPerDay: Math.round((total / daysInPeriod) * 10) / 10,
  };
}
```

#### 前端：工时卡片增加效率指标

```tsx
// reports/page.tsx → 工时分析部分

{time.byProject.map((p, i) => (
  <div key={p.project} className="flex items-center justify-between text-xs">
    <div className="flex items-center gap-1.5">
      <span className={cn('h-2.5 w-2.5 rounded-full', barColors[i % 6])} />
      {p.project}
      <span className="text-muted-foreground">{p.hours}h</span>
    </div>
    {p.efficiency !== null && (
      <span className={cn(
        'font-mono font-medium',
        p.efficiency >= 100 ? 'text-emerald-600' : p.efficiency >= 80 ? 'text-amber-600' : 'text-red-500',
      )}>
        效率 {p.efficiency}%
        {p.efficiency >= 100 ? ' ✓' : p.efficiency < 80 ? ' ⚠' : ''}
      </span>
    )}
  </div>
))}
```

---

### 9. 仪表盘增加时间选择器

**问题现状**

经营看板有日/月/年切换，但仪表盘的所有数字都是"全生命周期"的，没有时间维度。

**优化方案**

在仪表盘顶部增加和经营看板一样的日/月/年切换器，所有6个 KPI 卡片和图表数据都根据选择的时间范围重新查询。

```tsx
// dashboard/page.tsx

// 1. 增加状态
const [viewMode, setViewMode] = useState<'day' | 'month' | 'year'>('month');
const [selectedDate, setSelectedDate] = useState(getDefaultDate('month'));

// 2. queryKey 中加入时间参数
const { data, isLoading, error } = useQuery({
  queryKey: ['dashboard', viewMode, selectedDate],
  queryFn: async () => {
    const period = viewMode === 'year' ? selectedDate.slice(0, 4) : selectedDate;
    const type = viewMode;
    const qs = `period=${period}&type=${type}`;

    const [statsRes, tasksRes, projectsRes, customersRes, trendsRes] = await Promise.all([
      api.get(`/dashboard/summary?${qs}`),
      api.get(`/dashboard/recent-activity`),
      api.get(`/dashboard/project-stats?${qs}`),
      api.get(`/dashboard/customer-stats`),
      api.get(`/dashboard/trends`),
    ]);
    // ...
  },
});

// 3. JSX 顶部加时间选择器（复用经营看板的 UI）
<div className="flex items-center gap-3">
  <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
    {['day', 'month', 'year'].map(mode => (
      <button key={mode} onClick={() => handleViewChange(mode as any)}
        className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-all',
          viewMode === mode ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
        {mode === 'day' ? '日' : mode === 'month' ? '月' : '年'}
      </button>
    ))}
  </div>
  <input type={getDateInputType()} value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
    className="..." />
</div>
```

后端 `getStats()` 需要接收 `period` 和 `type` 参数（目前只接收 `userId`）。

**改动范围：** `dashboard.service.ts`（加参数）+ `dashboard.routes.ts`（传参）+ `dashboard/page.tsx`

---

### 10. 应收账款看板

**前提：** 需要先完成 [优化6：回款记录模型](#6-增加回款记录模型)。

**优化方案**

在经营看板（`/reports`）新增一个"应收账款"模块：

```tsx
// reports/page.tsx → 新增模块

{/* 应收账款 */}
<div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
  <h3 className="mb-3 text-sm font-semibold text-foreground/80">应收账款</h3>
  {receivables.length === 0 ? (
    <p className="py-6 text-center text-xs text-muted-foreground">全部已回款</p>
  ) : (
    <div className="space-y-3">
      {receivables.map(r => (
        <div key={r.id} className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{r.name}</p>
            <p className="text-xs text-muted-foreground">
              报价 {fmtYuan(r.budget)} · 已收 {fmtYuan(r.received)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-amber-600">待收 {fmtYuan(r.receivable)}</p>
            <p className="text-xs text-muted-foreground">
              回款率 {r.budget > 0 ? Math.round((r.received / r.budget) * 100) : 0}%
            </p>
          </div>
        </div>
      ))}
      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between text-sm font-bold">
          <span>合计待收</span>
          <span className="text-amber-600">
            {fmtYuan(receivables.reduce((s, r) => s + r.receivable, 0))}
          </span>
        </div>
      </div>
    </div>
  )}
</div>
```

---

### 11. 补全 Zod 校验

**问题现状**

`dashboard.schema.ts` 和 `report.schema.ts` 是空的 TODO 文件，违反项目规范"所有接口必须 Zod 校验"。

**优化方案**

```typescript
// backend/src/validators/dashboard.schema.ts

import { z } from 'zod';

export const dashboardQuerySchema = z.object({
  period: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, '日期格式不正确').optional(),
  type: z.enum(['day', 'month', 'year']).optional().default('month'),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
```

```typescript
// backend/src/validators/report.schema.ts

import { z } from 'zod';

export const reportQuerySchema = z.object({
  period: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, '日期格式不正确').optional(),
  type: z.enum(['day', 'month', 'year']).optional().default('month'),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
```

路由中挂载校验中间件：

```typescript
// dashboard.routes.ts
import { validate } from '../middleware/validate';
import { dashboardQuerySchema } from '../validators/dashboard.schema';

router.get('/summary', validate(dashboardQuerySchema, 'query'), async (req, res) => {
  // req.query 已被校验和类型化
  const { period, type } = req.query as DashboardQuery;
  const stats = await dashboardService.getStats(req.userId, period, type);
  res.json({ success: true, data: { stats } });
});
```

**改动范围：** 两个 schema 文件 + 两个 routes 文件

---

### 12. 移除重复卡片

**问题现状**

仪表盘"任务闭环检查"卡片显示的 4 个数字（全部/未完成/已完成/逾期）和顶部 KPI 卡片完全重复，占用一整个卡片的位置但没有新增信息。

**优化方案——三选一**

| 方案 | 说明 | 推荐度 |
|---|---|---|
| A：替换为趋势图 | 用 [优化5](#5-增加趋势图近6个月) 的 TrendChart 替代 | ⭐⭐⭐ 推荐 |
| B：替换为工时概览 | 显示本周/本月工时分布 | ⭐⭐ |
| C：差异化改造 | 按优先级/按负责人维度拆分任务统计 | ⭐⭐ |

推荐 **方案 A**——用趋势折线图替代重复的数字卡片，信息密度提升最大。

---

## 实施优先级总览

```
P0（本周内完成）── 影响数据准确性
  ├── [1] 统一利润口径        → 改 1 个文件
  ├── [2] 用 completedAt       → 改 Schema + 2 个 service
  └── [3] 成本去重验证         → 改 2 个 service

P1（两周内完成）── 影响日常使用体验
  ├── [4] 环比指标             → 改 service + 前端 StatCard
  ├── [5] 趋势图               → 新建组件 + 新增路由
  ├── [6] 回款模型             → 新建表 + 新建 service
  └── [7] React Query 重构     → 改 1 个页面

P2（一个月内完成）── 提升管理深度
  ├── [8] 工时效率分析         → 增强现有 service
  ├── [9] 仪表盘时间选择器     → 前后端联动
  ├── [10] 应收账款看板        → 依赖 [6]
  ├── [11] Zod 校验            → 补全 2 个 schema
  └── [12] 移除重复卡片        → 依赖 [5]
```

**建议开发顺序：** P0 全部 → 7 → 4 → 5 → 12 → 6 → 11 → 8 → 9 → 10
