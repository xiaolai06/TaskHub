# 回款记录（Payment）系统设计说明

> 文档日期：2026-06-12
> 关联模块：项目管理、经营看板、仪表盘

---

## 一、为什么需要回款记录

### 当前系统的数据缺口

```
现状数据链路：
  Project.budget = 100,000（报价 10 万）
       ↓
  直接当作"本月收入"显示在仪表盘和经营看板上
       ↓
  ❌ 实际上这笔钱可能只到账了 3 万（预付款）
```

现实中的项目回款通常是分期的：

```
项目 A（报价 10 万）:
  ┌──────────────────────────────────────────────────┐
  │  签约期        交付期          验收期         尾款期  │
  │  ─────────    ──────────     ──────────    ─────────│
  │  收 30%        收 40%          收 20%        收 10%  │
  │  3 万          4 万            2 万           1 万   │
  │                                                      │
  │  如果只完成了"签约"和"交付"两步：                      │
  │  · 报价 = 10 万                                      │
  │  · 已收 = 7 万（3万 + 4万）                           │
  │  · 待收 = 3 万（2万 + 1万）                           │
  │  · 回款率 = 70%                                      │
  └──────────────────────────────────────────────────┘
```

**没有 Payment 模型，就无法区分"报价"和"到手"，现金流管理就是盲的。**

---

## 二、数据模型设计

### Payment 表结构

```prisma
// backend/prisma/schema.prisma → 新增模型

model Payment {
  id          String   @id @default(cuid())
  amount      Int                              // 金额（分），与项目 budget 口径一致
  type        String                           // 回款类型（见下方枚举）
  method      String?                          // 到账方式
  receivedAt  DateTime                         // 实际到账日期（核心字段）
  note        String?                          // 备注（如"尾款-合同编号XXX"）
  projectId   String                           // 关联项目
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])                         // 按项目查回款
  @@index([projectId, receivedAt])             // 按项目+日期范围查
}
```

### 回款类型枚举（`type` 字段）

| 值 | 含义 | 典型比例 |
|---|---|---|
| `DOWN_PAYMENT` | 预付款 / 定金 | 20%-30% |
| `PROGRESS` | 进度款 / 中期款 | 30%-40% |
| `FINAL` | 尾款 / 验收款 | 20%-30% |
| `ADJUSTMENT` | 增减项调整 | 不定 |
| `OTHER` | 其他（如违约金、补偿等） | 不定 |

### 到账方式枚举（`method` 字段，可选）

| 值 | 含义 |
|---|---|
| `BANK_TRANSFER` | 银行转账 |
| `ALIPAY` | 支付宝 |
| `WECHAT` | 微信 |
| `CASH` | 现金 |
| `CHECK` | 支票 |
| `OTHER` | 其他 |

### 与 Project 的关系

```
Project（项目）
  ├── budget: 100000         ← 报价（合同金额）
  ├── payments: Payment[]    ← 回款记录（新增）
  │     ├── Payment { amount: 30000, type: DOWN_PAYMENT, receivedAt: "2026-01-15" }
  │     ├── Payment { amount: 40000, type: PROGRESS,     receivedAt: "2026-03-20" }
  │     └── Payment { amount: 20000, type: FINAL,        receivedAt: "2026-06-01" }
  │
  ├── 统计计算:
  │     已收 = sum(payments.amount) = 90,000
  │     待收 = budget - 已收        = 10,000
  │     回款率 = 已收 / budget       = 90%
  │
  └── tasks / costRecords / timeEntries ...（已有）
```

---

## 三、统计计算方式

### 3.1 单项目的回款统计

这是最基础的统计单元，其他所有统计都建立在此之上：

```
┌─────────────────────────────────────────┐
│           项目 A 回款统计                  │
├─────────────────────────────────────────┤
│  报价(budget)        ¥100,000           │
│  已收(received)       ¥90,000           │  ← sum(payments.amount)
│  待收(receivable)     ¥10,000           │  ← budget - received
│  回款率               90%               │  ← received / budget × 100
├─────────────────────────────────────────┤
│  回款明细:                               │
│  · 2026-01-15  预付款    ¥30,000  银行转账│
│  · 2026-03-20  进度款    ¥40,000  银行转账│
│  · 2026-06-01  尾款      ¥20,000  支付宝  │
└─────────────────────────────────────────┘
```

**后端计算代码：**

```typescript
// 单项目回款统计
async function getProjectPaymentSummary(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: userId },
    select: {
      id: true,
      name: true,
      budget: true,
      status: true,
      payments: {
        orderBy: { receivedAt: 'asc' },
        select: { id: true, amount: true, type: true, method: true, receivedAt: true, note: true },
      },
    },
  });

  if (!project) return null;

  const budget = project.budget ?? 0;
  const received = project.payments.reduce((sum, p) => sum + p.amount, 0);
  const receivable = Math.max(0, budget - received);
  const rate = budget > 0 ? Math.round((received / budget) * 1000) / 10 : 0;

  return {
    project: { id: project.id, name: project.name, status: project.status },
    budget,
    received,
    receivable,
    rate,            // 回款率 %
    payments: project.payments,  // 明细列表
  };
}
```

### 3.2 全局应收账款统计

所有未结清项目的待收汇总，是经营看板的核心数据：

```
┌─────────────────────────────────────────────────────┐
│              应收账款总览                               │
├──────────┬────────┬────────┬────────┬────────┬───────┤
│  项目     │  报价   │  已收   │  待收   │ 回款率  │ 状态  │
├──────────┼────────┼────────┼────────┼────────┼───────┤
│  项目 A   │ 10万   │  9万   │  1万   │  90%   │ 进行中│
│  项目 B   │  8万   │  2.4万 │  5.6万 │  30%   │ 进行中│
│  项目 C   │  5万   │  5万   │  0     │ 100%   │ 已完成│  ← 不显示（已结清）
├──────────┼────────┼────────┼────────┼────────┼───────┤
│  合计     │ 18万   │ 16.4万 │  6.6万 │        │       │
└──────────┴────────┴────────┴────────┴────────┴───────┘

只显示 receivable > 0 的项目（未结清的）
```

**后端计算代码：**

```typescript
// 全局应收账款（只返回未结清项目）
async function getReceivables(userId: string) {
  const projects = await prisma.project.findMany({
    where: {
      ownerId: userId,
      status: { not: 'ARCHIVED' },  // 归档项目不计入
    },
    select: {
      id: true,
      name: true,
      budget: true,
      status: true,
      endDate: true,
      payments: { select: { amount: true } },
    },
  });

  const list = projects
    .map(p => {
      const budget = p.budget ?? 0;
      const received = p.payments.reduce((s, pay) => s + pay.amount, 0);
      return {
        id: p.id,
        name: p.name,
        budget,
        received,
        receivable: Math.max(0, budget - received),
        rate: budget > 0 ? Math.round((received / budget) * 1000) / 10 : 0,
        status: p.status,
        endDate: p.endDate,
      };
    })
    .filter(p => p.receivable > 0)           // 只保留未结清的
    .sort((a, b) => b.receivable - a.receivable);  // 待收最多的排前面

  const totalBudget = list.reduce((s, p) => s + p.budget, 0);
  const totalReceived = list.reduce((s, p) => s + p.received, 0);
  const totalReceivable = list.reduce((s, p) => s + p.receivable, 0);

  return {
    list,
    summary: {
      projectCount: list.length,
      totalBudget,
      totalReceived,
      totalReceivable,
      overallRate: totalBudget > 0
        ? Math.round((totalReceived / totalBudget) * 1000) / 10
        : 0,
    },
  };
}
```

### 3.3 月度实际回款统计（替换仪表盘"本月入款"）

当前仪表盘用 `COMPLETED 项目的 budget` 当收入，应改为**本月实际到账金额**：

```
当前（错误）：
  本月入款 = 本月标记"完成"的项目预算合计
  → 项目完成 ≠ 钱到账

改为（正确）：
  本月入款 = sum(payments where receivedAt in 本月)
  → 真实到账时间，真实金额
```

**后端计算代码：**

```typescript
// 本月实际回款
async function getMonthlyReceived(userId: string, period?: string, type?: string) {
  const { start, end } = parseRange(period, type || 'month');

  const agg = await prisma.payment.aggregate({
    where: {
      project: { ownerId: userId },
      receivedAt: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });

  return agg._sum.amount || 0;
}
```

### 3.4 按回款类型统计（饼图数据）

看回款结构——预付款占比多少、尾款回收情况如何：

```
回款结构:
  ┌───────────────────────┐
  │  预付款  ¥30,000  33%  │  ████████
  │  进度款  ¥40,000  44%  │  ███████████
  │  尾款    ¥20,000  22%  │  ██████
  │  调整    ¥ 1,000   1%  │  ▎
  └───────────────────────┘
```

```typescript
async function getPaymentStructure(userId: string, period?: string, type?: string) {
  const { start, end } = parseRange(period, type || 'month');

  const payments = await prisma.payment.findMany({
    where: {
      project: { ownerId: userId },
      receivedAt: { gte: start, lte: end },
    },
    select: { type: true, amount: true },
  });

  const byType: Record<string, number> = {};
  let total = 0;
  for (const p of payments) {
    byType[p.type] = (byType[p.type] || 0) + p.amount;
    total += p.amount;
  }

  const labels: Record<string, string> = {
    DOWN_PAYMENT: '预付款',
    PROGRESS: '进度款',
    FINAL: '尾款',
    ADJUSTMENT: '调整',
    OTHER: '其他',
  };

  return Object.entries(byType).map(([type, amount]) => ({
    type: labels[type] || type,
    amount,
    percent: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
  }));
}
```

### 3.5 回款趋势（月度折线）

最近 6 个月的回款走势，看现金流是向好还是恶化：

```typescript
async function getPaymentTrends(userId: string) {
  const now = new Date();
  const months: { label: string; start: Date; end: Date }[] = [];

  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    months.push({
      label: `${start.getMonth() + 1}月`,
      start,
      end,
    });
  }

  const results = await Promise.all(
    months.map(async ({ label, start, end }) => {
      const agg = await prisma.payment.aggregate({
        where: {
          project: { ownerId: userId },
          receivedAt: { gte: start, lte: end },
        },
        _sum: { amount: true },
      });
      return { month: label, received: agg._sum.amount || 0 };
    }),
  );

  return results;
}
```

### 3.6 逾期应收预警

哪些项目的待收款已经逾期（超过预期回款时间）：

```typescript
async function getOverdueReceivables(userId: string) {
  const projects = await prisma.project.findMany({
    where: {
      ownerId: userId,
      status: 'ACTIVE',  // 只看进行中的
    },
    select: {
      id: true,
      name: true,
      budget: true,
      endDate: true,
      payments: { select: { amount: true } },
    },
  });

  const now = new Date();

  return projects
    .map(p => {
      const budget = p.budget ?? 0;
      const received = p.payments.reduce((s, pay) => s + pay.amount, 0);
      const receivable = budget - received;
      return {
        id: p.id,
        name: p.name,
        receivable,
        endDate: p.endDate,
        isOverdue: p.endDate ? p.endDate < now : false,
      };
    })
    .filter(p => p.receivable > 0 && p.isOverdue)
    .sort((a, b) => b.receivable - a.receivable);
}
```

---

## 四、统计维度汇总

所有统计的数据来源和计算公式一览：

```
                    ┌──────────────────────────────────┐
                    │        Payment 表                  │
                    │  (amount, type, receivedAt,        │
                    │   method, projectId)               │
                    └──────────────┬───────────────────┘
                                   │
           ┌───────────────────────┼────────────────────────┐
           │                       │                        │
           ▼                       ▼                        ▼
   ┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
   │ 项目级统计     │     │ 时间段统计         │     │ 预警类统计         │
   │              │     │                  │     │                  │
   │ · 已收金额    │     │ · 月度回款总额     │     │ · 逾期应收         │
   │ · 待收金额    │     │ · 回款类型分布     │     │ · 回款率 < 50%     │
   │ · 回款率      │     │ · 回款月度趋势     │     │ · 超3月未回款       │
   └──────────────┘     └──────────────────┘     └──────────────────┘
           │                       │                        │
           ▼                       ▼                        ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                    经营看板 / 仪表盘展示                        │
   │                                                              │
   │  仪表盘:                                                     │
   │    · KPI "本月入款" → getMonthlyReceived()（替换原 budget 逻辑）│
   │    · KPI "待收总额" → getReceivables().summary.totalReceivable│
   │                                                              │
   │  经营看板:                                                    │
   │    · 收入 = getMonthlyReceived() （真实到账）                  │
   │    · 应收账款列表 → getReceivables()                          │
   │    · 回款趋势图 → getPaymentTrends()                          │
   │    · 逾期预警 → getOverdueReceivables()                      │
   │                                                              │
   │  项目详情页:                                                   │
   │    · 回款进度条 → getProjectPaymentSummary()                  │
   │    · 回款明细列表 → payments[]                                │
   │    · 录入回款按钮 → createPayment()                           │
   └──────────────────────────────────────────────────────────────┘
```

---

## 五、用户操作流程

### 5.1 录入回款（在项目详情页）

```
用户场景：
  客户说"预付款 3 万已经转了"，你需要记录下来。

操作路径：
  项目详情页 → 回款记录卡片 → 点击"录入回款"按钮

弹出表单：
  ┌──────────────────────────────────┐
  │  录入回款                          │
  ├──────────────────────────────────┤
  │  金额 *     [  30000  ] 元        │
  │  类型 *     [ 预付款 ▾ ]          │
  │  到账日期 *  [ 2026-06-12 ]       │
  │  到账方式    [ 银行转账 ▾ ]        │
  │  备注       [ 合同首付款 ]         │
  │                                  │
  │  [取消]              [确认录入]    │
  └──────────────────────────────────┘

提交后：
  1. 创建 Payment 记录
  2. 刷新项目详情的回款进度
  3. 仪表盘"本月入款"数字更新
  4. 经营看板"应收账款"列表更新
```

### 5.2 查看应收账款（经营看板）

```
用户场景：
  月底了，想知道还有多少钱没收回来。

操作路径：
  侧边栏 → 经营看板 → 应收账款模块

展示内容：
  · 应收总额（大字）
  · 未结清项目列表（按待收金额降序）
  · 每个项目显示：报价 / 已收 / 待收 / 回款率
  · 逾期项目红色高亮
```

### 5.3 项目详情中的回款进度

```
在项目详情页，报价旁边显示回款进度条：

  报价 ¥100,000
  ████████████████████░░░░  90%  已收 ¥90,000
                                            待收 ¥10,000

  回款明细：
  · 01/15  预付款   ¥30,000  银行转账
  · 03/20  进度款   ¥40,000  银行转账
  · 06/01  尾款     ¥20,000  支付宝
  · [+ 录入回款]
```

---

## 六、与现有系统的对接点

### 6.1 替换仪表盘"本月入款"

```
// 改前（dashboard.service.ts）
monthlyIncome = COMPLETED projects' budget sum this month    ← ❌ 报价≠回款

// 改后
monthlyReceived = sum(payments where receivedAt in this month) ← ✅ 实际到账
```

### 6.2 替换经营看板"收入"

```
// 改前（report.service.ts → getOverview）
income = COMPLETED projects' budget sum in period    ← ❌

// 改后
income = sum(payments where receivedAt in period)    ← ✅
```

### 6.3 经营看板新增模块

在经营看板（`/reports`）页面增加一个"应收账款"模块，放在"工时分析"和"AI 解读"之间。

### 6.4 AI 解读增强

经营看板的 AI 解读 prompt 中，增加回款数据：

```
当前 prompt：
  收入 ¥xx，支出 ¥xx，利润率 xx%...

增强后：
  收入(实际回款) ¥xx，支出 ¥xx，利润率 xx%...
  应收账款 ¥xx（xx 个项目未结清），回款率 xx%...
```

### 6.5 Morning Briefing 增强

早报中增加回款提醒：

```
📋 今日早报
...

💰 回款提醒：
  · 项目A 待收 ¥10,000，已超过预期回款日
  · 项目B 待收 ¥56,000，建议本周跟进
```

---

## 七、文件清单

实现回款系统需要新增和修改的文件：

### 新增文件（5 个）

| 文件 | 用途 |
|---|---|
| `backend/src/validators/payment.schema.ts` | Zod 校验 schema |
| `backend/src/services/payment.service.ts` | 回款业务逻辑 |
| `backend/src/routes/payment.routes.ts` | 回款 API 路由 |
| `frontend/src/hooks/usePayments.ts` | React Query hooks |
| `frontend/src/components/features/payments/PaymentForm.tsx` | 录入回款表单 |
| `frontend/src/components/features/payments/PaymentList.tsx` | 回款明细列表 |

### 修改文件（6 个）

| 文件 | 改动 |
|---|---|
| `backend/prisma/schema.prisma` | 新增 Payment 模型 + Project 加 payments 关联 |
| `backend/src/routes/index.ts` | 注册 payment 路由（⚠️ 唯一共享文件，加 import 即可） |
| `backend/src/services/dashboard.service.ts` | "本月入款"改用 getMonthlyReceived |
| `backend/src/services/report.service.ts` | "收入"改用 getMonthlyReceived |
| `frontend/src/app/main/dashboard/page.tsx` | 新增"待收总额" KPI 卡片 |
| `frontend/src/app/main/reports/page.tsx` | 新增"应收账款"模块 |

---

## 八、统计公式速查表

| 指标 | 公式 | 数据来源 |
|---|---|---|
| 项目已收 | `sum(project.payments.amount)` | Payment 表 |
| 项目待收 | `project.budget - 已收` | Project + Payment |
| 项目回款率 | `已收 / budget × 100%` | 计算值 |
| 本月回款 | `sum(payments where receivedAt in 本月)` | Payment 表 |
| 应收总额 | `sum(所有未结清项目的待收)` | Payment + Project |
| 整体回款率 | `全局已收 / 全局报价 × 100%` | 计算值 |
| 回款类型分布 | `groupBy(type).sum(amount)` | Payment 表 |
| 月度回款趋势 | `按月 groupBy receivedAt` | Payment 表 |
| 逾期应收 | `待收>0 且 endDate < today` | Payment + Project |

所有金额单位：**分（Int）**，前端 `÷ 100` 显示为元，与现有 budget/costRecord 口径一致。
