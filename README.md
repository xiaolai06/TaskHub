# TaskFlow+

智能项目管理工具 —— 面向一人公司的 AI 驱动项目管理平台。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Next.js 14 + Tailwind CSS + shadcn/ui |
| 状态管理 | Zustand + React Query |
| 后端 | Express + Prisma ORM |
| 数据库 | SQLite (本地) / PostgreSQL (线上) |
| AI | OpenAI / Claude / DeepSeek SDK |
| 自动化 | n8n 工作流引擎 |

## 快速开始

### 环境要求

- Node.js 18+（推荐 20 LTS）
- npm 或 pnpm
- Git

### 1. 克隆项目

```bash
git clone <repo-url>
cd heikesong
```

### 2. 启动后端

```bash
cd backend
npm install
npx prisma db push
npx prisma generate
npm run dev
```

后端运行在 http://localhost:3001

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 http://localhost:3000

### 4. 启动 n8n（可选）

```bash
npm install n8n -g
n8n start
```

n8n 运行在 http://localhost:5678

## 项目结构

```
heikesong/
├── backend/          # Express + Prisma 后端
│   ├── src/          # 源码
│   ├── prisma/       # 数据库 Schema
│   └── tests/        # 测试
├── frontend/         # Next.js 前端
│   ├── src/
│   │   ├── app/      # 页面路由
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
├── n8n/              # n8n 工作流
├── docs/             # 文档
└── README.md
```

## 常用命令

```bash
# 后端
cd backend
npm run dev          # 启动开发服务器
npm run build        # 构建
npm run test         # 运行测试
npx prisma studio    # 打开数据库可视化
npx prisma db push   # 同步 Schema 到数据库

# 前端
cd frontend
npm run dev          # 启动开发服务器
npm run build        # 构建
```

## 文档

详细开发文档请查看 [docs/development-docs.html](docs/development-docs.html)
