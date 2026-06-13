# TaskFlow+ 外部数据来源说明

> 最后更新：2026-06-11

## 架构总览

```
┌─────────────┐    fetch + SSE     ┌──────────────┐
│   Frontend   │ ─────────────────→ │   Backend    │
│  Next.js 16  │  Cookie (JWT)      │  Express 5   │
│  Port 3002   │ ←───────────────── │  Port 3001   │
└─────────────┘    JSON / SSE       └──────┬───────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
             ┌──────────┐          ┌──────────────┐       ┌────────────┐
             │  SQLite   │          │  AI Provider  │       │  外部 API   │
             │  dev.db   │          │  22+ 供应商    │       │  10+ 服务   │
             └──────────┘          └──────────────┘       └────────────┘
```

---

## 1. 前端 → 后端（内部通信）

| 接口类型 | 端点 | 认证方式 | 说明 |
|---------|------|---------|------|
| REST API | `http://localhost:3001/api/*` | HTTP-only Cookie (JWT) | 所有业务 CRUD 操作 |
| SSE 流式 | `POST /api/llm/chat/stream` | Cookie | AI 聊天实时流式输出 |

**前端 HTTP 客户端**：`frontend/src/lib/api.ts`
- 基于原生 `fetch()`，自动携带 `credentials: 'include'`
- 401 响应自动跳转登录页
- 通过 Next.js `rewrites` 代理：`/api/:path*` → `http://localhost:3001/api/:path*`

**前端数据管理**：TanStack React Query
- 所有业务数据通过 React Query hooks 获取，自带缓存和失效机制
- 客户端状态用 Zustand（仅认证状态）

---

## 2. AI 服务（核心外部依赖）

### 2.1 AI 对话服务

| 项目 | 详情 |
|------|------|
| **SDK** | `openai` npm 包（通用 OpenAI 兼容客户端） |
| **支持供应商** | DeepSeek、OpenAI、Claude（via proxy）、Ollama、Mistral、Groq、Together AI、xAI、Perplexity、Fireworks、Cerebras、Cohere、DeepInfra、SiliconFlow、智谱、通义千问、月之暗面、百度、MiniMax、阶跃星辰、豆包、零一万物 等 22+ |
| **认证方式** | Bearer Token（API Key，AES-256-GCM 加密存储于数据库） |
| **调用方式** | `chat.completions.create({ stream: true })` + 工具调用循环（最多 10 轮） |
| **容错机制** | 主模型失败 → 自动回退到 `powerfulModel` |
| **配置来源** | 数据库 `Setting` 表（category: `AI` / `AI_PROVIDER`），环境变量作为默认值 |
| **核心文件** | `backend/src/services/ai.service.ts` |

### 2.2 AI 模型发现

| 项目 | 详情 |
|------|------|
| **端点** | `{供应商baseUrl}/models` |
| **认证** | Bearer Token |
| **超时** | 5-8 秒 |
| **用途** | 设置页面动态获取可用模型列表、测试连接 |
| **核心文件** | `backend/src/services/setting.service.ts` |

---

## 3. 外部搜索与资讯 API

| 服务 | 端点 | 认证 | 限频 | 用途 | 核心文件 |
|------|------|------|------|------|---------|
| **Tavily** | `POST https://api.tavily.com/search` | API Key（请求体） | 按计划 | AI 联网搜索 | `backend/src/ai/tools/search-web.ts` |
| **SerpAPI** | `GET https://serpapi.com/search` | API Key（查询参数） | 100 次/月免费 | AI 联网搜索（备用） | 同上 |
| **GitHub** | `GET https://api.github.com/search/repositories` | 无（可选 Token） | 10 次/分（无 Token） | 热门项目发现 | `backend/src/ai/tools/github-trending.ts` |
| **Hacker News** | `GET https://hacker-news.firebaseio.com/v0/*` | 无 | 无限制 | 技术资讯获取 | `backend/src/ai/tools/hacker-news.ts` |
| **Hacker News** | `GET https://hn.algolia.com/api/v1/search` | 无 | 无限制 | HN 搜索（研究功能） | `backend/src/services/search.service.ts` |
| **Dev.to** | `GET https://dev.to/api/articles` | 无 | 无限制 | 开发者文章获取 | `backend/src/ai/tools/dev-to.ts` |
| **npm Registry** | `GET https://registry.npmjs.org/-/v1/search` | 无 | 无限制 | 包搜索 | `backend/src/ai/tools/npm-search.ts` |
| **Product Hunt** | `POST https://api.producthunt.com/v2/api/graphql` | Bearer Token | 100 次/天 | 产品发现 | `backend/src/ai/tools/product-hunt.ts` |
| **汇率 API** | `GET https://open.er-api.com/v6/latest/{currency}` | 无 | 无限制 | 实时汇率查询 | `backend/src/ai/tools/exchange-rate.ts` |

> **说明**：Tavily / SerpAPI 通过数据库 `Setting` 表配置（category: `SEARCH`），API Key 加密存储。
> Product Hunt Token 同样存储于 `SEARCH` category，key 为 `producthunt_token`。

---

## 4. 通知与消息推送

### 4.1 邮件服务（SMTP）

| 项目 | 详情 |
|------|------|
| **SDK** | `nodemailer` |
| **认证** | SMTP 用户名/密码 |
| **配置来源** | 环境变量 `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`，或数据库 `Setting`（category: `EMAIL`） |
| **用途** | 测试邮件、每日摘要、每周报告、晨间简报 |
| **核心文件** | `backend/src/services/notification.service.ts` |

### 4.2 Webhook 推送

| 平台 | 载荷格式 | 认证 |
|------|---------|------|
| **企业微信** | `{ msgtype: 'markdown', markdown: { content } }` | Webhook URL |
| **飞书** | `{ msg_type: 'interactive', card: { ... } }` | Webhook URL |
| **钉钉** | `{ msgtype: 'markdown', markdown: { title, text } }` | Webhook URL |
| **Slack** | `{ text }` | Webhook URL |

- Webhook URL 存储于数据库 `Setting` 表（category: `NOTIFY`）
- 支持动态 Webhook 列表（JSON 数组，key: `webhooks`）
- 核心文件：`backend/src/services/notification.service.ts`、`backend/src/ai/tools/send-webhook.ts`

### 4.3 n8n 工作流自动化

| 项目 | 详情 |
|------|------|
| **入站端点** | `POST /api/webhook/incoming` |
| **通知端点** | `POST /api/webhook/notify` |
| **认证** | `x-webhook-secret` 请求头 |
| **配置来源** | 环境变量 `N8N_BASE_URL`（默认 `http://localhost:4011`）、`N8N_WEBHOOK_SECRET` |
| **核心文件** | `backend/src/routes/webhook.routes.ts` |

**已配置的 n8n 工作流**（`n8n/workflows/`）：

| 工作流 | 触发方式 | 功能 |
|--------|---------|------|
| `01-overdue-alert` | 定时 | 任务逾期预警 |
| `02-cost-alert` | 定时 | 成本超限提醒 |
| `03-weekly-report` | 定时（周一） | 周报生成 |
| `04-weekly-memory` | 定时（周日） | AI 记忆整理 |
| `05-ai-task-parse` | 按需 | AI 解析自然语言创建任务 |
| `06-schedule-suggest` | 按需 | AI 日程建议 |
| `07-business-search` | 按需 | 商业信息搜索 |

---

## 5. 定时任务（内建 Cron Jobs）

所有定时任务通过 `node-cron` 调度，读写本地 SQLite 数据库：

| 任务 | 调度时间 | 数据来源 | 触发通知 |
|------|---------|---------|---------|
| `due-reminder` | 每天 8:00 | User, Project, Task | 逾期任务提醒 |
| `cost-alert` | 每天 10:00 | User, Project, CostRecord | 成本超限提醒 |
| `morning-briefing` | 每天 8:00 | User, Task, Conversation, Setting | 晨间简报（含 AI 生成） |
| `finance-pulse` | 每天 10:00 | User, Project, CostRecord, Task | 财务脉搏 |
| `client-radar` | 每天 9:00 | User, Customer, Communication | 客户动态提醒 |
| `weekly-report` | 每周一 9:00 | User, Task, Conversation | 周报（含 AI 生成） |
| `weekly-memory` | 每周日 20:00 | User, Conversation, UserMemory | AI 记忆整理 |
| `health-check` | 每周日 10:00 | User, Project, Task, Goal, Customer | 系统健康检查 |

> 定时任务的通知分发通过 SMTP 邮件 + Webhook 推送 + 数据库 `Notification` 表三种渠道。

---

## 6. 数据库

| 项目 | 详情 |
|------|------|
| **引擎** | SQLite（单文件 `backend/prisma/dev.db`） |
| **ORM** | Prisma 6（`@prisma/client ^6.9.0`） |
| **连接** | `DATABASE_URL="file:./dev.db"` |
| **表数量** | 16 张（User, Session, Project, Task, Customer, Communication, CostRecord, Goal, GoalMilestone, GoalProgressLog, Conversation, Notification, Setting, UserMemory, UserPreference, SearchResult, SavedResearch, Greeting, ToolExecutionLog, CronJob） |

---

## 7. 安全与加密

| 项目 | 说明 |
|------|------|
| **API Key 存储** | AES-256-GCM 加密后存入 `Setting` 表，运行时解密 |
| **加密密钥** | 环境变量 `ENCRYPTION_KEY`（SHA-256 派生 256 位密钥） |
| **密码** | `bcryptjs` 哈希（不可逆） |
| **会话** | JWT Token 存 HTTP-only Cookie |
| **Webhook 认证** | `x-webhook-secret` 请求头校验 |

---

## 8. 环境变量速查

| 变量 | 默认值 | 用途 |
|------|--------|------|
| `PORT` | `3001` | 后端端口 |
| `DATABASE_URL` | `file:./dev.db` | 数据库路径 |
| `FRONTEND_URL` | `http://localhost:3000,http://localhost:3002` | CORS 允许源 |
| `ENCRYPTION_KEY` | — | 数据加密密钥 |
| `DEFAULT_AI_PROVIDER` | `deepseek` | 默认 AI 供应商 |
| `DEFAULT_AI_API_KEY` | — | 默认 AI API Key |
| `DEFAULT_AI_BASE_URL` | — | 默认 AI 端点 |
| `DEFAULT_AI_MODEL` | — | 默认 AI 模型 |
| `N8N_BASE_URL` | `http://localhost:4011` | n8n 服务地址 |
| `N8N_WEBHOOK_SECRET` | — | n8n Webhook 认证 |
| `SMTP_HOST` | — | 邮件服务器 |
| `SMTP_PORT` | `587` | 邮件端口 |
| `SMTP_USER` | — | 邮件用户名 |
| `SMTP_PASS` | — | 邮件密码 |

---

## 9. 数据流向图

```
用户操作（前端）
  │
  ├─ CRUD 操作 ──→ React Query ──→ api.ts ──→ Express Routes ──→ Prisma ──→ SQLite
  │
  ├─ AI 聊天 ──→ SSE fetch ──→ Express Routes ──→ AI Service ──→ AI Provider API
  │                                                               ↓
  │                                                    工具调用（搜索/资讯/汇率...）
  │                                                               ↓
  │                                                    外部 API（Tavily/GitHub/HN...）
  │
  └─ 定时任务 ──→ node-cron ──→ Service 层 ──→ Prisma 查询 ──→ AI 生成摘要
                                  ↓                              ↓
                          通知分发（SMTP / Webhook / DB Notification）
```


