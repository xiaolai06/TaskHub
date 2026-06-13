# 记账模块实现参考文档

> 用途：供 AI 参考实现，不包含具体代码
> 涉及范围：记账页面 + 全系统财务计算修正

---

## 一、核心理念

### 订阅的本质

订阅不是一种独立的"东西"，它是**支出的一种**——一种会自动重复的支出。

```
支出的两种形态：

  一次性支出：交了一次房租 → 手动记一笔 → 完事
  重复性支出：ChatGPT 月费 → 订阅管理里登记一次 → 每月自动记一笔

  两者最终都出现在同一条流水列表里，只是触发方式不同：
  一次性 → 人手动录入
  重复性 → 系统自动生成
```

### 记账页面的本质

一个页面，承载所有和"钱进钱出"相关的操作和查看：

```
📒 记账页面 = 记录 + 查看所有收支
  ├── Tab 记账       → 手动记录 + 查看所有流水（含自动生成的）
  ├── Tab 回款追踪   → 项目维度的回款管理
  └── Tab 订阅管理   → 重复性支出的管理
```

三个 Tab 的关系：

```
Tab 记账       是"总账本"—— 所有进出账的统一视图
Tab 回款追踪   是"应收视角"—— 从项目维度看钱到了没有
Tab 订阅管理   是"固定支出视角"—— 看每月被自动扣了多少

Tab 回款和 Tab 订阅里发生的每一笔，都会自动出现在 Tab 记账的流水里。
Tab 记账里也可以手动录入那些不归属于任何项目或订阅的收支。
```

---

## 二、数据模型设计

### 需要新增 3 张表

#### 2.1 Transaction（收支流水）

所有收支的统一记录表。不管是手动记的、回款触发的、还是订阅自动生成的，都存在这一张表里。

```
Transaction
  id              主键
  amount          金额（Int，单位：分）
  direction       方向：INCOME（收入） / EXPENSE（支出）
  category        类别（见下方枚举）
  description     描述（如"6月房租"、"ChatGPT月费"）
  date            发生日期
  source          来源标识：MANUAL（手动） / PAYMENT（回款触发） / SUBSCRIPTION（订阅自动）
  paymentId       如果来源是回款，关联 Payment 表
  subscriptionId  如果来源是订阅，关联 Subscription 表
  note            备注
  userId          所属用户
  createdAt       创建时间
  updatedAt       更新时间
```

**category 枚举设计：**

```
收入类（direction=INCOME）：
  PROJECT_PAYMENT  — 项目回款（由 Payment 录入自动生成）
  INTEREST         — 利息/理财收益
  REFUND           — 退款/返佣
  SUBSIDY          — 补贴/奖金
  ASSET_SALE       — 资产出售
  FREELANCE        — 非项目兼职收入
  OTHER_INCOME     — 其他收入

支出类（direction=EXPENSE）：
  PROJECT_COST     — 项目成本（已有 CostRecord，这个类别留给可能的扩展）
  RENT             — 房租/物业/水电
  SUBSCRIPTION     — 软件订阅/SaaS（由 Subscription 到期自动生成）
  EQUIPMENT        — 设备采购/办公用品
  TRAVEL           — 差旅/交通
  MEAL             — 餐饮/招待
  TAX              — 税费
  MARKETING        — 推广/广告
  INSURANCE        — 保险
  OTHER_EXPENSE    — 其他支出
```

**source 枚举设计：**

```
MANUAL        — 用户在 Tab 记账里手动录入
PAYMENT       — 用户在 Tab 回款追踪里录入回款时自动生成
SUBSCRIPTION  — 订阅到期时系统自动生成
```

source 字段的作用：
- 显示时区分来源（手动/回款/订阅），用图标标记
- 编辑权限区分：手动的可以改可以删；回款和订阅自动生成的不允许直接改（要去源头改）
- 统计时可以按来源分组

#### 2.2 Payment（回款记录）

项目维度的回款明细。记录客户每一笔钱什么时候到的。

```
Payment
  id            主键
  amount        金额（Int，单位：分）
  type          回款类型：DOWN_PAYMENT / PROGRESS / FINAL / ADJUSTMENT / OTHER
  method        到账方式：BANK_TRANSFER / ALIPAY / WECHAT / CASH / OTHER
  receivedAt    实际到账日期
  note          备注
  projectId     关联项目
  createdAt     创建时间
  updatedAt     更新时间
```

**与 Transaction 的关系：** 用户录入一笔回款时，系统同时做两件事：
1. 创建 Payment 记录（项目视角）
2. 创建 Transaction 记录（direction=INCOME, category=PROJECT_PAYMENT, source=PAYMENT）

两者的 amount 相同，通过 transaction.paymentId 关联。

#### 2.3 Subscription（订阅/重复性支出）

管理所有会定期自动扣费的支出。

```
Subscription
  id              主键
  name            服务名称（如"ChatGPT Plus"）
  category        订阅类别：SOFTWARE / CLOUD / DOMAIN / TOOL / MEDIA / OTHER
  amount          每期金额（Int，单位：分）
  currency        币种：CNY / USD / EUR
  exchangeRate    汇率（非 CNY 时需要，如 USD=7.0）
  cycle           周期：MONTHLY / QUARTERLY / YEARLY
  startDate       首次订阅日期
  nextBillingAt   下次扣费日期
  status          状态：ACTIVE / PAUSED / CANCELLED
  autoRenew       是否自动续费
  url             服务官网
  note            备注（账号、用途等）
  userId          所属用户
  createdAt       创建时间
  updatedAt       更新时间
```

**与 Transaction 的关系：** 当订阅到期（nextBillingAt 到达）时，系统自动：
1. 创建 Transaction（direction=EXPENSE, category=SUBSCRIPTION, source=SUBSCRIPTION）
2. 更新 Subscription.nextBillingAt 到下一个周期

---

## 三、需要修改的已有表

### 3.1 Project 表新增字段

```
Project
  新增 completedAt   DateTime?   // 标记为"已完成"的时间点
  新增 payments      Payment[]   // 关联回款记录
```

**为什么加 completedAt：** 当前用 `updatedAt` 判断项目完成时间，但 updatedAt 在任何修改时都会变。加一个专用字段，只在项目状态变为 COMPLETED 时写入一次。

### 3.2 User 表新增关联

```
User
  新增 transactions     Transaction[]
  新增 subscriptions    Subscription[]
```

---

## 四、全系统财务计算修正（10 个问题的修复方案）

### 4.1 核心原则

**所有需要"收入/支出/利润"的地方，不再各自写 Prisma 查询，统一调用一个函数。**

建立 `finance.service.ts`，导出一个核心函数：

```
getFinancialSummary(userId, 日期范围)
  → 返回 { income, expense, profit, margin, receivables }
```

**计算公式（统一后的）：**

```
收入 = Payment.sum(receivedAt in 日期范围)         ← 项目回款（真实到账）
     + Transaction(INCOME, source!=PAYMENT).sum    ← 非项目收入（手动记的利息/退款等）

     注：Payment 回款会同时生成 Transaction(source=PAYMENT)
         为避免重复计算，收入要排除 source=PAYMENT 的 Transaction
         或者直接用 Payment + Transaction(非项目收入) 两条线

     推荐方案：直接两条线取数
       收入 = Payment.sum(receivedAt in range)
            + Transaction(INCOME, source=MANUAL).sum

支出 = CostRecord.sum(date in 日期范围)             ← 项目成本（已有）
     + Transaction(EXPENSE).sum(date in 日期范围)    ← 非项目支出（房租+订阅等）

利润 = 收入 - 支出
利润率 = 利润 / 收入 × 100%（收入为0时显示0）
应收 = sum(每个项目的 budget - Payment.sum)，只算未结清的
```

### 4.2 逐个问题的修复说明

**问题 1：仪表盘利润 = 本月收入 - 全量历史成本**
- 位置：`dashboard.service.ts` getStats()
- 修复：改用 `finance.service.getFinancialSummary(userId, 本月)`
- 收入和成本都在同一个"本月"范围内

**问题 2：项目排行的成本没有按时间过滤**
- 位置：`report.service.ts` getProjectRanking()
- 修复：给 `getRecordCostByProject()` 和 `getTaskCostByProject()` 传入 start/end 参数

**问题 3：用 updatedAt 判断收入归属月份**
- 位置：`dashboard.service.ts` 和 `report.service.ts`
- 修复：收入改为从 Payment 表取，用 Payment.receivedAt（实际到账日）作为归属时间
- 不再用 Project.budget 当收入，也不再用 Project.updatedAt 判断归属

**问题 4：客户统计只算 CostRecord 不算 Task.cost**
- 位置：`customer.service.ts` batchProjectStats()
- 修复：成本计算加上 Task.cost，和 project.service.ts 保持一致

**问题 5：AI 现金流工具用 endDate 判断收入**
- 位置：`get-cash-flow.ts`
- 修复：所有 AI 工具的收入改用 Payment.receivedAt，不再用 Project 的任何时间字段

**问题 6：AI 工具普遍不算 Task.cost**
- 位置：`get-cost-breakdown.ts`、`get-revenue-by-client.ts`、`get-goal-progress.ts`
- 修复：统一用 `finance.service.getFinancialSummary()` 或在各工具中补上 Task.cost

**问题 7：SmartDigest 读取了不存在的字段名**
- 位置：`SmartDigest.tsx` 第 51-52 行
- 修复：改成读取 API 实际返回的字段名（monthlyIncome / totalCost），或改为调用新的统一接口

**问题 8：目标系统用全量预算 vs 按月成本**
- 位置：`goal.service.ts` calculateAutoProgress()
- 修复：REVENUE 指标改用 Payment.sum(receivedAt in goal.range)，PROFIT 指标改用 finance.service

**问题 9：Task.cost 时间字段不统一**
- 位置：多处，有的用 createdAt 有的用 completedAt
- 修复：统一使用 CostRecord.date 作为成本归属时间（因为 Task.cost 是从 CostRecord 聚合的，用源数据的时间字段最准确）
- 如果确实需要按任务维度看成本，用 createdAt（任务创建时的成本归属）

**问题 10：利润率精度不统一**
- 位置：report.service.ts 用 `*1000/10`，其他地方用 `*100`
- 修复：全部统一为 `Math.round(profit / income * 1000) / 10`（保留1位小数）

### 4.3 修复后的数据流

```
修复前（每个模块自己算，算法各不相同）：
  dashboard.service   → 自己查 Prisma，算法 A
  report.service      → 自己查 Prisma，算法 B
  AI 工具 × 5 个      → 各自查 Prisma，算法 C/D/E/F/G
  goal.service        → 自己查 Prisma，算法 H
  morning-briefing    → 调 dashboard（继承了算法 A 的问题）
  weekly-report       → 调 dashboard（同上）

修复后（一个函数算了所有人用）：
  finance.service.getFinancialSummary()
         ↑
         │
    ┌────┼────┬────┬────┬────┬────┐
    │    │    │    │    │    │    │
  仪表盘 看板  AI×5 目标  早报  周报
  (同一数字)
```

---

## 五、记账页面详细设计

### 5.1 页面入口和路由

```
侧边栏新增：
  图标：BookOpen 或 Wallet
  名称：记账
  路由：/main/finance
  颜色：emerald 色系

优先级：放在"成本"和"经营看板"之间
```

### 5.2 Tab 1：记账

#### 页面结构（从上到下）

```
┌─ 顶部：3 个摘要卡片 ─────────────────────────────────────────┐
│  本月收入  |  本月支出  |  本月净利                             │
│  每个卡片显示金额 + 子分类拆解 + 环比变化率                      │
└──────────────────────────────────────────────────────────────┘

┌─ 操作栏 ─────────────────────────────────────────────────────┐
│  [+ 记一笔收入] [+ 记一笔支出]  |  时间筛选  类别筛选  搜索     │
└──────────────────────────────────────────────────────────────┘

┌─ 流水列表（主体）─────────────────────────────────────────────┐
│  按日期分组，每天一个分组标题                                    │
│  每条记录显示：时间/类别/描述/金额/来源标记                       │
│  分页加载                                                      │
└──────────────────────────────────────────────────────────────┘

┌─ 底部：月度趋势（可选）──────────────────────────────────────┐
│  收入/支出/净利 折线图（近6个月）                                │
└──────────────────────────────────────────────────────────────┘
```

#### 摘要卡片详细设计

```
┌─────────────────────────────────────────┐
│  本月收入              ¥132,000         │
│  ↑12% 环比上月                          │
│                                         │
│  项目回款    ¥120,000   ← 来自 Payment   │
│  其他收入    ¥ 12,000   ← 来自手动记账    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  本月支出              ¥95,000          │
│  ↑5% 环比上月                           │
│                                         │
│  项目成本    ¥70,000   ← 来自 CostRecord │
│  运营支出    ¥25,000   ← 来自 Transaction│
│    含订阅    ¥5,600   ← 标出订阅占比     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  本月净利              ¥37,000          │
│  利润率 28.0%                           │
│  ↑18% 环比上月                          │
└─────────────────────────────────────────┘
```

#### 记账表单设计

点"记一笔收入"或"记一笔支出"弹出 Sheet/Dialog：

```
收入表单：
  金额 *        数字输入，单位元
  类别 *        下拉选择（利息收益/退款返佣/补贴奖金/资产出售/兼职收入/其他收入）
  日期 *        日期选择器，默认今天
  描述 *        文本输入
  备注          文本输入（可选）

支出表单：
  金额 *        数字输入，单位元
  类别 *        下拉选择（房租/软件订阅/设备采购/差旅交通/餐饮招待/税费/推广广告/保险/其他）
  日期 *        日期选择器，默认今天
  描述 *        文本输入
  备注          文本输入（可选）

提交逻辑：
  前端：金额 × 100 转为分
  后端：创建 Transaction 记录，source = MANUAL
```

#### 流水列表设计

```
每条记录的显示格式：

  ┌────────────────────────────────────────────────────────┐
  │  [时间]  [类别标签]  [描述]           [金额]   [操作]   │
  └────────────────────────────────────────────────────────┘

  示例：
  09:30  🟠 餐饮招待    团队午餐              -¥356    [···]
  ——    🟢 兼职收入    培训讲座课酬           +¥5,000   [···]
  ——    🔵 项目回款    项目A-预付款  📥       +¥30,000  [···]
  ——    🔴 软件订阅    ChatGPT Plus  🔄      -¥140     [···]

  来源标记：
    无标记 = 手动录入（可编辑可删除）
    📥 = 回款触发（不可直接编辑，去 Tab2 改）
    🔄 = 订阅自动（不可直接编辑，去 Tab3 改）

  操作菜单：
    手动记录 → 编辑 / 删除
    回款记录 → 查看项目回款详情（跳转 Tab2）
    订阅记录 → 查看订阅详情（跳转 Tab3）
```

#### 筛选和搜索

```
时间筛选：本月 / 上月 / 本季度 / 本年 / 自定义范围
类别筛选：全部 / 收入 / 支出 / 某个具体类别
来源筛选：全部 / 手动 / 回款 / 订阅
关键词搜索：在描述和备注中搜索
```

---

### 5.3 Tab 2：回款追踪

#### 页面结构

```
┌─ 顶部：4 个汇总数字 ───────────────────────────────────────┐
│  应收总额  |  本月已回款  |  逾期未收  |  整体回款率           │
└──────────────────────────────────────────────────────────────┘

┌─ 操作栏 ─────────────────────────────────────────────────────┐
│  [+ 录入回款]              状态筛选（全部/未结清/已结清/逾期）    │
└──────────────────────────────────────────────────────────────┘

┌─ 项目回款列表（主体）─────────────────────────────────────────┐
│  每个项目一个卡片                                              │
│  显示：项目名/报价/已收/待收/回款率/回款进度条                    │
│  展开显示：回款明细列表 + 录入新回款按钮                          │
│  逾期项目红色高亮                                              │
└──────────────────────────────────────────────────────────────┘

┌─ 底部：账龄分析 ────────────────────────────────────────────┐
│  按账龄分段显示待收金额（0-30天/31-60天/61-90天/>90天）        │
└──────────────────────────────────────────────────────────────┘
```

#### 回款录入表单

```
弹出条件：点击"录入回款"按钮，需要先选项目或在项目卡片内点击

字段：
  项目 *        如果从项目卡片进来则预填
  金额 *        数字输入，单位元
  类型 *        下拉：预付款/进度款/尾款/调整项/其他
  到账日期 *    日期选择器，默认今天
  到账方式      下拉：银行转账/支付宝/微信/现金/其他
  备注          文本输入

提交逻辑：
  1. 创建 Payment 记录（amount = 金额 × 100）
  2. 创建 Transaction 记录（direction=INCOME, category=PROJECT_PAYMENT, source=PAYMENT, paymentId=刚创建的）
  3. 刷新 Tab2 的项目列表（回款进度更新）
  4. Tab1 流水列表自动出现新记录
```

#### 回款进度条计算

```
每个项目：
  报价 = project.budget
  已收 = sum(project.payments.amount)
  待收 = 报价 - 已收（最小为0）
  回款率 = 已收 / 报价 × 100%

  进度条宽度 = 回款率%

  颜色：
    100% → 绿色（已结清）
    >= 50% → 蓝色（正常）
    < 50% → 橙色（需关注）
    逾期项目 → 红色
```

#### 账龄分析计算

```
对每个待收项目：
  账龄 = 今天 - 最后一笔回款的 receivedAt（或项目 startDate 如果没有回款）
  按账龄分桶：0-30天 / 31-60天 / 61-90天 / >90天
  每个桶的金额 = 该桶内项目的待收金额之和
```

---

### 5.4 Tab 3：订阅管理

#### 页面结构

```
┌─ 顶部：2 个汇总数字 ───────────────────────────────────────┐
│  月度固定成本   |   年度预估                                  │
│  ¥2,660/月     |   ¥31,920/年                               │
│  活跃 8 项      |   暂停 1 项                                 │
└──────────────────────────────────────────────────────────────┘

┌─ 操作栏 ─────────────────────────────────────────────────────┐
│  [+ 添加订阅]              状态筛选（活跃/暂停/已取消/全部）      │
└──────────────────────────────────────────────────────────────┘

┌─ 订阅列表（主体）─────────────────────────────────────────────┐
│  按状态分组显示                                                │
│  即将扣费（3天内）→ 置顶高亮                                    │
│  活跃中 → 按下次扣费日期排序                                    │
│  已暂停 → 折叠显示                                             │
└──────────────────────────────────────────────────────────────┘

┌─ 底部：分类统计 ────────────────────────────────────────────┐
│  按订阅类别显示月度金额占比（柱状图或横向进度条）                  │
└──────────────────────────────────────────────────────────────┘
```

#### 订阅卡片显示

```
每条订阅显示：
  服务名称
  金额/周期（如 ¥140/月）
  如果非 CNY → 显示原币金额 + 换算后人民币
  下次扣费日期
  如果3天内扣费 → 橙色"即将扣费"标签
  操作按钮：编辑 / 暂停(或恢复) / 取消
```

#### 添加订阅表单

```
字段：
  服务名称 *    文本输入
  类别 *        下拉：AI工具/云服务/域名/效率工具/素材库/其他
  每期金额 *    数字输入，单位元
  币种          下拉：CNY/USD/EUR（默认 CNY）
  汇率          数字输入（非 CNY 时显示，如 7.0）
  周期 *        下拉：月付/季付/年付
  首次订阅日期   日期选择器
  下次扣费日期 * 日期选择器（必填，用来触发自动记账）
  自动续费       开关，默认开
  官网          URL 输入
  备注          文本输入
```

#### 月度成本计算

```
将不同周期统一换算为月均：
  月付 → amount
  季付 → amount / 3
  年付 → amount / 12

非 CNY 的需要乘以 exchangeRate：
  月均成本 = amount（原币） × exchangeRate / cycle月数

月度总成本 = 所有活跃订阅的月均成本之和
年度预估 = 月度总成本 × 12
```

#### 订阅到期自动记账（定时任务）

```
触发条件：每天 09:00 检查

逻辑：
  查询所有 status=ACTIVE 且 nextBillingAt <= 今天 的订阅
  对每个到期订阅：
    1. 计算人民币金额 = amount × exchangeRate（如果非 CNY）
    2. 创建 Transaction（direction=EXPENSE, category=SUBSCRIPTION, source=SUBSCRIPTION）
    3. 更新 nextBillingAt 到下一个周期
    4. 发送通知："{name} 已扣费 ¥{amount}，已自动记入支出"

  通知文案示例：
    "ChatGPT Plus 已扣费 ¥140，已自动记入支出流水"
    "Cursor Pro 已扣费 ¥150，已自动记入支出流水"
```

#### 分类统计计算

```
按 category 分组：
  每个类别的月度金额 = sum(该类别活跃订阅的月均成本)
  占比 = 类别金额 / 总月度成本 × 100%

显示为横向进度条或简单柱状图
```

---

## 六、与现有页面的数据打通

### 6.1 仪表盘改造

**当前问题：** 收入用 Project.budget，成本是全量历史，利润口径错配。

**改造方案：**

```
KPI 卡片变化：

  现有：
    进行中订单     → 保留
    任务完成率     → 保留
    本月入款       → 改为"本月收入"，数据改为 Payment + Transaction(INCOME)
    已发生成本     → 改为"本月支出"，数据改为 CostRecord + Transaction(EXPENSE)（本月范围）
    预估利润       → 改为"本月利润"，收入 - 支出
    逾期任务       → 保留

  新增：
    应收账款       → 显示待收总额（所有未结清项目的 budget - payments）
```

**实现方式：** 调用 `finance.service.getFinancialSummary(userId, 本月)` 一次性拿到所有数字。

### 6.2 经营看板改造

**当前问题：** 收入算法和仪表盘不一致，成本可能不包含 Task.cost。

**改造方案：**

```
4 个 KPI 卡片：
  收入 = finance.service 的 income（支持日/月/年切换）
  支出 = finance.service 的 expense
  毛利 = profit
  利润率 = margin

  这 4 个数字和仪表盘用同一个函数，确保一致。

新增模块：
  收支构成 — 收入拆解（项目回款 + 其他）和支出拆解（项目成本 + 运营成本 + 订阅）
  应收账款 — 和 Tab2 数据一致

项目利润排行修复：
  成本加上时间过滤（传入 start/end）

数据获取方式修复：
  改用 React Query 替代 useEffect + useState
```

### 6.3 AI 工具修复

**所有 AI 工具不再各自写 Prisma 查询，改为调用 finance.service。**

```
get-profit-analysis  → 调用 getFinancialSummary()
get-cash-flow        → 调用 getFinancialSummary()
get-cost-breakdown   → 保留单独查 CostRecord，但补上 Task.cost
get-revenue-by-client → 改为查 Payment.sum by project
get-goal-progress    → 调用 getFinancialSummary()
```

### 6.4 定时任务修复

```
morning-briefing.job.ts  → 调用 finance.service
weekly-report.job.ts     → 调用 finance.service
finance-pulse.job.ts     → 调用 finance.service
cost-alert.job.ts        → 不变（已经正确）
```

### 6.5 SmartDigest 修复

```
当前问题：读取 dashSummary.monthIncome（不存在的字段），永远为 0
修复：
  方案 A：改成读取 API 实际返回的字段名
  方案 B：改用新的统一接口，返回 income/expense/profit
```

---

## 七、路由和 API 设计

### 7.1 新增 API 端点

**收支流水（/api/transactions）：**
```
GET    /api/transactions          列表（支持分页、按日期/类别/方向筛选）
POST   /api/transactions          创建（手动记账）
PUT    /api/transactions/:id      编辑（仅 source=MANUAL 的可编辑）
DELETE /api/transactions/:id      删除（仅 source=MANUAL 的可删除）
GET    /api/transactions/summary  摘要（本月收入/支出/净利，支持 period 参数）
GET    /api/transactions/trends   趋势（近6个月收支数据）
```

**回款（/api/payments）：**
```
GET    /api/payments                    列表（按项目分组）
POST   /api/payments                    录入回款（同时创建 Transaction）
GET    /api/payments/receivables        应收账款汇总
GET    /api/payments/aging              账龄分析
```

**订阅（/api/subscriptions）：**
```
GET    /api/subscriptions               列表
POST   /api/subscriptions               添加订阅
PUT    /api/subscriptions/:id           编辑
PUT    /api/subscriptions/:id/pause     暂停
PUT    /api/subscriptions/:id/resume    恢复
DELETE /api/subscriptions/:id           删除
GET    /api/subscriptions/cost-summary  月度/年度成本汇总
```

**统一财务（/api/finance）：**
```
GET    /api/finance/summary             统一财务汇总（给仪表盘/看板/AI用）
       参数：period, type（day/month/year）
       返回：income, expense, profit, margin, receivables
```

### 7.2 修改的已有 API

```
GET /api/dashboard/summary        → 内部改调 finance.service
GET /api/reports/overview         → 内部改调 finance.service
GET /api/reports/project-ranking  → 成本加上时间过滤
```

---

## 八、前端文件结构

### 8.1 新增文件

```
frontend/src/
  app/main/finance/
    page.tsx                    ← 记账主页面（含三个 Tab）
  components/features/finance/
    FinanceSummary.tsx          ← 顶部3个摘要卡片
    TransactionForm.tsx         ← 记账表单（收入/支出）
    TransactionList.tsx         ← 流水列表
    TransactionItem.tsx         ← 单条流水记录
    PaymentTracking.tsx         ← Tab2 回款追踪主组件
    PaymentForm.tsx             ← 录入回款表单
    PaymentProjectCard.tsx      ← 项目回款卡片
    AgingAnalysis.tsx           ← 账龄分析
    SubscriptionList.tsx        ← Tab3 订阅列表
    SubscriptionForm.tsx        ← 添加/编辑订阅表单
    SubscriptionCostChart.tsx   ← 订阅分类统计
  hooks/
    useTransactions.ts          ← 收支流水 React Query hooks
    usePayments.ts              ← 回款 React Query hooks
    useSubscriptions.ts         ← 订阅 React Query hooks
    useFinance.ts               ← 统一财务汇总 hook
```

### 8.2 修改文件

```
frontend/src/
  app/main/dashboard/page.tsx          ← KPI 改用 useFinance
  app/main/reports/page.tsx            ← 改用 React Query + useFinance
  components/features/ai/SmartDigest.tsx ← 修复字段名
  components/layout/Sidebar.tsx        ← 新增记账菜单项
```

---

## 九、后端文件结构

### 9.1 新增文件

```
backend/src/
  validators/
    transaction.schema.ts       ← 收支 Zod 校验
    payment.schema.ts           ← 回款 Zod 校验
    subscription.schema.ts      ← 订阅 Zod 校验
    finance.schema.ts           ← 统一财务查询参数校验
  services/
    finance.service.ts          ← 统一财务计算（核心）
    transaction.service.ts      ← 收支流水 CRUD
    payment.service.ts          ← 回款 CRUD + 应收计算
    subscription.service.ts     ← 订阅 CRUD + 自动记账逻辑
  routes/
    transaction.routes.ts       ← 收支路由
    payment.routes.ts           ← 回款路由
    subscription.routes.ts      ← 订阅路由
    finance.routes.ts           ← 统一财务路由
```

### 9.2 修改文件

```
backend/src/
  routes/index.ts                          ← 注册4组新路由
  services/dashboard.service.ts            ← 改用 finance.service
  services/report.service.ts               ← 改用 finance.service + 修复排行
  services/customer.service.ts             ← 修复成本计算（加 Task.cost）
  services/goal.service.ts                 ← 修复 REVENUE/PROFIT 指标
  jobs/morning-briefing.job.ts             ← 改用 finance.service
  jobs/weekly-report.job.ts                ← 改用 finance.service
  jobs/finance-pulse.job.ts                ← 改用 finance.service
  jobs/subscription-billing.job.ts         ← 新增：订阅自动扣费
  ai/tools/get-profit-analysis.ts          ← 改用 finance.service
  ai/tools/get-cash-flow.ts                ← 改用 finance.service
  ai/tools/get-cost-breakdown.ts           ← 补上 Task.cost
  ai/tools/get-revenue-by-client.ts        ← 改用 Payment
  ai/tools/get-goal-progress.ts            ← 改用 finance.service
```

---

## 十、实施顺序

```
Phase 1（基础 + 统一计算）           预计 3 天
  1. Prisma Schema 新增 Payment / Transaction / Subscription + Project.completedAt
  2. npx prisma db push && npx prisma generate
  3. 新建 finance.service.ts（统一计算函数）
  4. 修改 dashboard.service.ts → 调用 finance.service
  5. 修改 report.service.ts → 调用 finance.service + 修复排行成本过滤
  6. 修复 SmartDigest 字段名
  7. 验证：仪表盘和经营看板数字一致

Phase 2（记账 Tab）                 预计 2 天
  1. 新建 transaction.service.ts + route + validator
  2. 新建前端 /main/finance 页面 + Tab 记账
  3. 实现：摘要卡片 + 记账表单 + 流水列表
  4. 实现：筛选搜索分页

Phase 3（回款 Tab）                 预计 2 天
  1. 新建 payment.service.ts + route + validator
  2. 实现 Tab2：回款汇总 + 项目回款列表 + 录入表单
  3. 实现：录入回款时自动创建 Transaction
  4. 实现：账龄分析

Phase 4（订阅 Tab）                 预计 2 天
  1. 新建 subscription.service.ts + route + validator
  2. 实现 Tab3：订阅列表 + 添加表单 + 分类统计
  3. 实现：定时任务（订阅到期自动创建 Transaction + 通知）
  4. 实现：月度成本计算

Phase 5（全系统打通）               预计 2 天
  1. 仪表盘改造（KPI + 趋势图 + 应收）
  2. 经营看板改造（React Query + 新模块）
  3. AI 工具全部改用 finance.service
  4. 定时任务改用 finance.service
  5. 修复 customer.service / goal.service
  6. 侧边栏新增记账入口

Phase 6（验证）                     预计 1 天
  1. 验证：所有页面的收入/支出/利润数字一致
  2. 验证：回款录入后流水自动出现
  3. 验证：订阅到期后流水自动出现
  4. 验证：仪表盘/看板/AI 看到的数字一致
  5. TypeScript 编译零错误
```

---

## 十一、验收标准

```
数据一致性：
  □ 仪表盘"本月收入" = 经营看板"收入" = AI 看到的"收入"
  □ 仪表盘"本月支出" = 经营看板"支出" = AI 看到的"支出"
  □ 利润 = 收入 - 支出，所有页面一致
  □ 利润率保留1位小数，所有页面一致

记账功能：
  □ 手动记一笔收入 → 流水列表出现
  □ 手动记一笔支出 → 流水列表出现
  □ 可以编辑/删除手动录入的记录
  □ 回款和订阅生成的记录不可直接编辑

回款功能：
  □ 录入回款 → 流水列表自动出现 📥 标记的收入
  □ 项目回款进度条实时更新
  □ 应收总额 = 所有项目待收之和
  □ 仪表盘"本月收入"包含本月回款

订阅功能：
  □ 添加订阅后，到期时自动在流水里出现 🔄 标记的支出
  □ 月度成本 = 所有活跃订阅的月均之和
  □ 可以暂停/恢复/取消订阅
  □ 即将扣费的订阅置顶提醒
```
