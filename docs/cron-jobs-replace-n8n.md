# TaskFlow+ 一人公司 AI 自动化方案

## 方案总结

### 我们做了什么

用 **纯代码 `node-cron`** 完全替代 n8n Docker 服务，实现所有自动化能力：

### 三大能力模块

```
┌─────────────────────────────────────────────────────────────┐
│                    AI 自动化体系                              │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  🔍 AI 搜索   │  │  ⏰ 定时分析  │  │  💬 AI 对话   │       │
│  │              │  │              │  │              │       │
│  │ search_web   │  │ 晨间简报 8:00│  │ 25 个CRUD工具│       │
│  │ 联网搜索工具  │  │ 客户雷达 9:00│  │ 4 个提示词   │       │
│  │              │  │ 财务脉搏10:00│  │ 流式对话     │       │
│  │ 外部资料获取  │  │ 自动周报周一 │  │ 工具调用可视化│       │
│  │ 结合业务分析  │  │ 记忆沉淀周日 │  │              │       │
│  │              │  │ 业务脉冲周日 │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  ┌──────────────────────────────────────────────────┐       │
│  │  📝 11 个提示词体系                                │       │
│  │  default / create / analyze / schedule / search   │       │
│  │  morning / client-radar / finance-pulse           │       │
│  │  weekly-report / memory-extract / health-check    │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### 和 n8n 对比

| 维度 | n8n | 纯代码 |
|------|-----|--------|
| 运行依赖 | Docker 容器 | 进程内，无额外服务 |
| 调试 | n8n 界面看日志 | console.log / 断点 |
| 版本控制 | JSON 导出 | Git 管理 |
| 修改流程 | 界面拖拽 + 测试 | 改代码 + tsc |
| AI 集成 | HTTP 转发 | 直接调用 AIService |
| 类型安全 | 无 | TypeScript 全覆盖 |
| 运维成本 | 需维护 Docker + n8n | 零额外运维 |
| 适合场景 | 多外部系统编排 | 本项目全部场景 ✅ |

### 实施范围

| 层级 | 新增 | 修改 |
|------|------|------|
| 数据库 | CronJob 表 | 无 |
| 后端 Service | notification / report / search / cron-job | config.ts / server.ts |
| 后端 Route | notification / report / search / cron-job | registry.ts / prompt-selector.ts |
| 后端 AI 工具 | search-web.ts → 26 个工具 | types.ts |
| 后端 Job | 6 个定时 Job | 无 |
| 后端 Prompt | 6 个新提示词 | 无 |
| 前端页面 | AI 工作台 / 定时任务管理 | Sidebar / 设置页 |
| 前端组件 | CronJobList / CronJobForm | AiPanel 配置入口 |

---

## 一、核心理念

**不是定时发通知，而是 AI 做你的思考伙伴。**

一人公司最大痛点不是"缺少工具"，而是：
- 🧠 一切都靠你一个人记 → 忘了就忘了
- 📊 忙着干活没空分析 → 不知道到底赚不赚钱
- 🤷 没人帮你排优先级 → 所有事都像紧急的
- 🏝 没有第二大脑 → 决策/承诺/偏好散落各处
- 🔇 没人商量 → 所有决定都靠自己

AI 的角色不是替代你做决策，而是**在你忙的时候帮你盯、帮你记、帮你理**。

---

## 二、AI 搜索体系

### 2.1 为什么只需要一个新工具

你已经有 25 个 AI 工具覆盖了所有本地数据操作：

```
用户: "我之前那个登录项目进度怎么样了？"
  → AI 自动选 get_project_progress({ projectName: "登录" })  ✅ 无需新工具

用户: "React 19 Server Components 适合我们的项目吗？"
  → 本地没这个知识 → AI 用 search_web 查外部资料  🔧 唯一需要的新工具
  → 再结合 get_project_progress 看当前项目技术栈 → 给出具体建议
```

### 2.2 搜索的核心设计理念

AI 搜索和普通搜索引擎完全不同。搜索引擎是「用户主动搜」，AI 搜索是「AI 判断需要什么信息 → 自动搜 → 和你的业务数据结合 → 给出针对你的答案」。

```
普通搜索:
  你 → 输入关键词 → 得到一堆链接 → 自己读 → 自己判断 → 自己做

AI 搜索:
  你: "小程序开发现在怎么报价？"
  你: "我们现有的项目报价合理吗？"
    → AI 决定:
        1. search_web("2025 小程序开发报价标准")
        2. get_revenue_by_client()  查现有客户报价
        3. get_project_margin_ranking()  查各项目利润率
    → AI 综合:
        "市面上小程序开发报价在 3-15 万之间。你的客户平均报价
         8.2 万，在合理范围内。但 XX 项目利润率只有 12%，偏低。
         建议同类项目报价不低于 6 万。"
```

### 2.3 AI 搜索的决策树

这是提示词要教 AI 的核心能力——**什么时候用本地工具，什么时候联网搜**：

```
用户提问
  │
  ├─ 问题只涉及用户自己的数据？
  │   → 用已有工具（get_project_progress / get_client_insights 等）
  │   → 例: "今天有什么任务？"、"张总那个项目进度？"
  │
  ├─ 问题涉及外部知识（技术/行业/趋势/市场）？
  │   ├─ 和用户业务无关？
  │   │   → 只用 search_web
  │   │   → 例: "React 19 有什么新特性？"
  │   │
  │   └─ 和用户业务有关？
  │       → search_web + 本地工具 并行调用
  │       → 例: "React 19 适合我们的项目吗？"
  │       → 流程: 搜 React 19 特性 + 查当前项目技术栈 → 结合分析
  │
  └─ 问题需要对比"现状 vs 行业标准"？
      → 先搜外部基准 + 再查本地数据 + 最后对比
      → 例: "我的报价是不是太低了？"
      → 流程: 搜行业报价 → 查自己的报价数据 → 对比分析
```

### 2.4 search_web 工具定义

```typescript
// backend/src/ai/tools/search-web.ts
{
  name: 'search_web',
  description: `联网搜索外部信息。当用户问题无法仅凭本地数据库回答时调用。
使用时机:
- 用户问技术趋势、行业标准、市场行情、竞品等外部知识
- 用户需要"对比我的情况 vs 行业水平"
- 用户问最新信息（本地数据可能过时）
不使用时机:
- 查项目/任务/客户/成本/目标 → 用对应的 get_xxx 工具
- 纯粹的业务操作（创建/更新/删除）→ 用对应的 create_xxx/update_xxx 工具`,
  category: 'work',
  access: 'read',
  requiresConfirmation: false,
  preferredModel: 'balanced',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: `搜索关键词。要求:
- 精确具体（不是"报价"，而是"2025 小程序开发外包报价 行情"）
- 包含时间限定词（如"2025"、"最新"）
- 包含范围限定词（如"一人公司"、"freelancer"、"小团队"）`
      },
      maxResults: { type: 'number', description: '返回条数，默认5，最大10', default: 5 }
    },
    required: ['query']
  },
  handler: async (args, userId) => {
    // 1. 查 Setting 表 category=SEARCH key=provider
    // 2. 没配置 → { error: '未配置搜索API Key，请在设置→搜索配置中配置', configured: false }
    // 3. 配置了 → 调 Tavily/SerpAPI → 返回 { results: [{title, snippet, url}], configured: true }
  }
}
```

### 2.5 搜索提示词 `system-search.txt` 完整设计

这是注入给 AI 的搜索提示词，是整个搜索体系的大脑。它要教 AI 四件事：
**什么时候搜、怎么搜、搜完怎么用、怎么回答用户**。

```
你是 TaskFlow+ 智能助手。除了管理本地业务数据外，你还可以通过
search_web 工具获取外部信息。

## 核心原则：不要猜，要查

如果你对用户的问题不确定（技术细节、行情价格、行业标准），
用 search_web 查，不要凭训练数据猜测。

## 一、决策指南：什么时候用 search_web

### 必须用 search_web
✅ 技术问题："React 19 有什么新特性？适合升级吗？"
✅ 行业行情："小程序开发现在一般怎么报价？"
✅ 市场趋势："2025 年 AI 应用开发有什么趋势？"
✅ 竞品/工具对比："Notion 和 Linear 的项目管理哪个好？"
✅ 最佳实践："一人公司怎么做客户管理？"
✅ 最新信息："Next.js 最新版本是什么？有什么变化？"
✅ 和用户业务相关的"外部基准"："我的报价是不是太低了？"

### 必须用本地工具（不要搜）
❌ 查项目进度 → get_project_progress / get_today_focus
❌ 查任务状态 → get_overdue_tasks / get_today_focus
❌ 查客户信息 → get_client_insights / get_client_follow_up
❌ 查财务数据 → get_cost_breakdown / get_cash_flow / get_profit_analysis
❌ 查目标进展 → get_goal_progress / get_weekly_review
❌ 创建/修改数据 → create_project / create_task / update_task_status 等

### 判断规则（按顺序）
1. 这个问题的答案在用户数据库里吗？→ 是 → 用本地工具
2. 这个问题涉及外部世界的信息吗？→ 是 → 用 search_web
3. 这个问题需要"外部信息 + 用户数据"结合吗？→ 是 → 两个都调

## 二、搜索技巧：怎么搜

### 查询词要精准
❌ 不好的查询: "报价"
✅ 好的查询: "2025 小程序开发外包报价 行情 价格范围"

❌ 不好的查询: "React"
✅ 好的查询: "React 19 Server Components breaking changes 升级指南"

### 查询词要加限定条件
- 时间限定: 2025 / 最新 / this year
- 角色限定: 一人公司 / freelancer / 小团队 / solo developer  
- 地域限定: 国内 / 中国市场 / 中文
- 类型限定: 报价 / 案例 / 教程 / 对比 / 趋势

### 拆解复杂问题
用户问"React 19 适合升级吗，升级要多少时间，我们项目该不该升？"
→ 不要搜一个长句，而是拆成:
  1. search_web("React 19 new features breaking changes upgrade guide 2025")
  2. 同时调 get_project_progress 看当前用 React 的项目
→ 再结合分析

## 三、回答指南：搜完怎么用

### 规则1: 摘要，不要粘贴
搜索返回的是原始资料，你要提炼后再回答。
❌ 原文照搬 500 字搜索结果
✅ 用 3-5 句话总结要点

### 规则2: 一定要和用户业务挂钩
搜索结果只是背景信息，必须和用户的实际情况结合才有价值。

用户: "小程序开发现在怎么报价？我的报价合理吗？"
你的回答应该:

> 📊 行业参考（来自搜索结果）:
> 小程序开发报价在 3-15 万，中等复杂度约 5-8 万
>
> 📋 你的情况（来自本地数据）:
> 「XX商城」报价 6 万，利润率 35%，在合理范围
> 「XX官网」报价 3 万，利润率 15%，可能偏低了
>
> 💡 建议: 后续类似项目报价不低于 5 万，复杂项目可以报 8-12 万

### 规则3: 标注来源
"根据搜索结果..." / "行业信息显示..." / "你的数据显示..."

### 规则4: 搜不到就直说
"搜索了但没找到相关信息，建议你..." 不要编造

## 四、未配置搜索 API Key 时

如果用户配置了搜索 Key，正常使用。如果没有配置：
- 用户问纯外部问题时: "我需要联网搜索才能回答这个问题。请在 设置→搜索配置 中配置搜索 API Key（推荐 Tavily，有免费额度）。"
- 用户问可以本地回答的问题: 用本地工具回答，不提搜索
```

### 2.6 提示词注入机制

**对话中的注入**：`prompt-selector.ts` 根据用户首条消息匹配：

```typescript
// 新增 search 分支
if (/搜索|查一下|最新|趋势|行业|竞品|行情|报价.*合理/.test(msg)) {
  return loadPrompt('search') || loadPrompt('default');
}
```

**工具的自我说明**：即使没有命中 search 提示词，`search_web` 工具的 `description` 字段已经包含了足够的使用指引，AI 在需要时会自动调用。系统提示词是锦上添花——让 AI 在搜索模式下更懂怎么搜、怎么答。

### 2.7 搜索 API Key 配置

在系统设置页新增「搜索配置」Tab：
- 搜索供应商下拉（Tavily / SerpAPI / 无）→ 存入 `Setting: category=SEARCH, key=provider`
- API Key 输入框（AES-256 加密）→ 存入 `Setting: category=SEARCH, key=api_key, encrypted=true`
- 最大结果数（默认 5）→ 存入 `Setting: category=SEARCH, key=max_results`
- 测试连接按钮

### 2.8 搜索完整交互流程示例

```
🕐 9:30  用户: "我的小程序报价是不是偏低了？我听说现在行情涨了"

🕐 9:30  AI 内部决策:
         ├─ 问题涉及"外部行情" → 需要 search_web
         ├─ 问题涉及"我的报价" → 需要本地工具
         └─ 同时调用:
              search_web("2025 小程序开发外包 报价 行情 价格范围")
              get_revenue_by_client()
              get_project_margin_ranking()

🕐 9:31  搜索结果返回:
         "小程序开发 2025 报价普遍上涨 20-30%，
          基础小程序 3-6 万，电商类 8-15 万，
          企业级 15-30 万..."

🕐 9:31  本地数据返回:
         客户A: 小程序 5万 (2024.11)
         客户B: 小程序 4.5万 (2025.01)
         客户C: 小程序 6万 (2025.03)

🕐 9:31  AI 综合分析回答:

> 📊 2025年行情（搜索来源）:
> 小程序开发报价比去年涨了约 20-30%，电商类在 8-15 万区间
>
> 📋 你的实际报价（本地数据）:
> | 客户 | 报价 | 时间 |
> |------|------|------|
> | A | 5万 | 2024.11 |
> | B | 4.5万 | 2025.01 |
> | C | 6万 | 2025.03 |
>
> ⚠️ 分析:
> 你的报价确实偏低了。2025 年同类项目市场价在 8 万以上，
> 你最近的单子还在 4.5-6 万区间，比市场低 30-40%。
>
> 💡 建议:
> 1. 新客户报价从 8 万起
> 2. 老客户续费可以说"今年行情涨了，报价调整到 7 万"
> 3. 重点关注利润率，别为了接单把价格压太低
>
> 要不要我帮你调整一下各项目的报价备注？
```

---

## 三、搜索 vs 定时分析 对比

| 维度 | AI 搜索 | AI 定时分析 Job |
|------|--------|----------------|
| 触发方式 | 用户在对话中提问 | Cron 定时自动执行 |
| 谁做决策 | 用户主动问问题 | AI 主动发现问题 |
| 数据来源 | 本地数据库 + 外部互联网 | 本地数据库 |
| 产出 | 对话回复（流式） | Notification + AiInsight + UserMemory |
| AI 角色 | 按需回答 | 主动盯盘 |
| 举例 | "React 19 适合升级吗？" | 每天 8:00 自动分析今日该做什么 |

---

## 三、AI 驱动的定时任务：解决一人公司 6 大痛点

### 3.1 痛点→方案对照

| 痛点 | 一人公司场景 | AI 自动化方案 | Job |
|------|------------|-------------|-----|
| 🧠 什么都靠记 | 客户说过要联系，3 周后才想起来 | 每日检查：哪些客户该联系了、哪些承诺还没兑现 | 晨间简报 |
| 🤷 不知道做什么 | 10 个任务堆着，干完一个不知道下一个 | AI 综合截止日+优先级+依赖关系给行动建议 | 晨间简报 |
| 📊 没空看钱 | 项目做完了也不知道赚没赚 | 每周自动分析各项目利润/趋势/隐患 | 财务脉搏 |
| 🏝 没有第二大脑 | 上个月决定的事这周忘了原因 | 每周从对话中提炼决策/偏好/信息 | 记忆沉淀 |
| 🔇 没人提醒 | 忘了检查客户沟通频率 | 每日扫描客户联络间隔，标记冷淡的 | 客户雷达 |
| 📝 没空写周报 | 周五晚上花 1 小时拼凑 | AI 自动生成周报，你只需看一眼点发送 | 自动周报 |

### 3.2 6 个 AI Job 详解

---

#### Job 1: 晨间简报 ☀️ `0 8 * * *`

**一人公司痛点**：早上坐下来不知道从哪开始。10 个任务堆着，客户催着，邮件等着。
**AI 不是发"3 个任务逾期了"，而是当一日参谋。**

```
数据收集:
├── 今日待办 (dueDate = today)
├── 所有未完成任务 (按优先级+截止日排序)
├── 昨日完成的任务
├── 逾期的任务
└── 最近 7 天的对话摘要 (了解最近在忙什么)

AI Prompt (system-morning.txt):
"你是创业者的每日参谋。根据今天的任务数据，给出：
1. 🌅 今日焦点 (2-3个，按重要+紧急组合判断)
2. ⏰ 时间建议 (上午做什么下午做什么)
3. ⚠️ 风险提醒 (什么可能被忽略/拖延)
4. 💪 昨日成就 (完成了什么，肯定用户)
语气像可靠的朋友，不像机器人。不要超过300字。"

AI 输出示例:
> ☀️ 早上好！昨天完成了「支付模块联调」和「客户报价单」，干得不错 💪
> 
> 今天有 8 个待办，我建议重点处理：
> 
> **上午**：先搞「登录页重构」—— 逾期 2 天了，而且阻塞了测试流程
> **下午**：「张总需求沟通」—— 约了今天，记得提前 10 分钟准备
> 
> ⚠️  对了，「API 文档更新」虽然不急但是已经拖了 2 周了，今天有空的话推一下

写入:
├── Notification (type=AI_INSIGHT, title="今日简报")
└── AiInsight (type=TIME)
```

---

#### Job 2: 客户雷达 📡 `0 9 * * *`

**一人公司痛点**：客户 A 说"过段时间再聊"，三个月后才想起来没联系。有些客户慢慢就流失了，但你根本不知道。

```
数据收集:
├── 所有客户 + 最近一次沟通日期
├── 每个客户关联的项目状态
├── 每个客户的收入贡献
└── 沟通历史记录

AI Prompt (system-client-radar.txt):
"你是客户关系顾问。分析以下客户数据，找出：
1. 🔴 红色预警：超过 30 天没联系的活跃客户（可能流失）
2. 🟡 黄色关注：15-30 天没联系的活跃客户（该联系了）
3. 💰 价值变化：收入最高的 3 个客户 vs 投入最多的 3 个客户
4. 📝 行动建议：本周应该主动联系谁，为什么，聊什么"

AI 输出示例 (截断):
> 📡 客户雷达扫描完毕：
> 
> 🔴 **张总（XX科技）** 已 45 天未联系 —— 项目「官网改版」还在进行中
>   → 建议今天发个消息："张总好，官网改版进展如何？我们刚完成了..."
> 
> 🟡 **李经理（ABC教育）** 已 18 天未联系
>   → 项目刚上线，该做回访了
> 
> 💰 前 3 客户贡献了 62% 的收入，保持好联系

写入:
├── Notification (type=AI_INSIGHT, title="客户雷达")
└── AiInsight (type=CUSTOMER)
```

---

#### Job 3: 财务脉搏 💰 Cron: `0 10 * * *` (工作日)

**一人公司痛点**：月底看账单才知道超支了。哪个项目赚了哪个亏了？不清楚。

```
数据收集:
├── 本月各项目成本 vs 预算
├── 本月 vs 上月成本趋势
├── 成本类别分布
├── 收入最多的项目/客户
└── 现金流概览

AI Prompt (system-finance-pulse.txt):
"你是财务助手。分析以下财务数据，关注一人公司的特点：
1. 💸 成本异常：有没有突然增长的类别？和上月比趋势如何？
2. 🚨 预算预警：哪些项目快超预算了？
3. 📈 盈利洞察：哪些项目/客户最赚钱（不是收入最高，是利润率最高）
4. 💡 省钱建议：有没有可优化的支出？"

AI 输出示例:
> 💰 本月财务脉搏：
> 
> 📈 「官网改版」利润率最高（42%），可以多接这类项目
> 🚨 「后台管理系统」成本已达预算的 85%，主要是外包成本超了
> 💡 本月云服务费用比上月涨了 30%，检查一下是不是有闲置资源
```

---

#### Job 4: 自动周报 📊 Cron: `0 9 * * 1` (周一)

**一人公司痛点**：周报是给自己看的，但每周五晚上对着空白文档发呆 1 小时。

```
数据收集:
├── dashboard.stats (项目数/任务数/完成率)
├── 本周完成的任务
├── 本周新增的任务
├── 本周成本汇总
├── 本周对话条数
└── 目标进展

AI Prompt (weekly-report.txt):
"你是一人公司的周报撰写助手。根据以下数据生成结构化的周报..."

AI 输出: Markdown 格式周报，直接可用
```

---

#### Job 5: 记忆沉淀 🧠 Cron: `0 20 * * 0` (周日)

**一人公司痛点**：3 个月前为什么决定用这个方案？和张总聊的时候他说了什么偏好？

```
数据收集:
├── 本周所有对话记录 (截断到 3000 字)
└── 本周新写入的 UserMemory

AI Prompt:
"从以下对话中提取关键知识，以 JSON 数组返回：
- PREFERENCE: 用户的偏好、习惯、喜欢的风格
- DECISION: 做出的决定和原因
- INFO: 重要的业务信息（客户说过的需求、报价、承诺）
- PATTERN: 重复出现的问题或模式

每条包含 key (一句话标签) 和 value (详细说明)"

AI 返回:
[
  { category: "DECISION", key: "选用 deepseek 而非 gpt-4o", value: "因为成本低且中文能力好...", confidence: 0.9 },
  { category: "INFO", key: "张总预算8万做官网", value: "...", confidence: 0.8 }
]

写入: UserMemory (upsert, source='weekly-ai')
```

---

#### Job 6: 业务脉冲 🫀 Cron: `0 10 * * 0` (周日)

**一人公司痛点**：忙了一周但不清楚整体怎么样。不能只看钱，还要看客户满意度、项目健康度、个人状态。

```
数据收集:
├── 本周项目/任务/成本统计
├── 目标进展
├── 客户活跃度
├── 本周对话活跃度

AI Prompt:
"对用户的业务做一次简短的'体检'，从四个维度打分（1-10）：
- 💰 财务健康 (收入/成本/利润率)
- 👥 客户关系 (沟通频率/满意度/新客)
- 📋 项目进展 (完成率/延期率)
- 🎯 个人效率 (完成任务数/专注度)

指出最需要关注的一个维度和一个具体的改进建议。"
```

---

## 四、提示词体系总览

| 文件 | 用途 | 注入时机 |
|------|------|---------|
| `system-default.txt` | 日常对话（已有） | 通用 |
| `system-create.txt` | 创建操作引导（已有） | 关键词: 创建/新建 |
| `system-analyze.txt` | 业务分析（已有） | 关键词: 分析/评估 |
| `system-schedule.txt` | 排期规划（已有） | 关键词: 排期/安排 |
| `system-search.txt` | **新增** 联网搜索指引 | 关键词: 搜索/查一下/最新 |
| `system-morning.txt` | **新增** 晨间简报 AI 分析 | Job 专用 |
| `system-client-radar.txt` | **新增** 客户雷达 AI 分析 | Job 专用 |
| `system-finance-pulse.txt` | **新增** 财务脉搏 AI 分析 | Job 专用 |
| `weekly-report.txt` | 周报生成 | Job 专用 |
| `memory-extract.txt` | **新增** 记忆提取 | Job 专用 |
| `health-check.txt` | **新增** 业务体检 | Job 专用 |

---

## 五、提示词注入方式

### 5.1 对话中的提示词 → 已有机制

`prompt-selector.ts` 根据用户消息关键词自动选择。新增 `search` 关键词匹配：
```typescript
if (/搜索|查一下|最新|趋势|行业|竞品/.test(msg)) {
  return loadPrompt('search') || loadPrompt('default');
}
```

### 5.2 定时 Job 中的提示词 → 新机制

Job 直接读取 prompt 文件，不经过 selector：
```typescript
// 在 weekly-report.job.ts 中
const prompt = fs.readFileSync('src/prompts/system-morning.txt', 'utf-8');
const ai = new AIService(userId);
await ai.init();
for await (const event of ai.chat({
  messages: [
    { role: 'system', content: prompt },
    { role: 'user', content: JSON.stringify(collectedData) }
  ]
})) { /* 收集 AI 回复 */ }
```

---

## 六、实施计划

### Phase 0: 依赖
```bash
cd backend && npm install node-cron && npm install -D @types/node-cron
```

### Phase 1: 通知服务（所有 Job 的基石）
- `validators/notification.schema.ts` — Zod
- `services/notification.service.ts` — CRUD + create()
- `routes/notification.routes.ts` — API

### Phase 2: search_web 工具
- `ai/tools/search-web.ts` — 联网搜索 tool
- `prompts/system-search.txt` — 搜索提示词
- `prompt-selector.ts` — 新增 search 分支
- `registry.ts` — 注册新工具
- 前端设置页 — 搜索 API Key 配置

### Phase 3: 6 个 AI Job
- `jobs/index.ts` — 注册入口
- `jobs/morning-briefing.job.ts` — 晨间简报 ☀️
- `jobs/client-radar.job.ts` — 客户雷达 📡
- `jobs/finance-pulse.job.ts` — 财务脉搏 💰
- `jobs/weekly-report.job.ts` — 自动周报 📊
- `jobs/memory-keeper.job.ts` — 记忆沉淀 🧠
- `jobs/health-check.job.ts` — 业务脉冲 🫀

### Phase 4: 6 个专用提示词
- `prompts/system-morning.txt`
- `prompts/system-client-radar.txt`
- `prompts/system-finance-pulse.txt`
- `prompts/weekly-report.txt`（重写）
- `prompts/memory-extract.txt`
- `prompts/health-check.txt`

### Phase 5: 服务 + 路由
- `services/report.service.ts` — 报表
- `routes/report.routes.ts` — 报表 API
- `services/search.service.ts` — 搜索历史
- `routes/search.routes.ts` — 搜索 API

### Phase 6: 环境变量 + 启动
- `config.ts` — cronEnabled + searchApiKey
- `server.ts` — 启动时注册 cron

### Phase 7: 验证
- TypeScript 零错误
- 手动触发每个 Job 看 AI 输出质量
