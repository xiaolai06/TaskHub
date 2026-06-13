# TaskFlow+ 部署与安全完整指南

> 版本：v1.0 | 日期：2026-06-11
>
> 本文档覆盖：方案设计 → 代码改造 → 容器化 → 服务器部署 → 安全加固 → 多人访问 → 运维手册。
> 部署前请通读全文，按阶段顺序执行。

---

## 目录

- [第一部分：方案设计](#第一部分方案设计)
  - [1. 背景与目标](#1-背景与目标)
  - [2. 现状评估](#2-现状评估)
  - [3. 部署架构设计](#3-部署架构设计)
  - [4. 技术选型](#4-技术选型)
  - [5. 环境变量配置方案](#5-环境变量配置方案)
  - [6. 安全方案](#6-安全方案)
  - [7. 资源与成本](#7-资源与成本)
- [第二部分：代码改造](#第二部分代码改造)
  - [8. 后端安全中间件](#8-后端安全中间件)
  - [9. 前端 standalone 输出](#9-前端-standalone-输出)
  - [10. 生成真实密钥](#10-生成真实密钥)
- [第三部分：容器化与部署](#第三部分容器化与部署)
  - [11. 后端 Dockerfile](#11-后端-dockerfile)
  - [12. 前端 Dockerfile](#12-前端-dockerfile)
  - [13. Docker Compose 编排](#13-docker-compose-编排)
  - [14. Nginx 配置](#14-nginx-配置)
  - [15. 服务器部署步骤](#15-服务器部署步骤)
  - [16. 域名与 HTTPS](#16-域名与-https)
- [第四部分：多人访问](#第四部分多人访问)
  - [17. 团队成员如何访问](#17-团队成员如何访问)
  - [18. 账号管理](#18-账号管理)
  - [19. 访问人数与配置对照](#19-访问人数与配置对照)
- [第五部分：运维手册](#第五部分运维手册)
  - [20. 日常操作命令](#20-日常操作命令)
  - [21. 数据备份与恢复](#21-数据备份与恢复)
  - [22. 故障排查](#22-故障排查)
  - [23. 常见问题 FAQ](#23-常见问题-faq)
  - [24. 后续演进路线](#24-后续演进路线)
- [附录](#附录)
  - [A. 文件变更总览](#a-文件变更总览)
  - [B. 部署检查清单](#b-部署检查清单)

---

# 第一部分：方案设计

---

## 1. 背景与目标

TaskFlow+ 当前运行在本地开发环境（`localhost`），前后端分离架构。本方案的目标是将其部署到公网服务器，让团队成员通过浏览器访问，同时满足基本的生产安全要求。

### 1.1 当前架构

```
开发者本机
├── frontend (Next.js :3002)  ──rewrite──→  backend (Express :3001)
│                                              └── SQLite (dev.db)
└── 浏览器 → localhost:3002
```

### 1.2 目标架构

```
互联网用户
    │
    ▼
  域名 (your-domain.com)
    │
    ▼ HTTPS
┌──────────────────────────────────────┐
│  云服务器 (Ubuntu 22.04, 2C4G)        │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Nginx 反向代理 (:80 / :443)   │  │
│  │  - SSL/TLS 终止                │  │
│  │  - 静态资源缓存                │  │
│  │  - gzip 压缩                   │  │
│  │  - 安全响应头                  │  │
│  └────────┬───────────┬───────────┘  │
│           │           │              │
│      /api/*       其他路径            │
│           │           │              │
│           ▼           ▼              │
│  ┌─────────────┐ ┌─────────────┐    │
│  │  Backend    │ │  Frontend   │    │
│  │  Express 5  │ │  Next.js 16 │    │
│  │  :3001      │ │  :3002      │    │
│  └──────┬──────┘ └─────────────┘    │
│         │                           │
│  ┌──────▼──────┐                    │
│  │  SQLite     │                    │
│  │  (Volume)   │                    │
│  └─────────────┘                    │
└──────────────────────────────────────┘
```

**核心思路**：Nginx 作为唯一对外入口（80/443 端口），内部反代到前端和后端。后端和前端不直接暴露公网。

---

## 2. 现状评估

### 2.1 已具备的能力（无需改动）

| 能力 | 实现方式 | 评价 |
|------|---------|------|
| 分层架构 | routes → validators → services → Prisma | ✅ 清晰规范 |
| API 响应格式 | 统一 `{ success, data/error }` | ✅ 前后端一致 |
| 输入校验 | 所有接口 Zod schema 校验 | ✅ 防注入基础 |
| 认证机制 | JWT httpOnly Cookie + secure 标志 | ✅ 生产可用 |
| 密码安全 | bcrypt (salt=10) | ✅ 符合标准 |
| 登录限频 | 5 次/分钟 | ✅ 防暴力破解 |
| 数据库索引 | Prisma schema 中 @@index 齐全 | ✅ 查询性能有保障 |
| 健康检查 | GET /api/health | ✅ 监控可用 |
| 错误处理 | 统一 errorHandler，分类 AppError/Prisma/JWT | ✅ 不泄露堆栈 |
| 环境变量化 | config.ts 集中管理，.env.example 文档齐全 | ✅ 配置规范 |
| .gitignore | .env、*.db 等敏感文件已排除 | ✅ 密钥不入库 |

### 2.2 需要补充的能力

| 缺失项 | 严重度 | 说明 |
|--------|--------|------|
| 容器化部署 | 🔴 高 | 没有 Dockerfile，无法标准化部署 |
| 编排文件 | 🔴 高 | 没有 docker-compose.yml |
| 反向代理 | 🔴 高 | 没有 Nginx 配置，前后端无法统一入口 |
| 安全响应头 | 🟡 中 | 缺少 helmet（防点击劫持、MIME 嗅探等） |
| gzip 压缩 | 🟡 中 | 没有 compression，响应体积大 |
| standalone 输出 | 🟡 中 | Next.js 未配置 standalone，Docker 镜像会很大 |
| 生产环境密钥 | 🔴 高 | JWT_SECRET / ENCRYPTION_KEY 是占位符 |
| HTTPS | 🔴 高 | 无 SSL 证书，Cookie secure 标志不生效 |
| 数据备份 | 🟡 中 | 无备份策略，SQLite 文件丢失不可恢复 |
| 进程守护 | 🟡 中 | 无 PM2/systemd，进程崩溃不会自动重启 |

---

## 3. 部署架构设计

### 3.1 网络流量路径

```
浏览器发起请求
  │
  ├─ GET https://your-domain.com/
  │   → Nginx(:443) → Frontend(:3002) → 返回 HTML/JS/CSS
  │
  ├─ GET https://your-domain.com/api/health
  │   → Nginx(:443) → Backend(:3001) → 返回 JSON
  │
  ├─ POST https://your-domain.com/api/auth/login
  │   → Nginx(:443) → Backend(:3001) → 校验密码 → 设置 httpOnly Cookie → 返回 JSON
  │
  └─ GET https://your-domain.com/api/tasks
      → Nginx(:443) → Backend(:3001) → 验证 JWT Cookie → 查询 SQLite → 返回 JSON
```

### 3.2 端口规划

| 服务 | 容器端口 | 宿主机映射 | 用途 |
|------|---------|-----------|------|
| Nginx | 80 | 80 | HTTP（重定向到 HTTPS） |
| Nginx | 443 | 443 | HTTPS（对外唯一入口） |
| Backend | 3001 | **不暴露** | 仅 Nginx 内部访问 |
| Frontend | 3002 | **不暴露** | 仅 Nginx 内部访问 |

> 安全原则：只有 Nginx 暴露到公网，后端和前端只在 Docker 内部网络通信。

### 3.3 数据持久化

```
Docker Volume: db-data
  └── 挂载到 Backend 容器的 /app/data/
      └── SQLite 数据库文件 prod.db
```

- 使用 Docker Named Volume，容器重建不丢数据
- 每日凌晨 2:00 自动备份到 `/opt/taskflow/backups/`
- 保留最近 30 天备份，自动清理过期

---

## 4. 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 容器化 | Docker + Docker Compose | 一键部署，环境隔离，跨平台一致 |
| 反向代理 | Nginx Alpine | 轻量（~5MB 镜像），性能好，配置灵活 |
| SSL 证书 | Let's Encrypt + Certbot | 免费，自动续期，受所有浏览器信任 |
| 数据库 | SQLite（保持不变） | 单机部署场景够用，零运维成本 |
| 进程管理 | Docker restart:unless-stopped | 容器级自动重启，无需额外工具 |
| 操作系统 | Ubuntu 22.04/24.04 LTS | 社区支持好，Docker 兼容性最佳 |

---

## 5. 环境变量配置方案

### 5.1 后端环境变量

| 变量名 | 开发值 | 生产值 | 必填 | 说明 |
|--------|--------|--------|------|------|
| `NODE_ENV` | `development` | `production` | ✅ | 控制 secure cookie、错误详情 |
| `PORT` | `3001` | `3001` | ✅ | 服务端口 |
| `DATABASE_URL` | `file:./dev.db` | `file:./data/prod.db` | ✅ | 数据库路径 |
| `JWT_SECRET` | 占位符 | 64 位随机密钥 | ✅ | 签发/验证 JWT |
| `JWT_EXPIRES_IN` | `7d` | `7d` | ✅ | Token 有效期 |
| `ENCRYPTION_KEY` | 占位符 | 32 字符随机密钥 | ✅ | AES 加密敏感配置 |
| `FRONTEND_URL` | `http://localhost:3002` | `https://your-domain.com` | ✅ | CORS 允许的来源 |
| `LIMIT_ENABLED` | `false` | `true` | ✅ | 是否启用频率限制 |
| `CRON_ENABLED` | `true` | `true` | 否 | 是否启用定时任务 |
| `DEFAULT_AI_PROVIDER` | `deepseek` | 按需 | 否 | AI 供应商 |
| `DEFAULT_AI_API_KEY` | 按需 | 按需 | 否 | AI API 密钥 |

### 5.2 前端环境变量

| 变量名 | 开发值 | 生产值 | 说明 |
|--------|--------|--------|------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api` | `/api` | 生产用相对路径，Nginx 反代 |

---

## 6. 安全方案

### 6.1 安全分层模型

```
第 1 层：网络层
├── 防火墙只开 22/80/443
├── SSH 禁止密码登录，只用密钥
├── fail2ban 防暴力破解
└── Docker 内部网络隔离（后端不暴露公网）

第 2 层：传输层
├── HTTPS (TLS 1.2+)
├── HSTS 强制 HTTPS
└── 证书自动续期

第 3 层：应用层
├── JWT httpOnly + Secure + SameSite=Lax
├── bcrypt 密码哈希 (salt=10)
├── Zod 接口参数校验
├── 登录频率限制 (5次/分)
├── API 频率限制 (60次/分)
├── CORS 域名白名单
├── helmet 安全响应头
└── 请求体大小限制 (10MB)

第 4 层：数据层
├── SQLite 文件权限隔离 (非 root 容器)
├── 敏感字段 AES 加密存储
├── 定时数据库备份 (每日 2:00)
└── 密钥环境变量化，不入代码库
```

### 6.2 安全现状与目标对照

| 检查项 | 当前状态 | 目标状态 | 差距 |
|--------|---------|---------|------|
| JWT 密钥强度 | 弱占位符 | 48 字节随机 | 🔴 需替换 |
| 加密密钥强度 | 弱占位符 | 24 字节随机 | 🔴 需替换 |
| Cookie Secure | 依赖 NODE_ENV | NODE_ENV=production | 🔴 需设环境变量 |
| CORS 白名单 | localhost | 真实域名 | 🔴 需配置 |
| 安全响应头 | 无 | helmet 10+ 头 | 🟡 需安装 |
| 频率限制 | 已禁用 | 开启 | 🟡 需改配置 |
| HTTPS | 无 | Let's Encrypt | 🔴 需申请证书 |
| 容器非 root | 未配置 | appuser 运行 | 🟡 Dockerfile 中配置 |
| 数据备份 | 无 | 每日定时 | 🟡 需建脚本 |
| SSH 加固 | 默认配置 | 密钥登录 + fail2ban | 🟡 服务器配置 |
| 请求日志 | 无 | 记录时间/方法/路径 | 🟢 可选 |

### 6.3 应用安全清单

| 安全措施 | 状态 | 说明 |
|----------|------|------|
| JWT httpOnly Cookie | ✅ 已有 | 防 XSS 窃取 token |
| JWT secure 标志 | ✅ 已有 | 生产环境强制 HTTPS |
| bcrypt 密码哈希 | ✅ 已有 | 盐值轮数 10 |
| Zod 输入校验 | ✅ 已有 | 所有接口参数校验 |
| 登录频率限制 | ✅ 已有 | 5 次/分钟 |
| API 频率限制 | ⚠️ 需开启 | `.env` 设置 `LIMIT_ENABLED=true` |
| 安全响应头 | ⚠️ 需添加 | 安装 `helmet` 中间件 |
| CORS 白名单 | ⚠️ 需配置 | 设置 `FRONTEND_URL` 为真实域名 |
| 敏感配置加密 | ✅ 已有 | AES 加密存储 |
| SQL 注入防护 | ✅ 已有 | Prisma 参数化查询 |
| 错误信息脱敏 | ✅ 已有 | 生产环境不暴露堆栈 |
| 请求体大小限制 | ✅ 已有 | `10mb` 上限 |
| Cookie SameSite | ✅ 已有 | `lax` 策略 |
| 非 root 运行容器 | ⚠️ 需配置 | Dockerfile 中配置 appuser |

### 6.4 密钥管理最佳实践

```
❌ 绝对不要：
  - 把 .env 文件提交到 Git
  - 在代码中硬编码密钥
  - 用简单字符串当密钥（如 123456、password）
  - 在前端代码中暴露后端密钥
  - 在日志中打印 JWT 或密码

✅ 正确做法：
  - 每个环境用不同的密钥
  - 密钥至少 32 字符，用 crypto.randomBytes 生成
  - .env 文件加入 .gitignore（你已做好 ✅）
  - 生产密钥只存在服务器上
  - 定期轮换密钥（建议每 3-6 个月）
```

---

## 7. 资源与成本

### 7.1 服务器配置推荐

| 场景 | CPU | 内存 | 硬盘 | 带宽 | 月费 |
|------|-----|------|------|------|------|
| 开发测试 | 1 核 | 2GB | 20GB | 1Mbps | ¥30-50 |
| 小团队 (≤20人) | 2 核 | 4GB | 40GB | 3Mbps | ¥80-150 |
| 正式上线 (≤50人) | 2 核 | 4GB | 50GB | 5Mbps | ¥150-250 |

### 7.2 域名费用

| 后缀 | 年费 | 推荐注册商 |
|------|------|-----------|
| .com | ¥55-69 | 阿里云/腾讯云/Cloudflare |
| .cn | ¥29-39 | 阿里云/腾讯云 |
| .top | ¥9-19 | 阿里云 |

### 7.3 总成本估算

| 方案 | 月费 | 适合 |
|------|------|------|
| 最低方案 | ¥35/月 | 学生机 + 免费 SSL + .top 域名 |
| 推荐方案 | ¥100/月 | 2C4G + .com 域名 + 免费 SSL |
| 企业方案 | ¥250+/月 | 4C8G + 独立 IP + 商业 SSL |

> 学生优惠：阿里云/腾讯云学生机 ¥9-10/月（1 核 2G），足够开发测试用。

---

# 第二部分：代码改造

> 以下改动在本地完成后，再进行第三部分的容器化部署。

---

## 8. 后端安全中间件

### 8.1 安装依赖

```bash
cd backend
npm install helmet compression
npm install -D @types/compression
```

### 8.2 改造 `backend/src/app.ts`

```typescript
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

const app = express();

// ============ 安全中间件 ============
app.use(helmet({
  contentSecurityPolicy: false,    // 前端有自己的 CSP
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());

// ============ CORS ============
app.use(cors({
  origin: (origin, callback) => {
    // 开发环境允许 localhost
    if (config.nodeEnv !== 'production') {
      if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        callback(null, true);
        return;
      }
    }
    // 生产环境只允许配置的前端域名
    const allowed = config.frontendUrl.split(',').map(u => u.trim());
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS 策略拒绝'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ============ 请求日志（生产环境） ============
if (config.nodeEnv === 'production') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// ============ 路由 ============
app.use('/api', routes);

// ============ 错误处理 ============
app.use(errorHandler);

export default app;
```

**改动说明：**
- `helmet`：自动添加 10+ 个安全响应头（X-Frame-Options、X-Content-Type-Options、HSTS 等）
- `compression`：gzip 压缩响应体，JSON 体积减少 60-80%
- CORS 修复：生产环境从 `FRONTEND_URL` 读取域名列表，支持逗号分隔多域名
- 请求日志：仅生产环境记录 `时间 + 方法 + 路径`

---

## 9. 前端 standalone 输出

### 改造 `frontend/next.config.ts`

```typescript
import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 生产环境输出 standalone 模式（Docker 必需）
  output: 'standalone',

  turbopack: {
    root: path.resolve(__dirname),
  },

  // 开发环境保留 API 代理，生产环境通过 Nginx 反代
  async rewrites() {
    if (process.env.NODE_ENV === 'production') {
      return []; // 生产环境不走 Next.js rewrite，走 Nginx
    }
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
```

**改动说明：**
- `output: 'standalone'`：`next build` 产出物从 ~500MB 降到 ~50MB，Docker 镜像大幅缩小
- 生产环境移除 localhost rewrite：API 请求通过 Nginx 反代，不走 Next.js rewrite
- 开发行为完全不变

---

## 10. 生成真实密钥

当前 `.env` 中的 `JWT_SECRET` 和 `ENCRYPTION_KEY` 是开发占位符，**必须替换**：

```bash
# 生成 JWT_SECRET（64 位随机字符串）
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# 生成 ENCRYPTION_KEY（32 字符 AES-256 密钥）
node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"
```

生成后写入 `backend/.env.production`，不要提交到 Git。

---

# 第三部分：容器化与部署

---

## 11. 后端 Dockerfile

**新建文件：`backend/Dockerfile`**

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app

# ===== 安装依赖 =====
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ===== 构建 =====
FROM base AS builder
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma/
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# ===== 生产镜像 =====
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# 安全：非 root 用户运行
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

# 复制依赖和构建产物
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# 数据目录（SQLite 文件持久化）
RUN mkdir -p /app/data && chown appuser:nodejs /app/data

USER appuser

EXPOSE 3001

# 启动：先迁移数据库，再启动服务
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/server.js"]
```

**要点：**
- 三阶段构建（deps → builder → runner），最终镜像只含生产依赖 + 编译产物
- 非 root 用户 `appuser` 运行，提升安全性
- `/app/data` 目录挂载 Docker Volume 持久化 SQLite 数据

---

## 12. 前端 Dockerfile

**新建文件：`frontend/Dockerfile`**

```dockerfile
FROM node:22-alpine AS base
WORKDIR /app

# ===== 安装依赖 =====
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ===== 构建 =====
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ===== 生产镜像 =====
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

# standalone 输出
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER appuser

EXPOSE 3002

CMD ["node", "server.js"]
```

**要点：**
- 依赖 `next.config.ts` 中的 `output: 'standalone'` 配置
- standalone 模式产出自包含的 `server.js`，无需 `node_modules`

---

## 13. Docker Compose 编排

**新建文件：`docker-compose.yml`（项目根目录）**

```yaml
version: '3.8'

services:
  # ===== 后端 API =====
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: taskflow-backend
    restart: unless-stopped
    env_file:
      - ./backend/.env.production
    volumes:
      - db-data:/app/data   # SQLite 数据持久化
    ports:
      - "3001:3001"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ===== 前端 =====
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: taskflow-frontend
    restart: unless-stopped
    environment:
      - HOSTNAME=0.0.0.0
      - PORT=3002
    ports:
      - "3002:3002"

  # ===== Nginx 反向代理 =====
  nginx:
    image: nginx:alpine
    container_name: taskflow-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend
      - frontend

volumes:
  db-data:
```

**要点：**
- 三个服务：backend、frontend、nginx
- `db-data` volume 持久化 SQLite 数据
- `restart: unless-stopped` 容器崩溃自动重启
- backend 有 healthcheck，Nginx 依赖 backend 和 frontend 启动

---

## 14. Nginx 配置

**新建文件：`nginx/nginx.conf`**

```nginx
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent"';

    access_log /var/log/nginx/access.log main;
    error_log  /var/log/nginx/error.log warn;

    # 性能
    sendfile        on;
    tcp_nopush      on;
    keepalive_timeout 65;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1000;

    # 请求体大小限制
    client_max_body_size 10m;

    # 上游服务
    upstream backend {
        server backend:3001;
    }
    upstream frontend {
        server frontend:3002;
    }

    server {
        listen 80;
        server_name your-domain.com;

        # HTTP → HTTPS 重定向（启用 SSL 后取消注释）
        # return 301 https://$host$request_uri;

        # API 请求 → 后端
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # WebSocket 支持
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # 其他请求 → 前端
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # ===== HTTPS 配置（启用 SSL 后取消注释） =====
    # server {
    #     listen 443 ssl http2;
    #     server_name your-domain.com;
    #
    #     ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    #     ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    #     ssl_protocols       TLSv1.2 TLSv1.3;
    #     ssl_ciphers         HIGH:!aNULL:!MD5;
    #
    #     # 安全头
    #     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    #     add_header X-Frame-Options DENY always;
    #     add_header X-Content-Type-Options nosniff always;
    #     add_header X-XSS-Protection "1; mode=block" always;
    #
    #     location /api/ {
    #         proxy_pass http://backend;
    #         proxy_set_header Host $host;
    #         proxy_set_header X-Real-IP $remote_addr;
    #         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #         proxy_set_header X-Forwarded-Proto $scheme;
    #         proxy_http_version 1.1;
    #         proxy_set_header Upgrade $http_upgrade;
    #         proxy_set_header Connection "upgrade";
    #     }
    #
    #     location / {
    #         proxy_pass http://frontend;
    #         proxy_set_header Host $host;
    #         proxy_set_header X-Real-IP $remote_addr;
    #         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #         proxy_set_header X-Forwarded-Proto $scheme;
    #     }
    # }
}
```

**要点：**
- `/api/*` 路径反代到 backend:3001
- 其他路径反代到 frontend:3002
- gzip 压缩静态资源和 JSON
- HTTPS 配置已写好注释，申请证书后取消注释即可

---

## 15. 服务器部署步骤

### 15.1 购买服务器

| 推荐配置 | 说明 |
|----------|------|
| CPU | 2 核（最低 1 核） |
| 内存 | 4GB（最低 2GB） |
| 硬盘 | 40GB SSD |
| 系统 | Ubuntu 22.04 / 24.04 LTS |
| 带宽 | 3-5 Mbps |

推荐厂商：阿里云 ECS、腾讯云 CVM、华为云 ECS

### 15.2 服务器初始化

```bash
# 1. SSH 登录服务器
ssh root@你的服务器IP

# 2. 更新系统
apt update && apt upgrade -y

# 3. 安装 Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# 4. 安装 Docker Compose（如果没自带）
apt install docker-compose-plugin -y

# 5. 创建项目目录
mkdir -p /opt/taskflow
cd /opt/taskflow

# 6. 配置防火墙
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

### 15.3 上传代码并启动

```bash
# 方式一：Git 克隆（推荐）
git clone https://github.com/你的用户名/你的仓库.git .
git checkout master

# 方式二：scp 上传（在本地电脑执行）
# scp -r D:\desktop\heikesong\* root@服务器IP:/opt/taskflow/

# 1. 配置生产环境变量（⚠️ 必须先配置，否则启动失败）
cp backend/.env.example backend/.env.production
nano backend/.env.production  # 填入真实的密钥和域名

# 2. 创建前端环境变量
echo "NEXT_PUBLIC_API_URL=/api" > frontend/.env.production

# 3. 创建 SSL 证书目录（后续用）
mkdir -p nginx/ssl

# 4. 构建并启动
docker compose up -d --build

# 5. 查看运行状态
docker compose ps
docker compose logs -f
```

### 15.4 验证部署

```bash
# 测试后端健康检查
curl http://localhost:3001/api/health

# 测试前端
curl -I http://localhost:3002

# 测试 Nginx 反代
curl http://localhost/api/health
curl -I http://localhost
```

---

## 16. 域名与 HTTPS

### 16.1 购买域名

| 注册商 | 价格 | 说明 |
|--------|------|------|
| 阿里云万网 | ¥29-69/年 | .com 域名 |
| 腾讯云 DNSPod | ¥29-69/年 | .com 域名 |
| Cloudflare | 按成本价 | 最便宜，自带 CDN |

### 16.2 域名解析

在域名管理后台添加 A 记录：

| 记录类型 | 主机记录 | 记录值 |
|----------|---------|--------|
| A | @ | 你的服务器 IP |
| A | www | 你的服务器 IP |

### 16.3 申请免费 SSL 证书（Let's Encrypt）

```bash
# 安装 certbot
apt install certbot -y

# 申请证书（先确保 80 端口可访问）
# 临时停止 nginx
docker compose stop nginx

certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# 证书会生成在 /etc/letsencrypt/live/your-domain.com/

# 复制证书到项目目录
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/

# 修改 nginx.conf，取消 HTTPS 相关注释
# 然后重启
docker compose up -d nginx

# 设置自动续期
echo "0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/your-domain.com/*.pem /opt/taskflow/nginx/ssl/ && docker compose restart nginx" | crontab -
```

---

# 第四部分：多人访问

---

## 17. 团队成员如何访问

### 最简流程（无需域名）

部署完成后，把服务器 IP 地址告诉团队成员：

```
访问地址：http://47.96.xx.xx
```

他们用浏览器打开这个地址就能看到 TaskFlow+ 的登录页面。

### 配了域名 + HTTPS 后

```
访问地址：https://your-domain.com
```

浏览器显示安全锁标志，体验更专业。

### 多人同时使用

系统支持多人同时在线，互不影响：

```
用户 A（管理员）  ──→  浏览器  ──→  http://47.96.xx.xx  ──→  管理项目/分配任务
用户 B（成员）    ──→  浏览器  ──→  http://47.96.xx.xx  ──→  查看任务/提交进度
用户 C（成员）    ──→  浏览器  ──→  http://47.96.xx.xx  ──→  录入成本/查看报表
用户 D（成员）    ──→  浏览器  ──→  http://47.96.xx.xx  ──→  客户管理/目标跟踪
```

数据按权限隔离：
- 管理员能看到所有数据
- 普通成员只能看到分配给自己的项目和任务

---

## 18. 账号管理

### 管理员创建账号

1. 管理员登录系统
2. 进入「设置」→「用户管理」
3. 点击「新增用户」，填写姓名、邮箱（作为登录账号）、初始密码
4. 把邮箱和初始密码告诉对应的同事

### 团队成员登录

1. 打开浏览器，输入访问地址
2. 输入管理员给的邮箱和密码
3. 登录成功后建议立即修改密码

---

## 19. 访问人数与配置对照

| 同时在线人数 | 推荐服务器配置 | 月费参考 |
|-------------|---------------|---------|
| 1-5 人 | 1 核 2GB | ¥30-50 |
| 5-20 人 | 2 核 4GB | ¥80-150 |
| 20-50 人 | 2 核 4GB + 5Mbps 带宽 | ¥150-250 |
| 50+ 人 | 4 核 8GB + 数据库升级 PostgreSQL | ¥300+ |

> SQLite 单机场景下支撑 50 人以内没问题。超过 50 人建议升级到 PostgreSQL。

---

# 第五部分：运维手册

---

## 20. 日常操作命令

```bash
# ===== 服务管理 =====
docker compose up -d              # 启动所有服务
docker compose down               # 停止所有服务
docker compose restart            # 重启所有服务
docker compose logs -f            # 查看实时日志
docker compose logs -f backend    # 只看后端日志
docker compose ps                 # 查看运行状态

# ===== 数据库操作 =====
docker compose exec backend npx prisma studio     # 浏览器看数据
docker compose exec backend npx prisma db seed    # 重新填充测试数据
docker compose exec backend npx prisma db push    # 同步 schema 变更

# ===== 更新部署 =====
cd /opt/taskflow
git pull origin master            # 拉取最新代码
docker compose up -d --build      # 重新构建并启动
docker compose exec backend npx prisma db push    # 同步数据库变更

# ===== 资源监控 =====
docker stats                      # 查看容器资源占用
df -h                             # 查看磁盘空间
free -h                           # 查看内存使用
```

---

## 21. 数据备份与恢复

### 21.1 创建备份脚本

```bash
cat > /opt/taskflow/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/taskflow/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# 备份 SQLite 数据库
docker compose exec backend cp /app/data/prod.db /app/data/backup_$DATE.db
docker cp taskflow-backend:/app/data/backup_$DATE.db $BACKUP_DIR/

# 保留最近 30 天的备份
find $BACKUP_DIR -name "*.db" -mtime +30 -delete

echo "备份完成: $BACKUP_DIR/backup_$DATE.db"
EOF

chmod +x /opt/taskflow/backup.sh
```

### 21.2 设置定时备份

```bash
# 每天凌晨 2 点自动备份
echo "0 2 * * * /opt/taskflow/backup.sh >> /var/log/taskflow-backup.log 2>&1" | crontab -
```

### 21.3 数据恢复

```bash
# 停止后端
docker compose stop backend

# 通过 Docker Volume 恢复
docker compose run --rm backend cp /app/data/backup_20260611_020000.db /app/data/prod.db

# 重启
docker compose start backend
```

---

## 22. 故障排查

| 症状 | 排查步骤 |
|------|---------|
| 页面打不开 | 1. `docker compose ps` 看容器是否运行  2. `docker compose logs nginx` 看 Nginx 日志  3. `curl localhost:3001/api/health` 测后端 |
| API 返回 500 | `docker compose logs backend` 查看后端错误日志 |
| CORS 错误 | 检查 `.env` 中 `FRONTEND_URL` 是否与浏览器地址栏域名一致 |
| 登录后立即退出 | 检查 `JWT_SECRET` 是否与部署时一致，检查 `NODE_ENV=production` |
| 数据丢失 | 从 `/opt/taskflow/backups/` 恢复最近的 .db 备份 |

### 服务器安全加固

```bash
# 1. 禁止 root 密码登录（改用 SSH 密钥）
nano /etc/ssh/sshd_config
# 设置：PasswordAuthentication no
# 设置：PermitRootLogin prohibit-password
systemctl restart sshd

# 2. 安装 fail2ban（防暴力破解）
apt install fail2ban -y
systemctl enable fail2ban

# 3. 定期更新系统
apt install unattended-upgrades -y
dpkg-reconfigure unattended-upgrades
```

---

## 23. 常见问题 FAQ

### Q1：同事说打不开网页？

排查步骤：
```
1. 服务器是否在运行？  →  docker compose ps
2. 防火墙是否放行？    →  ufw status，确认 80 端口是 ALLOW
3. 安全组是否放行？    →  云服务器控制台 → 安全组 → 添加 80/443 入站规则
4. IP 是否正确？      →  curl localhost 确认本地能访问
```

### Q2：同事说登录后马上被踢出来？

原因：`JWT_SECRET` 在部署后被改了，之前的 token 失效。
解决：清除浏览器 Cookie，重新登录。

### Q3：多人同时操作会冲突吗？

不会。每个人的操作是独立的，系统通过用户 ID 隔离数据。
- 编辑项目 A 的同时，同事可以编辑项目 B
- 两个人不能同时编辑同一条记录（后保存的会覆盖先保存的）

### Q4：手机能访问吗？

能。系统是响应式设计，手机浏览器打开同一个地址即可。

### Q5：外网能访问吗？

取决于服务器网络配置：
- 阿里云/腾讯云 ECS：默认公网可达，配置安全组即可
- 公司内网服务器：需要配置内网穿透（frp/ngrok）或 VPN

### Q6：访问速度慢怎么办？

1. 检查服务器带宽是否够用（3Mbps 约支持 5-10 人同时浏览）
2. 升级带宽到 5-10Mbps
3. 接入 Cloudflare CDN（免费，加速明显）

---

## 24. 后续演进路线

```
当前（MVP 部署）
  │
  ├─→ v1.1 性能优化
  │     - Redis 缓存热点查询
  │     - Nginx 静态资源缓存策略
  │     - 接口响应时间监控
  │
  ├─→ v1.2 CI/CD 自动化
  │     - GitHub Actions 自动测试
  │     - 推送 main 分支自动部署
  │     - 回滚机制
  │
  ├─→ v1.3 数据库升级
  │     - SQLite → PostgreSQL
  │     - Prisma Migrate 管理 schema 变更
  │     - 数据库连接池
  │
  └─→ v2.0 高可用
        - 多实例 + 负载均衡
        - Redis Session 存储
        - 日志采集 (ELK/Loki)
        - 监控告警 (Prometheus + Grafana)
```

---

# 附录

---

## A. 文件变更总览

### 新增文件（6 个）

| 文件 | 用途 |
|------|------|
| `backend/Dockerfile` | 后端容器化，多阶段构建 |
| `frontend/Dockerfile` | 前端容器化，standalone 模式 |
| `docker-compose.yml` | 三个服务编排 |
| `nginx/nginx.conf` | 反向代理 + HTTPS |
| `backend/.env.production` | 生产环境变量（不入 Git） |
| `frontend/.env.production` | 生产环境变量（不入 Git） |

### 修改文件（3 个）

| 文件 | 改动 |
|------|------|
| `backend/src/app.ts` | +helmet, +compression, CORS 修复, 请求日志 |
| `backend/package.json` | +helmet, +compression 依赖（npm install 自动改） |
| `frontend/next.config.ts` | +output: 'standalone', 生产环境条件 rewrite |

### 不改动的文件

| 文件 | 原因 |
|------|------|
| `backend/src/routes/index.ts` | 路由已预注册完毕，不修改 |
| `backend/prisma/schema.prisma` | SQLite 暂不换 PostgreSQL |
| 所有 service / validator / 组件 | 业务代码无需改动 |

---

## B. 部署检查清单

部署前逐项确认：

- [ ] 生成了真实的 `JWT_SECRET` 和 `ENCRYPTION_KEY`
- [ ] `NODE_ENV=production`
- [ ] `FRONTEND_URL` 设置为真实域名或 IP
- [ ] `LIMIT_ENABLED=true`
- [ ] `NEXT_PUBLIC_API_URL=/api`
- [ ] 安装了 `helmet` 和 `compression`
- [ ] `next.config.ts` 加了 `output: 'standalone'`
- [ ] 创建了 `backend/Dockerfile`
- [ ] 创建了 `frontend/Dockerfile`
- [ ] 创建了 `docker-compose.yml`
- [ ] 创建了 `nginx/nginx.conf`
- [ ] 域名 A 记录指向服务器 IP（如有域名）
- [ ] SSL 证书已申请并配置（如有域名）
- [ ] 服务器防火墙只开放 22/80/443
- [ ] SSH 已禁止密码登录
- [ ] 数据库备份定时任务已设置
- [ ] `.env` 文件未提交到 Git
- [ ] 云服务器安全组已放行 80/443 端口

---

## 执行顺序总览

```
阶段 1：代码改造（本地，约 30 分钟）
  ├── 安装 helmet + compression
  ├── 改造 app.ts
  ├── 改造 next.config.ts
  └── 生成真实密钥（先不创建 .env.production，等部署时再创建）

阶段 2：创建部署文件（本地，约 30 分钟）
  ├── 创建 backend/Dockerfile
  ├── 创建 frontend/Dockerfile
  ├── 创建 docker-compose.yml
  └── 创建 nginx/nginx.conf

阶段 3：服务器准备（约 30 分钟）
  ├── 购买云服务器 + 域名
  ├── 安装 Docker + Docker Compose
  ├── 配置防火墙 + 安全组
  └── 配置 SSH 密钥登录

阶段 4：部署上线（约 30 分钟）
  ├── 上传代码到服务器（git clone）
  ├── 配置 .env.production
  ├── docker compose up -d --build
  └── 验证访问

阶段 5：安全加固（约 20 分钟）
  ├── 申请 SSL 证书 + 配置 HTTPS
  ├── SSH 禁止密码登录 + fail2ban
  └── 设置数据库自动备份
```

**总耗时：约 2-3 小时**（含购买服务器和等待 DNS 生效）。
