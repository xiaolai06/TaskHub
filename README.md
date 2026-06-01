# TaskFlow+

TaskFlow+ 是面向一人公司、自由职业者和小型服务团队的订单执行工作台。它不做复杂账单、订阅计费或 token 成本核算，而是围绕真实交付闭环：客户 -> 订单报价 -> 任务拆解 -> 排期执行 -> 成本记录 -> 利润复盘 -> 通知提醒。

## 当前定位

TaskFlow+ 的核心目标是让一个人能清楚回答四个问题：

- 今天应该先做什么
- 当前订单能不能按期交付
- 每单报价、成本、利润是否健康
- 本月实际入款和经营风险在哪里

## 功能闭环

1. 客户管理
   - 记录客户资料、联系方式、沟通记录和下次跟进时间。
   - 客户下可查看关联订单、报价、成本、利润和任务进度。

2. 订单/项目管理
   - 项目在产品语义上等同于订单。
   - `budget` 字段统一作为订单报价使用。
   - 项目详情展示报价、成本、利润、成本结构和任务列表。

3. 任务执行
   - 支持优先级、状态、预估工时、最早开始日期、截止日期、任务成本。
   - 任务成本会计入订单总成本，不再只依赖独立成本记录。

4. 排期工作台
   - 后端按优先级、最早开始、截止日和每日可用工时计算排期。
   - 前端可选择订单和每日工时上限，查看延期任务、每日负载和预计完成时间。
   - 可将计算结果应用回任务日期，形成“计划 -> 执行 -> 再排期”的闭环。

5. 经营报表
   - 财务口径统一为：每单报价、成本、利润、月入款。
   - 月入款按所选周期内已完成订单的报价统计。
   - 成本由成本记录和任务快捷成本合并统计。
   - 报表展示订单利润排行、成本结构、工时分布和 AI 经营建议。

6. 通知与自动化
   - 支持站内通知、n8n webhook、SMTP 邮件通知。
   - 晨间简报、周报、订单利润简报、成本预警可接入邮件发送。
   - 成本预警基于“成本超过报价 80%”触发。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Next.js 16, React 19, Tailwind CSS 4, React Query |
| 后端 | Express 5, Prisma 6, TypeScript |
| 数据库 | SQLite 本地开发，可迁移 PostgreSQL |
| AI | OpenAI SDK 兼容接口，可接 DeepSeek、Claude、Ollama 等 |
| 通知 | 站内通知、Webhook、SMTP 邮件 |
| 自动化 | node-cron，支持 n8n 接入 |

## 环境要求

- Node.js 18+，推荐 Node.js 20 LTS
- npm
- Git

## 快速开始

### 1. 安装后端依赖并初始化数据库

```bash
cd backend
npm install
copy .env.example .env
npx prisma db push
npx prisma generate
npx prisma db seed
```

后端 `.env` 至少需要：

```bash
DATABASE_URL="file:./dev.db"
JWT_SECRET="change-this-to-a-long-random-secret-at-least-32-chars"
JWT_EXPIRES_IN="7d"
ENCRYPTION_KEY="32-char-aes-encryption-key-here"
PORT=3001
NODE_ENV="development"
FRONTEND_URL="http://localhost:3000"
LIMIT_ENABLED="false"
```

启动后端：

```bash
npm run dev
```

默认 API 地址：`http://localhost:3001/api`

### 2. 安装前端依赖并启动

```bash
cd ../frontend
npm install
copy .env.example .env.local
npm run dev
```

前端默认地址：`http://localhost:3000`

前端 `.env.local`：

```bash
NEXT_PUBLIC_API_URL="http://localhost:3001/api"
```

## 构建验证

```bash
cd backend
npm run build

cd ../frontend
npm run build
```

当前已处理 Next 16 的 Turbopack root 推断问题，`frontend/next.config.ts` 显式设置了 root，避免构建时向上推断到用户目录导致权限错误。

## 邮件通知

在设置页配置 SMTP 后，可以发送测试邮件。后端通知服务支持：

- SMTP 配置读取
- 测试邮件发送
- 晨间简报邮件
- 周报邮件
- n8n webhook 通知兼容

常见 SMTP 字段：

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-account@example.com
SMTP_PASS=your-password
SMTP_FROM=TaskFlow+ <your-account@example.com>
```

## 目录结构

```text
TaskFlow+/
  backend/
    prisma/              数据库 schema 和 seed
    src/
      ai/                AI 工具与能力
      jobs/              定时任务：简报、周报、成本预警等
      routes/            REST API
      services/          业务逻辑
      validators/        Zod 校验
  frontend/
    src/
      app/               Next.js App Router 页面
      components/        UI 与业务组件
      hooks/             React Query hooks
      lib/               API 和工具函数
  n8n/                   n8n 工作流资料
  docs/                  项目文档
  TaskFlow+ 产品定位.docx
  README.md
```

## 产品边界

保留：订单报价、订单成本、订单利润、月入款、任务排期、客户跟进、AI 简报、邮件通知。

砍掉：复杂账单、发票、订阅计费、token 成本统计、与交付闭环无关的财务细项。

## 测试账号

如果已执行 seed，可使用：

| 角色 | 邮箱 | 密码 |
| --- | --- | --- |
| 管理员 | admin@taskflow.com | 123456 |
| 普通用户 | user@taskflow.com | 123456 |