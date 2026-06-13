# 财务管理体系完整设计

> 文档日期：2026-06-12
> 涉及范围：全系统所有涉及"钱"的模块
> 核心目标：独立工作者/一人公司的完整财务管理闭环

---

## 目录

- [一、现状审计：全系统的钱怎么算的](#一现状审计全系统的钱怎么算的)
- [二、发现的 10 个问题](#二发现的-10-个问题)
- [三、新财务体系总架构](#三新财务体系总架构)
- [四、新增模型详细设计](#四新增模型详细设计)
  - [4.1 Payment（回款记录）](#41-payment回款记录)
  - [4.2 Invoice（发票/形式发票）](#42-invoice发票形式发票)
  - [4.3 Transaction（收支流水）](#43-transaction收支流水)
  - [4.4 Subscription（订阅管理）](#44-subscription订阅管理)
- [五、统一计算逻辑](#五统一计算逻辑)
- [六、看板展示方案](#六看板展示方案)
- [七、文件变更清单](#七文件变更清单)

---

## 一、现状审计：全系统的钱怎么算的

### 当前数据模型

```
数据库中的"钱"只有 3 个来源：

  Project.budget (Int, 分)     → 项目报价/预算
  CostRecord.amount (Int, 分)  → 项目过程中的花销明细
  Task.cost (Int, 分)          → 任务的花销（从 CostRecord 聚合）
```

### 当前"收入"的 5 种算法（全部不一致）

| 位置 | "收入"怎么算的 | 时间过滤 | 问题 |
|---|---|---|---|
| `dashboard.service.ts` getStats | COMPLETED 项目的 budget | `updatedAt >= 月初` | 用 updatedAt 不准确 |
| `report.service.ts` getOverview | COMPLETED 项目的 budget | `updatedAt in period` | 同上 |
| `report.service.ts` getProjectRanking | 所有项目的 budget | 无 | 算的是报价，不是收入 |
| `get-cash-flow.ts` (AI工具) | 项目的 budget | `endDate in month` | 用 endDate，与其他都不同 |
| `get-revenue-by-client.ts` (AI工具) | 客户下项目的 budget | `createdAt` | 用 createdAt，又不同 |

**同一个项目，在 5 个地方可能算出 5 个不同的"收入"数字。**

### 当前"成本"的 4 种算法

| 位置 | "成本"怎么算的 | 包含 Task.cost? | 时间过滤 |
|---|---|---|---|
| `dashboard.service.ts` | CostRecord + Task.cost | ✅ 是 | ❌ 无（全量） |
| `report.service.ts` getCostStructure | CostRecord + Task.cost | ✅ 是 | ✅ 按 period |
| `cost.service.ts` getSummaryByProject | CostRecord + Task.cost | ✅ 是 | ❌ 无（全量） |
| `customer.service.ts` batchProjectStats | 仅 CostRecord | ❌ 缺 Task.cost | ❌ 无（全量） |
| `get-cash-flow.ts` (AI工具) | 仅 CostRecord | ❌ 缺 Task.cost | ✅ 按 month |
| `get-cost-breakdown.ts` (AI工具) | 仅 CostRecord | ❌ 缺 Task.cost | ✅ 按 month |

**成本有时包含 Task.cost，有时不包含。数字必然对不上。**

### 当前"利润"的 3 种算法

| 位置 | 公式 | 问题 |
|---|---|---|
| `dashboard.service.ts` | 本月收入 - **全量**成本 | 口径错配，数字无意义 |
| `report.service.ts` | 同期收入 - 同期成本 | ✅ 唯一正确的 |
| `get-goal-progress.ts` | 全量预算 - 可能按月的成本 | 口径错配 |

---

## 二、发现的 10 个问题

### 🔴 严重（影响决策准确性）

| # | 问题 | 位置 | 影响 |
|---|---|---|---|
| 1 | 仪表盘利润 = 本月收入 - 全量历史成本 | `dashboard.service.ts:36-47` | 利润数字完全失真 |
| 2 | 项目排行的成本没有按时间过滤 | `report.service.ts:98-101` | 项目利润率失真 |
| 3 | 用 `updatedAt` 判断收入归属月份 | `dashboard/report service` | 改个名字就算当月收入 |

### 🟡 中等（数据不一致）

| # | 问题 | 位置 | 影响 |
|---|---|---|---|
| 4 | 客户统计只算 CostRecord 不算 Task.cost | `customer.service.ts:16-21` | 客户页成本比项目页少 |
| 5 | AI 现金流工具用 `endDate` 判断收入 | `get-cash-flow.ts:13` | 与其他模块算法不同 |
| 6 | AI 工具普遍不算 Task.cost | 多个 AI tool | AI 分析的成本偏低 |
| 7 | SmartDigest 读取了不存在的字段名 | `SmartDigest.tsx:51-52` | 侧边栏财务数据永远为 0 |
| 8 | 目标系统用全量预算 vs 按月成本 | `get-goal-progress.ts:61-69` | 目标进度失真 |

### 🟢 轻度（代码质量）

| # | 问题 | 位置 | 影响 |
|---|---|---|---|
| 9 | Task.cost 时间字段不统一（createdAt/completedAt/updatedAt） | 多处 | 同一笔成本在不同月份 |
| 10 | 利润率精度不统一（*1000/10 vs *100） | 多处 | 小数位不一致 |

---

## 三、新财务体系总架构

### 数据模型全景

```
┌─────────────────────────────────────────────────────────────────┐
│                        钱进来的记录                               │
│                                                                   │
│   ┌──────────────┐     ┌──────────────────┐                      │
│   │   Payment     │     │   Transaction    │                      │
│   │  （项目回款）   │     │  （非项目收入）    │                      │
│   │               │     │  direction=INCOME │                     │
│   │  关联 Project │     │  无 Project 关联   │                     │
│   └──────┬───────┘     └────────┬─────────┘                      │
│          │                      │                                 │
│          └──────────┬───────────┘                                 │
│                     ▼                                             │
│          真实收入 = Payment + Transaction(INCOME)                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        钱出去的记录                               │
│                                                                   │
│   ┌──────────────┐     ┌──────────────────┐                      │
│   │  CostRecord   │     │   Transaction    │                      │
│   │ （项目支出）    │     │ （非项目支出）     │                     │
│   │               │     │ direction=EXPENSE │                     │
│   │ 关联 Project  │     │  无 Project 关联   │                     │
│   │ + Task        │     │                   │                     │
│   └──────┬───────┘     └────────┬─────────┘                      │
│          │                      │                                 │
│          └──────────┬───────────┘                                 │
│                     ▼                                             │
│          真实支出 = CostRecord + Transaction(EXPENSE)             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        应收与发票                                 │
│                                                                   │
│   ┌──────────────┐     ┌──────────────────┐                      │
│   │   Invoice     │     │   ARReminder     │                      │
│   │ （发票/报价单） │────→│  （催款提醒）      │                     │
│   │               │     │                   │                     │
│   │ 关联 Project  │     │ 关联 Invoice       │                     │
│   └──────────────┘     └──────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        固定成本                                   │
│                                                                   │
│   ┌──────────────────┐                                           │
│   │   Subscription    │                                           │
│   │ （订阅/SaaS管理）  │                                           │
│   │                   │                                           │
│   │ 周期: 月付/年付    │                                           │
│   │ 到期提醒: 自动      │                                           │
│   │ 自动记 Transaction │ ← 到期时自动创建支出记录                    │
│   └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │    汇总计算       │
                    │                 │
                    │ 真实收入          │ = Payment.sum + Transaction(INCOME).sum
                    │ 真实支出          │ = CostRecord.sum + Transaction(EXPENSE).sum
                    │ 真实利润          │ = 真实收入 - 真实支出
                    │ 应收账款          │ = Project.budget - Payment.sum（未结清的）
                    │ 固定成本          │ = Subscription（active）.amount/月
                    │ 现金流趋势        │ = 按月聚合 收入-支出
                    └─────────────────┘
```

---

## 四、新增模型详细设计

### 4.1 Payment（回款记录）

> 详细方案见 `docs/payment-system-design.md`，此处为精简版。

```prisma
model Payment {
  id          String   @id @default(cuid())
  amount      Int                              // 金额（分）
  type        String                           // DOWN_PAYMENT / PROGRESS / FINAL / ADJUSTMENT / OTHER
  method      String?                          // BANK_TRANSFER / ALIPAY / WECHAT / CASH / OTHER
  receivedAt  DateTime                         // 实际到账日期
  note        String?                          // 备注
  projectId   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@index([projectId, receivedAt])
}
```

**核心计算：**
```
项目已收 = sum(project.payments.amount)
项目待收 = project.budget - 项目已收
项目回款率 = 项目已收 / project.budget × 100%
```

---

### 4.2 Invoice（发票/形式发票）

独立工作者最怕"干了活收不到钱"。Invoice 模块管理：
- 开具形式发票（Proforma Invoice）或正式发票
- 跟踪发票状态（待付款 → 已付款 → 逾期）
- 导出 PDF 给客户
- 催款提醒

```prisma
model Invoice {
  id            String   @id @default(cuid())
  invoiceNo     String                          // 发票编号，如 INV-2026-001
  projectId     String?                         // 关联项目（可选）
  customerId    String?                         // 关联客户（可选）
  status        String   @default("DRAFT")      // DRAFT / SENT / PAID / OVERDUE / CANCELLED
  type          String   @default("PROFORMA")   // PROFORMA(形式发票) / TAX(正式发票)

  // 金额
  subtotal      Int                             // 小计（分）
  taxRate       Float    @default(0)            // 税率，如 0.06 = 6%
  taxAmount     Int      @default(0)            // 税额（分）
  totalAmount   Int                             // 总金额（分）= subtotal + taxAmount

  // 客户信息（开票时快照，不随客户资料变更）
  clientName    String                          // 客户名称
  clientCompany String?                         // 客户公司
  clientEmail   String?                         // 客户邮箱
  clientAddress String?                         // 客户地址

  // 日期
  issuedAt      DateTime                        // 开票日期
  dueAt         DateTime                        // 付款截止日期
  paidAt        DateTime?                       // 实际付款日期

  // 内容
  items         String                          // JSON: [{description, quantity, unitPrice, amount}]
  notes         String?                         // 备注/付款说明

  userId        String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  project       Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
  customer      Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  payments      InvoicePayment[]

  @@unique([userId, invoiceNo])
  @@index([userId, status])
  @@index([userId, dueAt])
  @@index([projectId])
  @@index([customerId])
}

// 发票-回款关联表（一张发票可以分多次付款）
model InvoicePayment {
  id          String   @id @default(cuid())
  invoiceId   String
  paymentId   String                           // 关联 Payment 记录
  amount      Int                              // 本次关联金额（分）
  createdAt   DateTime @default(now())
  invoice     Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId])
}
```

**发票状态流转：**

```
DRAFT（草稿）
  │  用户确认发出
  ▼
SENT（已发送）         ← 开始计算账期
  │                    │
  │  收到回款           │  超过 dueAt 未收到
  ▼                    ▼
PAID（已付款）     OVERDUE（逾期）  ← 触发催款提醒
                      │
                      │  收到回款
                      ▼
                  PAID（已付款）
```

**发票条目 JSON 格式：**

```json
[
  {
    "description": "网站UI设计 - 首页",
    "quantity": 1,
    "unitPrice": 500000,
    "amount": 500000
  },
  {
    "description": "网站UI设计 - 内页×5",
    "quantity": 5,
    "unitPrice": 200000,
    "amount": 1000000
  }
]
```

**PDF 导出方案：**

```
方案 A（推荐）：前端生成
  · 用 @react-pdf/renderer 或 jspdf
  · 纯前端，不需要后端渲染
  · 数据从 API 拿，PDF 在浏览器中生成
  · 支持直接浏览器打印或下载

方案 B：后端生成
  · 用 puppeteer 或 pdf-lib
  · 后端渲染 HTML → PDF
  · 适合需要盖章/水印的场景
```

**核心统计：**
```
发票总额  = sum(invoices.totalAmount)
已开票未收 = sum(invoices where status=SENT/OVERDUE).totalAmount
逾期金额  = sum(invoices where status=OVERDUE).totalAmount
逾期天数  = today - dueAt（按发票逐笔算）
```

---

### 4.3 Transaction（收支流水）

记录所有**非项目相关**的收入和支出。

```prisma
model Transaction {
  id          String   @id @default(cuid())
  amount      Int                              // 金额（分），始终正数
  direction   String                           // INCOME（收入） / EXPENSE（支出）
  category    String                           // 收支类别
  description String                           // 描述
  date        DateTime                         // 发生日期
  receipt     String?                          // 凭证/收据图片 URL
  subscriptionId String?                       // 关联订阅（如果是订阅自动生成的）
  note        String?                          // 备注
  userId      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  subscription Subscription? @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)

  @@index([userId, direction])
  @@index([userId, date])
  @@index([userId, direction, category])
  @@index([subscriptionId])
}
```

**收支类别设计：**

```
收入类（direction = INCOME）:
  INTEREST      — 利息/理财收益
  REFUND        — 退款/返佣
  SUBSIDY       — 补贴/奖金
  ASSET_SALE    — 资产出售
  FREELANCE     — 非项目兼职收入
  OTHER_INCOME  — 其他收入

支出类（direction = EXPENSE）:
  RENT          — 房租/物业/水电
  SALARY        — 工资/社保/公积金（如有雇员）
  SOFTWARE      — 软件订阅/SaaS/服务器    ← 由 Subscription 自动生成
  EQUIPMENT     — 设备采购/办公用品
  TRAVEL        — 差旅/交通
  MEAL          — 餐饮/招待
  TAX           — 税费
  MARKETING     — 推广/广告
  INSURANCE     — 保险
  OTHER_EXPENSE — 其他支出
```

**操作场景：**

```
场景 1：手动录入
  "交了 6 月房租 8000 元"
  → Transaction { direction: EXPENSE, category: RENT, amount: 800000, date: 2026-06-01 }

场景 2：订阅自动生成
  "ChatGPT Plus 月付 20 刀"
  → Subscription 记录一次
  → 每月到期时自动创建 Transaction { direction: EXPENSE, category: SOFTWARE, amount: ... }

场景 3：非项目收入
  "卖了一台旧显示器"
  → Transaction { direction: INCOME, category: ASSET_SALE, amount: 50000 }
```

---

### 4.4 Subscription（订阅管理）

一人公司会订阅大量 SaaS 服务，这些是"隐形失血"——每个月自动扣费，但没人专门记。

```prisma
model Subscription {
  id            String   @id @default(cuid())
  name          String                          // 服务名称，如 "ChatGPT Plus"
  category      String                          // SOFTWARE / CLOUD / DOMAIN / TOOL / MEDIA / OTHER
  amount        Int                             // 每期金额（分）
  currency      String   @default("CNY")        // CNY / USD / EUR
  cycle         String                          // MONTHLY / QUARTERLY / YEARLY
  startDate     DateTime                        // 首次订阅日期
  nextBillingAt DateTime                        // 下次扣费日期
  status        String   @default("ACTIVE")     // ACTIVE / PAUSED / CANCELLED
  autoRenew     Boolean  @default(true)         // 是否自动续费
  url           String?                         // 服务官网
  note          String?                         // 备注（如账号、用途说明）
  userId        String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions Transaction[]

  @@index([userId, status])
  @@index([userId, nextBillingAt])
}
```

**订阅类别：**

```
SOFTWARE  — 开发工具、设计工具、AI 服务（Cursor、Figma、ChatGPT）
CLOUD     — 服务器、CDN、数据库托管（AWS、Vercel、PlanetScale）
DOMAIN    — 域名注册、SSL 证书
TOOL      — 效率工具（Notion、飞书、钉钉）
MEDIA     — 素材库、字体库、音乐库
OTHER     — 其他
```

**月度成本计算：**

```typescript
// 将不同周期统一换算成月均
function monthlyCost(sub: Subscription): number {
  switch (sub.cycle) {
    case 'MONTHLY':   return sub.amount;
    case 'QUARTERLY': return Math.round(sub.amount / 3);
    case 'YEARLY':    return Math.round(sub.amount / 12);
    default:          return sub.amount;
  }
}

// 所有活跃订阅的月度总成本
const totalMonthly = subscriptions
  .filter(s => s.status === 'ACTIVE')
  .reduce((sum, s) => sum + monthlyCost(s), 0);
```

**到期提醒（定时任务）：**

```typescript
// cron-job: 每天 09:00 检查即将到期的订阅
async function checkSubscriptionRenewals(userId: string) {
  const in3Days = new Date();
  in3Days.setDate(in3Days.getDate() + 3);

  const upcoming = await prisma.subscription.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      nextBillingAt: { lte: in3Days },
    },
  });

  if (upcoming.length > 0) {
    // 发送通知：以下订阅即将扣费
    // · ChatGPT Plus ¥140 — 3天后扣费
    // · Vercel Pro ¥140 — 1天后扣费
  }
}
```

**扣费自动记录：**

```typescript
// 当订阅到期扣费时，自动创建支出记录
async function recordSubscriptionPayment(subscription: Subscription) {
  await prisma.transaction.create({
    data: {
      amount: subscription.amount,
      direction: 'EXPENSE',
      category: 'SOFTWARE',
      description: `${subscription.name} - ${subscription.cycle === 'MONTHLY' ? '月费' : '续费'}`,
      date: new Date(),
      subscriptionId: subscription.id,
      userId: subscription.userId,
    },
  });

  // 更新下次扣费日期
  const next = new Date(subscription.nextBillingAt);
  switch (subscription.cycle) {
    case 'MONTHLY':   next.setMonth(next.getMonth() + 1); break;
    case 'QUARTERLY': next.setMonth(next.getMonth() + 3); break;
    case 'YEARLY':    next.setFullYear(next.getFullYear() + 1); break;
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { nextBillingAt: next },
  });
}
```

---

## 五、统一计算逻辑

### 5.1 核心原则

**所有涉及"钱"的计算，必须遵循以下规则：**

```
规则 1：时间口径统一
  收入和成本必须在同一个时间段内比较
  绝不允许"本月收入 - 全量成本"

规则 2：收入 = 实际到账
  收入 = Payment.sum（项目回款）+ Transaction(INCOME).sum（其他收入）
  不再用 Project.budget 代替收入

规则 3：成本 = 全口径
  项目成本 = CostRecord.sum（项目花销）
  运营成本 = Transaction(EXPENSE).sum（非项目支出）
  总成本 = 项目成本 + 运营成本

规则 4：统一使用同一时间字段
  项目收入归属 → Payment.receivedAt（实际到账日）
  成本归属    → CostRecord.date（发生日）
  不混用 updatedAt / createdAt / completedAt

规则 5：金额统一为分（Int）
  后端全用分，前端 ÷100 显示
  利润率精度统一：Math.round(profit / income * 1000) / 10（保留1位小数）
```

### 5.2 统一计算函数

建议抽取一个 `finance.service.ts` 作为全系统唯一的财务计算入口：

```typescript
// backend/src/services/finance.service.ts

import { prisma } from '../server';

interface DateRange { start: Date; end: Date }

/**
 * 全系统唯一的财务汇总函数
 * 所有需要"收入/支出/利润"的地方都调这个
 */
export async function getFinancialSummary(userId: string, range: DateRange) {
  const { start, end } = range;

  const [
    // 第一层：项目相关
    paymentAgg,        // 项目回款（真实收入）
    costRecordAgg,     // 项目支出
    // 第二层：非项目相关
    incomeAgg,         // 非项目收入
    expenseAgg,        // 非项目支出
    // 应收账款
    receivableProjects,
  ] = await Promise.all([
    // ① 项目回款：Payment.receivedAt in range
    prisma.payment.aggregate({
      where: {
        project: { ownerId: userId },
        receivedAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),

    // ② 项目支出：CostRecord.date in range
    prisma.costRecord.aggregate({
      where: {
        project: { ownerId: userId },
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),

    // ③ 非项目收入：Transaction(INCOME).date in range
    prisma.transaction.aggregate({
      where: {
        userId,
        direction: 'INCOME',
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),

    // ④ 非项目支出：Transaction(EXPENSE).date in range
    prisma.transaction.aggregate({
      where: {
        userId,
        direction: 'EXPENSE',
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),

    // ⑤ 应收账款：Project.budget - Payment.sum > 0 的项目
    prisma.project.findMany({
      where: { ownerId: userId, status: { not: 'ARCHIVED' } },
      select: {
        id: true,
        name: true,
        budget: true,
        payments: { select: { amount: true } },
      },
    }),
  ]);

  // === 汇总计算 ===

  const projectIncome  = paymentAgg._sum.amount || 0;       // 项目回款
  const projectCost    = costRecordAgg._sum.amount || 0;     // 项目支出
  const otherIncome    = incomeAgg._sum.amount || 0;         // 其他收入
  const otherExpense   = expenseAgg._sum.amount || 0;        // 其他支出

  const totalIncome    = projectIncome + otherIncome;        // 真实总收入
  const totalExpense   = projectCost + otherExpense;         // 真实总支出
  const profit         = totalIncome - totalExpense;         // 真实利润
  const margin         = totalIncome > 0
    ? Math.round((profit / totalIncome) * 1000) / 10        // 利润率（1位小数）
    : 0;

  // 应收账款
  const receivables = receivableProjects
    .map(p => {
      const budget = p.budget ?? 0;
      const received = p.payments.reduce((s, pay) => s + pay.amount, 0);
      return {
        id: p.id,
        name: p.name,
        budget,
        received,
        receivable: Math.max(0, budget - received),
      };
    })
    .filter(p => p.receivable > 0);

  const totalReceivable = receivables.reduce((s, p) => s + p.receivable, 0);

  return {
    // 收入
    income: {
      total: totalIncome,
      project: projectIncome,
      other: otherIncome,
    },
    // 支出
    expense: {
      total: totalExpense,
      project: projectCost,
      other: otherExpense,
    },
    // 利润
    profit,
    margin,
    // 应收
    receivables,
    totalReceivable,
  };
}
```

### 5.3 各模块如何调用统一函数

```
仪表盘（dashboard）:
  getFinancialSummary(userId, { start: 本月1日, end: 今天 })
  → 本月入款 = income.total
  → 本月支出 = expense.total
  → 本月利润 = profit

经营看板（reports）:
  getFinancialSummary(userId, { start: 选定期间开始, end: 选定期间结束 })
  → 收入 / 支出 / 毛利 / 利润率

早报（morning-briefing）:
  getFinancialSummary(userId, { start: 本月1日, end: 今天 })
  → AI 拿到的数字和仪表盘一致

周报（weekly-report）:
  getFinancialSummary(userId, { start: 本周一, end: 今天 })
  → 同一口径

AI 工具（get-profit-analysis 等）:
  不再各自写 Prisma 查询
  直接调用 getFinancialSummary()
  → 保证 AI 看到的数字和人类看到的完全一致

目标系统（goal REVENUE/PROFIT）:
  getFinancialSummary(userId, { start: goal.startDate, end: goal.endDate })
  → 目标进度基于真实回款，不是报价
```

### 5.4 修复后的数据流全景

```
              ┌─────────────────────────────────┐
              │     finance.service.ts            │
              │     getFinancialSummary()         │
              │                                   │
              │  输入: userId + 日期范围           │
              │  输出: 收入/支出/利润/应收          │
              └──────────┬──────────────────────┘
                         │
          ┌──────────────┼──────────────────┐
          │              │                  │
          ▼              ▼                  ▼
  ┌──────────────┐ ┌──────────┐ ┌──────────────────┐
  │ Payment      │ │CostRecord│ │ Transaction       │
  │ (项目回款)    │ │(项目支出) │ │ (非项目收支)       │
  └──────────────┘ └──────────┘ └──────────────────┘
          │              │                  │
          └──────────────┼──────────────────┘
                         │
          ┌──────────────┼──────────────────────┐
          ▼              ▼              ▼         ▼
      仪表盘         经营看板       早报/周报    AI工具
      (同一数字)     (同一数字)    (同一数字)   (同一数字)
```

**关键：从"每个模块自己算"变成"一个函数算了所有人用"。**

---

## 六、看板展示方案

### 6.1 仪表盘（改造后）

```
┌──────────────────────────────────────────────────────────────────┐
│  [日] [月✓] [年]    2026年6月                                     │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│ 进行中订单 │ 任务完成率 │ 本月入款   │ 本月支出   │ 本月利润   │ 逾期任务  │
│   3 个    │  78%     │ ¥132,000 │ ¥95,000  │ ¥37,000  │  2 个    │
│           │ 45/58    │ ↑12%环比 │ ↑5%环比  │ ↑18%环比 │ ⚠        │
├──────────┴──────────┴──────────┴──────────┴──────────┴──────────┤
│                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │  近6个月趋势          │  │  应收账款             │               │
│  │  📈 折线图            │  │  待收总额 ¥66,000     │               │
│  │  (收入/支出/利润)      │  │  项目B  ¥56,000  逾期 │               │
│  │                      │  │  项目A  ¥10,000       │               │
│  └─────────────────────┘  └─────────────────────┘               │
│                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │  订单进度             │  │  近期任务动态          │               │
│  └─────────────────────┘  └─────────────────────┘               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**变化点：**
- "本月入款" 改为 Payment 真实到账（不再是 budget）
- 新增"本月支出"和"本月利润"
- 每个 KPI 加环比变化率
- "任务闭环检查"替换为"应收账款"
- "客户跟进"替换为"近6个月趋势图"

### 6.2 经营看板（改造后）

```
┌──────────────────────────────────────────────────────────────────┐
│  [日] [月✓] [年]    2026年6月                                     │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│  真实收入  │  真实支出  │  真实利润  │  利润率    │  应收账款  │  固定成本  │
│ ¥132,000 │ ¥95,000  │ ¥37,000  │  28.0%   │ ¥66,000  │ ¥8,400/月│
├──────────┴──────────┴──────────┴──────────┴──────────┴──────────┤
│                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │  收入构成             │  │  支出结构             │               │
│  │  · 项目回款  ¥120,000│  │  · 项目成本  ¥70,000  │               │
│  │  · 其他收入  ¥ 12,000│  │  · 运营成本  ¥25,000  │               │
│  │                      │  │    ├ 房租    ¥ 8,000  │               │
│  │  项目回款明细:         │  │    ├ 软件    ¥ 5,600 │               │
│  │  · 项目A ¥50,000    │  │    ├ 差旅    ¥ 5,000  │               │
│  │  · 项目B ¥40,000    │  │    └ 其他    ¥ 6,400  │               │
│  │  · 项目C ¥30,000    │  │                      │               │
│  └─────────────────────┘  └─────────────────────┘               │
│                                                                  │
│  ┌─────────────────────────────────────────────┐                │
│  │  应收账款账龄分析                               │                │
│  │  0-30天  ████████████  ¥40,000               │                │
│  │  31-60天 ██████        ¥16,000               │                │
│  │  61-90天 ██            ¥ 6,000  ← 需要催款    │                │
│  │  >90天   █             ¥ 4,000  ← ⚠ 逾期严重  │                │
│  └─────────────────────────────────────────────┘                │
│                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │  项目利润排行          │  │  订阅成本清单          │               │
│  │  1. 项目A 30% margin │  │  · ChatGPT  ¥140/月  │               │
│  │  2. 项目C 25% margin │  │  · Vercel   ¥140/月  │               │
│  │  3. 项目B -5% ⚠     │  │  · Figma    ¥110/月  │               │
│  │                      │  │  合计 ¥8,400/年      │               │
│  └─────────────────────┘  └─────────────────────┘               │
│                                                                  │
│  ┌─────────────────────────────────────────────┐                │
│  │  工时分析                                      │                │
│  └─────────────────────────────────────────────┘                │
│                                                                  │
│  ┌─────────────────────────────────────────────┐                │
│  │  AI 解读                                      │                │
│  └─────────────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────────┘
```

### 6.3 订阅管理页面（新增 `/main/subscriptions`）

```
┌──────────────────────────────────────────────────────────────────┐
│  订阅管理                         [+ 添加订阅]                     │
├──────────────────────────────────────────────────────────────────┤
│  月度固定成本   ¥2,660/月    年度预估  ¥31,920/年                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🟢 活跃订阅（8 个）                                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ChatGPT Plus        ¥140/月   USD $20   下次扣费 06/15  ││
│  │  Cursor Pro          ¥150/月   USD $20   下次扣费 06/20  ││
│  │  Vercel Pro          ¥140/月   USD $20   下次扣费 07/01  ││
│  │  Figma Professional  ¥110/月   USD $15   下次扣费 06/18  ││
│  │  阿里云 ECS          ¥380/月   CNY       下次扣费 06/25  ││
│  │  域名续费 (xxx.com)  ¥69/年    CNY       下次扣费 12/15  ││
│  │  Notion Team         ¥72/月    USD $10   下次扣费 06/30  ││
│  │  GitHub Copilot      ¥80/月    USD $10   下次扣费 06/28  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ⏸ 已暂停（1 个）                                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Adobe CC             ¥388/月   已暂停    恢复             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  📊 分类统计                                                      │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐       │
│  │  AI工具 ¥370/月 │ │ 云服务 ¥520/月  │ │ 设计工具 ¥110/月│      │
│  └────────────────┘ └────────────────┘ └────────────────┘       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 七、文件变更清单

### 新增文件（14 个）

**后端：**

| 文件 | 用途 |
|---|---|
| `backend/prisma/schema.prisma` | 新增 Payment / Invoice / InvoicePayment / Transaction / Subscription 模型 |
| `backend/src/validators/payment.schema.ts` | 回款 Zod 校验 |
| `backend/src/validators/invoice.schema.ts` | 发票 Zod 校验 |
| `backend/src/validators/transaction.schema.ts` | 收支流水 Zod 校验 |
| `backend/src/validators/subscription.schema.ts` | 订阅 Zod 校验 |
| `backend/src/services/finance.service.ts` | **统一财务计算入口**（核心） |
| `backend/src/services/payment.service.ts` | 回款业务逻辑 |
| `backend/src/services/invoice.service.ts` | 发票业务逻辑 + PDF 数据 |
| `backend/src/services/transaction.service.ts` | 收支流水业务逻辑 |
| `backend/src/services/subscription.service.ts` | 订阅管理 + 自动记账 + 到期提醒 |

**前端：**

| 文件 | 用途 |
|---|---|
| `frontend/src/app/main/subscriptions/page.tsx` | 订阅管理页面 |
| `frontend/src/app/main/finance/page.tsx` | 收支流水页面（或集成到经营看板） |
| `frontend/src/components/features/invoices/InvoiceForm.tsx` | 开票表单 + PDF 预览 |
| `frontend/src/hooks/useFinance.ts` | 统一财务 React Query hooks |

### 修改文件（12 个）

| 文件 | 改动 |
|---|---|
| `backend/src/routes/index.ts` | 注册 payment / invoice / transaction / subscription 路由 |
| `backend/src/services/dashboard.service.ts` | **重写** getStats → 调用 finance.service |
| `backend/src/services/report.service.ts` | **重写** getOverview → 调用 finance.service |
| `backend/src/services/customer.service.ts` | 修复 batchProjectStats（加 Task.cost） |
| `backend/src/services/goal.service.ts` | REVENUE/PROFIT 指标改用 finance.service |
| `backend/src/jobs/morning-briefing.job.ts` | 调用 finance.service |
| `backend/src/jobs/weekly-report.job.ts` | 调用 finance.service |
| `backend/src/jobs/finance-pulse.job.ts` | 调用 finance.service |
| `backend/src/ai/tools/get-profit-analysis.ts` | 调用 finance.service |
| `backend/src/ai/tools/get-cash-flow.ts` | 调用 finance.service |
| `frontend/src/app/main/dashboard/page.tsx` | 重构 KPI + 趋势图 + 应收 |
| `frontend/src/app/main/reports/page.tsx` | 重构 + React Query + 新模块 |
| `frontend/src/components/features/ai/SmartDigest.tsx` | 修复字段名 |

### 实施顺序建议

```
Phase 1（基础）—— 2~3天
  ├── Payment 模型 + service + route
  ├── finance.service.ts（统一计算函数）
  ├── 修复 dashboard.service.ts 和 report.service.ts
  └── 修复 SmartDigest 字段名

Phase 2（流水）—— 2天
  ├── Transaction 模型 + service + route
  ├── Subscription 模型 + service + route
  ├── 订阅自动记账 + 到期提醒 cron job
  └── finance.service.ts 接入 Transaction

Phase 3（发票）—— 2天
  ├── Invoice 模型 + service + route
  ├── PDF 导出（前端 @react-pdf/renderer）
  ├── 催款提醒 cron job
  └── 应收账龄分析

Phase 4（前端整合）—— 3天
  ├── 仪表盘重构（新 KPI + 趋势图 + 应收）
  ├── 经营看板重构（真实利润 + 收支明细 + 订阅）
  ├── 订阅管理页面
  ├── 发票管理页面
  └── AI 工具全部改用 finance.service
```

---

## 附：所有涉及"钱"的代码位置速查

| 文件 | 行号 | 计算了什么 | 是否需要改 |
|---|---|---|---|
| `dashboard.service.ts` | 3-49 | 月收入、总成本、利润 | ✅ 重写 |
| `report.service.ts` | 53-88 | 收入、支出、利润、利润率 | ✅ 重写 |
| `report.service.ts` | 90-121 | 项目利润排行 | ✅ 成本加时间过滤 |
| `cost.service.ts` | 37-75 | 项目成本汇总 | ✅ 不变（但引用方要改） |
| `cost.service.ts` | 87-117 | 月度成本汇总 | ✅ 不变 |
| `project.service.ts` | 4-61 | 项目利润（budget - cost） | ⚠ 改为 budget - payments |
| `customer.service.ts` | 14-32 | 客户成本统计 | ✅ 加 Task.cost |
| `goal.service.ts` | 194-248 | REVENUE/PROFIT 目标进度 | ✅ 调用 finance.service |
| `cost-alert.job.ts` | 全文 | 成本预警 | ✅ 不变 |
| `morning-briefing.job.ts` | 全文 | 早报财务数据 | ✅ 调用 finance.service |
| `weekly-report.job.ts` | 全文 | 周报财务数据 | ✅ 调用 finance.service |
| `finance-pulse.job.ts` | 全文 | 财务脉搏 | ✅ 调用 finance.service |
| `get-profit-analysis.ts` | 全文 | AI 利润分析 | ✅ 调用 finance.service |
| `get-cash-flow.ts` | 全文 | AI 现金流分析 | ✅ 调用 finance.service |
| `get-cost-breakdown.ts` | 全文 | AI 成本分析 | ✅ 加 Task.cost |
| `get-revenue-by-client.ts` | 全文 | AI 客户收入分析 | ✅ 改用 Payment |
| `get-goal-progress.ts` | 全文 | AI 目标进度 | ✅ 调用 finance.service |
| `SmartDigest.tsx` | 51-54 | 侧边栏财务摘要 | ✅ 修复字段名 |
| `CostSummary.tsx` | 全文 | 项目成本卡片 | ⚠ 加回款进度 |
