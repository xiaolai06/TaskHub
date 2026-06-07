# 智汇轻营 TaskHub

面向一人公司 / 自由职业者的 **智能订单执行工作台**。

不是又一个项目管理工具——而是你的 AI 经营合伙人。

## ✨ 核心亮点

- **🤖 AI Agent** — 40 个工具 + 5 种角色提示词，AI 可直接操作业务数据
- **📅 智能排期** — 甘特图 + 插单模拟 + 冲突检测 + 历史工时学习
- **💰 经营分析** — 利润/现金流/成本拆解/客户价值/四维健康度评估
- **📨 多渠道推送** — 站内 + 邮件 + 企业微信/飞书/钉钉群机器人
- **⏰ 6 个定时任务** — 晨间简报、客户雷达、利润脉搏、周报、体检、记忆沉淀
- **🔒 企业级安全** — AES-256-GCM 加密、JWT 静默续签、数据隔离、写操作确认

## 🛠 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui + React Query + Zustand |
| 后端 | Express 5 + Prisma 6 + SQLite + Zod 3 |
| AI | OpenAI SDK（兼容 DeepSeek / OpenAI / Ollama 等 23+ 供应商） |
| 推送 | nodemailer (SMTP) + 企业微信/飞书/钉钉 Webhook |
| 定时 | node-cron |

## 🚀 快速开始

### 环境要求

- Node.js 18+（推荐 20 LTS）
- npm

### 1. 后端

```bash
cd backend
npm install
cp .env.example .env    # 编辑 .env 填写必要配置
npx prisma db push
npx prisma generate
npm run dev             # http://localhost:3001
```

`.env` 最少需要：

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-random-secret-at-least-32-chars"
ENCRYPTION_KEY="your-32-char-aes-key-here"
```

### 2. 前端

```bash
cd frontend
npm install
npm run dev             # http://localhost:3002
```

前端通过 Next.js Rewrite 自动代理 `/api/*` 到后端。

## 📁 目录结构

```
TaskHub/
├── backend/
│   ├── prisma/           # 数据库 Schema + Seed
│   └── src/
│       ├── ai/tools/     # 40 个 AI 工具
│       ├── jobs/         # 6 个定时任务
│       ├── routes/       # 21 个 API 模块
│       ├── services/     # 业务逻辑层
│       └── validators/   # Zod 校验
├── frontend/
│   └── src/
│       ├── app/          # Next.js App Router（12 个页面）
│       ├── components/   # UI + 业务组件
│       └── hooks/        # React Query Hooks
├── docs/
│   ├── feature-overview.html       # 功能简介
│   ├── tech-implementation-guide.html  # 技术实现说明
│   ├── ai-implementation-guide.html    # AI 功能说明
│   └── DEPLOYMENT.md               # 部署指南
└── README.md
```

## 📖 文档

| 文档 | 说明 |
|------|------|
| [功能简介](docs/feature-overview.html) | 完整功能展示，适合对外介绍 |
| [技术实现](docs/tech-implementation-guide.html) | 架构、数据库、AI 引擎、安全机制 |
| [AI 功能说明](docs/ai-implementation-guide.html) | 40 个工具、提示词、定时任务详解 |
| [部署指南](docs/DEPLOYMENT.md) | 生产环境部署步骤 |

## 🧪 测试账号

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | admin@taskflow.com | 123456 |
| 普通用户 | user@taskflow.com | 123456 |

## 👥 团队

**Tipo** — 冯鸣森 · 赖沛盛 · 黄思悦 · 金睿昕
