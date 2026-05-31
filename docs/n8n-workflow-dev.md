# n8n 工作流开发流程

> 负责人：开发者 C | 优先级：P1 | 预估工时：4h + 联调

## 一、整体架构

```
n8n (端口 4011)
  ├── Cron 定时触发 ──→ HTTP Request 节点 ──→ 后端 API ──→ Prisma 查数据
  ├── Webhook 触发  ──→ Code 节点 ──→ OpenAI 节点 ──→ Respond to Webhook
  └── 通知推送      ──→ HTTP Request 节点 ──→ 企业微信/飞书/钉钉 Webhook
                                              └─→ 后端 /api/notifications 创建通知记录
```

## 二、7 个工作流清单

| # | 工作流名称 | 触发方式 | Cron 表达式 | 依赖后端 API |
|---|-----------|---------|-------------|-------------|
| 1 | 到期提醒 | Cron | `0 8 * * *` (每天 8:00) | `GET /api/scheduler/delays/:pid` |
| 2 | 成本预警 | Cron | `0 10 * * *` (每天 10:00) | `GET /api/reports/cost-analysis` |
| 3 | 自动周报 | Cron | `0 9 * * 1` (每周一 9:00) | `GET /api/dashboard/summary` + `GET /api/reports/project-progress` |
| 4 | 每周记忆总结 | Cron | `0 20 * * 0` (每周日 20:00) | `GET /api/conversations/weekly` (需新增) |
| 5 | AI 任务解析 | Webhook | — | `POST /api/llm/parse` |
| 6 | 智能排期建议 | Webhook | — | `POST /api/llm/schedule-suggest` |
| 7 | 业务搜索 | Webhook | — | `POST /api/search` |

## 三、开发顺序与依赖

### 进度跟踪

| 阶段 | 状态 | 完成内容 |
|------|------|---------|
| Day 1 基础设施 | ✅ 完成 | notification + webhook + setting + encryption + auth + conversation 服务 |
| Day 2 定时工作流 | ✅ 完成 | 到期提醒 + 成本预警 |
| Day 3 AI 工作流 | ✅ 完成 | 自动周报 + 每周记忆总结 |
| Day 4 Webhook 工作流 | ✅ 完成 | AI 任务解析 + 排期建议 + 业务搜索 |

```
Day 1: 后端基础设施（webhook.routes.ts + notification.service.ts + Setting 表 n8n 配置）
  ↓
Day 2: 定时工作流（#1 到期提醒 + #2 成本预警）— 最简单，先跑通
  ↓
Day 3: 定时工作流（#3 自动周报 + #4 每周记忆总结）— 需要 AI 生成
  ↓
Day 4: Webhook 工作流（#5 AI 任务解析 + #6 排期建议 + #7 业务搜索）
  ↓
联调: n8n ↔ 后端 ↔ 前端全链路测试
```

## 四、n8n 启动方式（Docker）

```bash
# 启动 n8n（端口 4011）
docker run -d --name n8n -p 4011:5678 -v n8n_data:/home/node/.n8n n8nio/n8n

# 停止
docker stop n8n

# 启动
docker start n8n

# 查看日志
docker logs n8n

# 删除容器（数据保存在 n8n_data 卷中）
docker rm -f n8n
```

访问 `http://localhost:4011` 进入 n8n 工作台。

## 五、后端需要实现的接口

### 5.1 Webhook 回调接收（webhook.routes.ts）

```typescript
// POST /api/webhooks/incoming
// n8n 完成任务后回调此接口，携带结果数据
// Body: { workflowId: string, data: any, status: 'success' | 'error' }

// GET /api/health 增强
// 返回 n8n 连通性状态：调用 n8n /healthz 检查
```

### 5.2 通知服务（notification.service.ts）

n8n 生成的报告/预警需要写入 Notification 表：

```typescript
// create(userId, type, title, content, relatedId?)
// type 枚举：TASK_DUE / COST_ALERT / PROJECT_CHANGE / AI_REPORT / SYSTEM
// n8n 通过 HTTP Request 节点调用 POST /api/notifications 创建
```

### 5.3 n8n 配置读取（setting.service.ts）

n8n 地址和密钥存在 Setting 表：

```typescript
// Setting 表：category="N8N", key="base_url", value="http://localhost:4011"
// Setting 表：category="N8N", key="webhook_secret", value="xxx"
```

### 5.4 对话历史查询接口（需新增）

每周记忆总结需要读取本周对话：

```typescript
// GET /api/conversations/weekly?userId=xxx
// 返回本周所有对话记录，供 n8n AI 节点总结
```

## 六、n8n 工作流详细设计

### 5.1 工作流 #1：到期提醒（每天 8:00）

```
┌─────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Cron 触发器  │───→│ HTTP Request     │───→│ IF 节点          │
│ 0 8 * * *   │    │ GET /api/scheduler│    │ 有延期任务？      │
└─────────────┘    │ /delays/:pid     │    └────────┬─────────┘
                   └──────────────────┘             │
                                          Yes ┌─────▼──────────┐
                                              │ HTTP Request   │
                                              │ POST /api/notify│
                                              │ (创建通知)      │
                                              └────────────────┘
```

**n8n 节点配置：**

| 节点 | 类型 | 配置 |
|------|------|------|
| Schedule Trigger | Cron | `0 8 * * *` |
| HTTP Request | GET | `{{env.BASE_URL}}/api/scheduler/delays/{{pid}}` |
| IF | 条件 | `$json.data.length > 0` |
| HTTP Request (通知) | POST | `{{env.BASE_URL}}/api/notifications` Body: `{userId, type:"TASK_DUE", title:"延期预警", content:...}` |

### 5.2 工作流 #2：成本预警（每天 10:00）

```
Cron (10:00) → HTTP GET /reports/cost-analysis → Code (计算超预算) → IF (超预算) → POST /notifications
```

**Code 节点逻辑：**
```javascript
const analysis = $input.first().json.data;
const alerts = [];
for (const project of analysis) {
  if (project.totalCost > project.budget * 0.8) {
    alerts.push({
      projectId: project.id,
      projectName: project.name,
      ratio: (project.totalCost / project.budget * 100).toFixed(1),
    });
  }
}
return alerts.map(a => ({ json: a }));
```

### 5.3 工作流 #3：自动周报（每周一 9:00）

```
Cron (周一 9:00) → HTTP GET /dashboard/summary → HTTP GET /reports/project-progress
  → Code (拼装 Prompt) → OpenAI (生成周报) → Code (格式化) → POST /notifications (AI_REPORT)
```

**Prompt 模板（参考 `backend/src/prompts/weekly-report.txt`）：**
```
你是一人公司的周报助手。根据以下数据生成本周工作周报：

项目数据：{{projectData}}
任务统计：{{taskStats}}
成本数据：{{costStats}}

要求：
- Markdown 格式
- 包含：完成情况、进行中任务、成本概况、下周计划
- 语言简洁，面向个人用户
```

### 5.4 工作流 #4：每周记忆总结（每周日 20:00）

```
Cron (周日 20:00) → HTTP GET /conversations/weekly → Code (拼装 Prompt)
  → OpenAI (总结) → HTTP POST /memory (存入 UserMemory, source="weekly")
```

**参考代码（文档第 5050-5083 行）：**
```javascript
// Code 节点：拼装对话内容
const conversations = $input.first().json.data;
const content = conversations.map(m => `${m.role}: ${m.content}`).join('\n');
return { prompt: `总结用户本周的工作情况，50字以内：\n${content}` };
```

### 5.5 工作流 #5：AI 任务解析（Webhook）

```
Webhook POST /llm-parse → Code (构造 Prompt) → OpenAI → Code (解析 JSON) → Respond to Webhook
```

**后端调用方式：**
```typescript
// backend/src/services/llm.service.ts
const n8nResponse = await fetch(`${config.n8n.baseUrl}/webhook/llm-parse`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: userText }),
});
const taskJson = await n8nResponse.json();
```

### 5.6 工作流 #6：智能排期建议（Webhook）

```
Webhook POST /llm-schedule → Code (构造 Prompt + 任务数据) → OpenAI → Respond to Webhook
```

### 5.7 工作流 #7：业务搜索（Webhook）

```
Webhook POST /search → HTTP Request (搜索 API) → Code (构造 Prompt) → OpenAI (分析) → Respond to Webhook
```

## 七、n8n 凭据配置

在 n8n 界面 → Settings → Credentials 中配置：

| 凭据名称 | 类型 | 用途 |
|---------|------|------|
| TaskFlow API | HTTP Header Auth | `Authorization: Bearer <JWT>` 调用后端 API |
| OpenAI API | OpenAI API | AI 节点调用 GPT |
| 企业微信 Webhook | Webhook | 推送到企业微信群 |
| 飞书 Webhook | Webhook | 推送到飞书群 |

## 八、n8n 环境变量

在 n8n 中通过 Settings → Environment Variables 配置：

```
BASE_URL=http://localhost:3001/api
N8N_WEBHOOK_URL=http://localhost:4011/webhook
```

### 已创建的工作流（7/7 全部完成）

| 工作流 | ID | 类型 | 触发方式 | 状态 |
|--------|-----|------|---------|------|
| 每日到期提醒 | I0gWBVsb3tFgZGWv | ⏰ Cron | `0 8 * * *` (每天 8:00) | ✅ Active |
| 成本预警 | 3cjGnneZOxBTwajY | ⏰ Cron | `0 10 * * *` (每天 10:00) | ✅ Active |
| 自动周报 | IRQltkmSCcss7Jaq | ⏰ Cron | `0 9 * * 1` (每周一 9:00) | ✅ Active |
| 每周记忆总结 | JYZS69skrivXHJy9 | ⏰ Cron | `0 20 * * 0` (每周日 20:00) | ✅ Active |
| AI 任务解析 | 6dHcX3w5pZEccWls | 🔗 Webhook | POST /webhook/llm-parse | ✅ Active |
| 智能排期建议 | XnyUb0zAKiWaDml9 | 🔗 Webhook | POST /webhook/llm-schedule | ✅ Active |
| 业务搜索 | F8hYzfaMhodJopmj | 🔗 Webhook | POST /webhook/business-search | ✅ Active |

### 测试用户

| 字段 | 值 |
|------|-----|
| userId | `cmps8qwcj0000u8jog0if8n58` |
| email | n8n@test.com |
| JWT | 后端 .env 中查看 |

## 九、工作流 JSON 导出

所有工作流完成后，导出 JSON 备份到 `n8n/workflows/` 目录：

```
n8n/
└── workflows/
    ├── 01-overdue-alert.json
    ├── 02-cost-alert.json
    ├── 03-weekly-report.json
    ├── 04-weekly-memory.json
    ├── 05-ai-task-parse.json
    ├── 06-schedule-suggest.json
    └── 07-business-search.json
```

## 十、验收标准

| 检查项 | 通过条件 | 状态 |
|--------|---------|------|
| n8n 启动 | Docker `localhost:4011` 可访问 | ✅ |
| 凭据配置 | n8n API Key 已配置 | ✅ |
| 定时工作流 | 4 个 Cron 工作流状态为 ✅ Active | ✅ |
| Webhook 工作流 | 3 个 Webhook 工作流可被触发并返回结果 | ✅ |
| 通知写入 | n8n 生成的报告/预警正确写入 Notification 表 | ✅ |
| 失败日志 | n8n Executions 页面可查看历史执行记录 | ✅ |
| 工作流备份 | JSON 文件导出到 `n8n/workflows/` 目录 | ✅ |

## 十一、调试技巧

1. **手动触发**：n8n 工作流可用 Manual Trigger 手动测试，不等 Cron
2. **查看输入输出**：点击任意节点查看 `$input` 和 `$output` 数据
3. **Code 节点调试**：用 `console.log()` 输出，结果在节点输出面板查看
4. **Executions 列表**：左侧菜单 Executions 查看历史执行，支持重放
5. **n8n 日志**：启动时加 `--log-level=debug` 查看详细日志
6. **后端日志**：n8n 调用后端 API 时，后端 console 会打印请求日志
