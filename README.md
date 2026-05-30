# TaskFlow+

智能项目管理工具 —— 面向一人公司的 AI 驱动项目管理平台。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui |
| 状态管理 | Zustand + React Query |
| 后端 | Express 5 + Prisma 6 |
| 数据库 | SQLite（本地）/ PostgreSQL（线上） |
| AI | OpenAI SDK（DeepSeek / Claude / Ollama） |
| 自动化 | n8n 工作流引擎 |

## 环境要求

- Node.js 18+（推荐 20 LTS）
- npm
- Git

检查版本：
```bash
node -v    # 应显示 v18+ 或 v20+
npm -v
git --version
```

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/jiumuchuan/TaskFlow.git
cd TaskFlow
git checkout xiaolai    # 切到开发分支
```

### 2. 安装后端依赖 + 初始化数据库

```bash
cd backend
npm install
cp .env.example .env    # 复制环境变量（Windows 用 copy .env.example .env）
npx prisma db push      # 同步表结构到 SQLite
npx prisma generate     # 生成 Prisma Client
npx prisma db seed      # 填充测试数据
```

### 3. 启动后端

```bash
npm run dev
```

看到以下输出说明成功：
```
✅ 数据库连接成功
🚀 服务器运行在 http://localhost:3001
📡 API 地址: http://localhost:3001/api
💚 健康检查: http://localhost:3001/api/health
```

### 4. 安装前端依赖 + 启动

```bash
cd ../frontend
npm install
npm run dev
```

前端运行在 http://localhost:3000

### 5. 验证

浏览器打开 http://localhost:3000，应该能看到登录页面。

测试账号：
| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | admin@taskflow.com | 123456 |
| 普通用户 | user@taskflow.com | 123456 |

## 环境变量说明

### backend/.env

```bash
# 数据库（SQLite 文件路径，不用改）
DATABASE_URL="file:./dev.db"

# 认证（必填，缺失会启动报错）
JWT_SECRET="改成长随机字符串至少32位"
JWT_EXPIRES_IN="7d"

# 加密（必填，用于加密 API Key 等敏感配置）
ENCRYPTION_KEY="32位AES加密密钥"

# 服务
PORT=3001
NODE_ENV="development"
FRONTEND_URL="http://localhost:3000"

# 限频（开发环境可关闭）
LIMIT_ENABLED="false"
```

### frontend/.env.local

```bash
NEXT_PUBLIC_API_URL="http://localhost:3001/api"
```

## 常用开发命令

```bash
# ===== 后端 =====
cd backend
npm run dev                    # 启动开发服务器（热更新）
npx prisma studio              # 浏览器看数据（http://localhost:5555）
npx prisma db push             # 改了 schema 后同步到数据库
npx prisma generate            # 改了 schema 后重新生成类型
npx prisma db seed             # 重新填充测试数据
npx prisma db push --force-reset  # 重置数据库（清空重建）

# ===== 前端 =====
cd frontend
npm run dev                    # 启动开发服务器
npm run build                  # 构建生产版本
```

## 项目结构

```
TaskFlow/
├── backend/                    # Express + Prisma 后端
│   ├── src/
│   │   ├── app.ts              # Express 应用入口
│   │   ├── server.ts           # 启动服务器
│   │   ├── config/             # 环境变量配置
│   │   ├── middleware/         # 中间件（auth/校验/限频/错误处理）
│   │   ├── routes/             # 路由定义
│   │   ├── services/           # 业务逻辑
│   │   ├── validators/         # Zod 校验 Schema
│   │   ├── ai/                 # AI 工具和能力
│   │   ├── prompts/            # AI Prompt 模板
│   │   └── utils/              # 工具函数
│   ├── prisma/
│   │   ├── schema.prisma       # 数据库表结构（16 张表）
│   │   ├── seed.ts             # 种子数据
│   │   └── dev.db              # SQLite 数据库文件
│   └── tests/                  # 测试文件
├── frontend/                   # Next.js 前端
│   ├── src/
│   │   ├── app/                # 页面路由（App Router）
│   │   ├── components/         # 组件（ui/ + features/）
│   │   ├── hooks/              # 自定义 Hooks
│   │   └── lib/                # 工具函数（api/auth/utils）
│   └── public/                 # 静态资源
├── n8n/                        # n8n 工作流
├── docs/                       # 文档
├── CLAUDE.md                   # Claude Code 开发规则
├── .mcp.json                   # MCP 服务器配置
└── README.md
```

## 遇到问题？

1. **后端启动报"缺少环境变量"** → 检查 `.env` 文件是否创建，必填项是否填写
2. **数据库表不存在** → 运行 `npx prisma db push`
3. **Prisma 类型报错** → 运行 `npx prisma generate`
4. **前端请求 404** → 确认后端已启动在 3001 端口
5. **端口被占用** → 改 `.env` 中的 `PORT`，或 `lsof -i :3001` 找占用进程

## 文档

- 详细开发文档：[docs/development-docs.html](docs/development-docs.html)
- Claude Code 开发规则：[CLAUDE.md](CLAUDE.md)
