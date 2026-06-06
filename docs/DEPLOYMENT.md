# TaskFlow+ 部署指南

> 本文档说明如何将 TaskFlow+ 从本地开发环境部署到公网，让任何人都能通过域名访问。

---

## 架构概览

```
用户浏览器
    │
    ▼
┌─────────────────────────┐
│   前端 (Next.js 16)      │  ← Vercel（免费）
│   your-app.vercel.app    │
└──────────┬──────────────┘
           │ API 请求
           ▼
┌─────────────────────────┐
│   后端 (Express 5)       │  ← Railway / Render / 自有服务器
│   api.yourdomain.com     │
│   + SQLite 数据库         │
└─────────────────────────┘
```

**核心思路**：前端和后端分开部署，前端放 CDN（快、免费），后端放支持 Node.js 的云服务器。

---

## 方案一：Vercel（前端）+ Railway（后端）⭐ 推荐

最省心的方案，两个平台都有免费额度，支持 GitHub 一键部署。

### 1. 准备工作

#### 1.1 将代码推到 GitHub

```bash
# 如果还没有远程仓库
gh repo create taskflow-plus --private --source=. --push
```

#### 1.2 确认环境变量

后端需要的敏感配置（不要提交到 Git）：

```env
# backend/.env（生产环境）
DATABASE_URL="file:./prod.db"
JWT_SECRET="<用 openssl rand -hex 32 生成>"
JWT_EXPIRES_IN="7d"
ENCRYPTION_KEY="<用 openssl rand -hex 16 生成>"
PORT=3001
NODE_ENV="production"
FRONTEND_URL="https://your-app.vercel.app"   # 部署前端后填真实地址
LIMIT_ENABLED="true"
```

---

### 2. 部署后端到 Railway

#### 2.1 注册 Railway

- 打开 [railway.app](https://railway.app)
- 用 GitHub 账号登录

#### 2.2 创建项目

1. 点击 **New Project** → **Deploy from GitHub Repo**
2. 选择你的 `taskflow-plus` 仓库
3. Railway 会自动检测到 Node.js 项目

#### 2.3 配置后端服务

在 Railway 的 Settings 中：

| 配置项 | 值 |
|--------|-----|
| **Root Directory** | `backend` |
| **Build Command** | `npm install && npx prisma generate && npm run build` |
| **Start Command** | `npx prisma db push && node dist/server.js` |
| **Port** | `3001` |

#### 2.4 设置环境变量

在 Railway 的 **Variables** 标签页添加：

```
DATABASE_URL=file:./prod.db
JWT_SECRET=<你的随机密钥>
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=<你的加密密钥>
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app
LIMIT_ENABLED=true
PORT=3001
```

#### 2.5 生成域名

- 进入 Settings → **Networking** → 点击 **Generate Domain**
- 你会得到类似 `taskflow-backend-production-xxxx.up.railway.app` 的地址
- 记下这个地址，前端部署时要用

---

### 3. 部署前端到 Vercel

#### 3.1 注册 Vercel

- 打开 [vercel.com](https://vercel.com)
- 用 GitHub 账号登录

#### 3.2 导入项目

1. 点击 **Add New...** → **Project**
2. 选择你的 `taskflow-plus` 仓库
3. Vercel 会自动检测 Next.js

#### 3.3 配置前端

| 配置项 | 值 |
|--------|-----|
| **Framework Preset** | Next.js（自动检测） |
| **Root Directory** | `frontend` |
| **Build Command** | `next build`（默认即可） |
| **Output** | `.next`（默认即可） |

#### 3.4 设置环境变量

在 Vercel 的 **Environment Variables** 中添加：

```
NEXT_PUBLIC_API_URL=https://taskflow-backend-production-xxxx.up.railway.app/api
```

#### 3.5 修改 next.config.ts（重要）

部署前需要将后端代理地址改为环境变量。修改 `frontend/next.config.ts`：

```typescript
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/:path*`,
      },
    ];
  },
};
```

#### 3.6 部署

- 点击 **Deploy**，等待 1-2 分钟
- 完成后你会得到 `https://your-app.vercel.app` 的地址
- 把这个地址填回 Railway 的 `FRONTEND_URL` 环境变量中

---

### 4. 完成！

现在你可以把 Vercel 的链接分享给任何人，他们打开就能用了。

**免费额度参考**：

| 平台 | 免费额度 | 限制 |
|------|----------|------|
| Vercel | 每月 100GB 流量 | 个人项目足够 |
| Railway | 每月 $5 额度 | 约 500 小时运行时间，不够可升级 |

---

## 方案二：一台服务器全搞定（适合有服务器的同学）

如果你有一台 Linux 服务器（阿里云/腾讯云/自己的电脑），可以用 Docker 一键部署。

### 1. 创建 Docker 配置文件

#### 后端 Dockerfile（`backend/Dockerfile`）

```dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --production

# 复制 Prisma schema 并生成客户端
COPY prisma ./prisma/
RUN npx prisma generate

# 复制源码并构建
COPY . .
RUN npm run build

# 初始化数据库并启动
CMD ["sh", "-c", "npx prisma db push && node dist/server.js"]
```

#### 前端 Dockerfile（`frontend/Dockerfile`）

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

#### docker-compose.yml（项目根目录）

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=file:./prod.db
      - JWT_SECRET=${JWT_SECRET}
      - JWT_EXPIRES_IN=7d
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - NODE_ENV=production
      - FRONTEND_URL=http://your-server-ip:3000
      - LIMIT_ENABLED=true
      - PORT=3001
    volumes:
      - backend-data:/app/prisma   # 持久化数据库
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - NEXT_PUBLIC_API_URL=http://your-server-ip:3001/api
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  backend-data:
```

### 2. 部署命令

```bash
# 在服务器上
git clone <你的仓库地址>
cd taskflow-plus

# 创建 .env 文件
cat > .env << 'EOF'
JWT_SECRET=<用 openssl rand -hex 32 生成>
ENCRYPTION_KEY=<用 openssl rand -hex 16 生成>
EOF

# 一键启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f
```

### 3. 配置域名和 HTTPS（可选但推荐）

用 Nginx 做反向代理 + Let's Encrypt 免费 SSL：

```nginx
# /etc/nginx/sites-available/taskflow
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # 前端
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# 安装 certbot 获取免费 SSL 证书
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 方案三：Vercel + Supabase（最便宜）

如果预算为零，可以把 SQLite 换成 Supabase 的免费 PostgreSQL：

> ⚠️ 这需要修改 Prisma schema（`sqlite` → `postgresql`），工作量较大，适合后续优化时做。

| 服务 | 用途 | 费用 |
|------|------|------|
| Vercel | 前端托管 | 免费 |
| Vercel Serverless | 后端 API | 免费（需改为 API Routes） |
| Supabase | 数据库 | 免费（500MB） |

---

## 部署前检查清单

### 后端

- [ ] `JWT_SECRET` 和 `ENCRYPTION_KEY` 已更换为随机强密钥
- [ ] `NODE_ENV` 设为 `production`
- [ ] `FRONTEND_URL` 设为前端的真实域名
- [ ] `LIMIT_ENABLED` 设为 `true`（开启接口限流）
- [ ] `npm run build` 能正常编译
- [ ] 数据库已初始化（`prisma db push`）

### 前端

- [ ] `NEXT_PUBLIC_API_URL` 设为后端的真实域名
- [ ] `next.config.ts` 中的 rewrites 已支持环境变量
- [ ] `npm run build` 能正常编译
- [ ] 登录、注册、CRUD 功能正常

### 安全

- [ ] `.env` 文件没有提交到 Git（已在 `.gitignore` 中）
- [ ] 测试账号的密码已修改或删除
- [ ] CORS 只允许前端域名访问
- [ ] 已配置 HTTPS（生产环境必须）

---

## 常见问题

### Q: SQLite 能用在生产环境吗？

**可以，但有条件。** SQLite 适合：
- 单服务器部署
- 日活用户 < 100 人
- 读多写少的场景

如果用户量增长，建议迁移到 PostgreSQL。迁移步骤：
1. 将 Prisma schema 中 `provider = "sqlite"` 改为 `provider = "postgresql"`
2. 更新 `DATABASE_URL` 为 PostgreSQL 连接字符串
3. 运行 `npx prisma db push`

### Q: 前端请求后端报 CORS 错误？

确保后端 `FRONTEND_URL` 环境变量设置为前端的真实域名（含 `https://`）。

### Q: Railway 免费额度用完了怎么办？

- 方案 A：升级 Railway 付费计划（$5/月起）
- 方案 B：换到 Render（也有免费额度）
- 方案 C：用自己的服务器，参考方案二

### Q: 如何更新部署？

**Vercel / Railway**：推送到 GitHub 就会自动重新部署。

```bash
git add .
git commit -m "feat: 新功能"
git push
```

**Docker 方案**：
```bash
git pull
docker-compose up -d --build
```

### Q: n8n 怎么部署？

n8n 是可选的自动化工具。如果需要：
- Railway 上可以一键部署 n8n（有官方模板）
- 或者在 Docker 方案中添加 n8n 服务

```yaml
# 加到 docker-compose.yml
services:
  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=<设置密码>
    volumes:
      - n8n-data:/home/node/.n8n
    restart: unless-stopped
```

---

## 费用总结

| 方案 | 月费 | 适合场景 |
|------|------|----------|
| Vercel + Railway | ~$0-5 | 个人项目、演示 |
| 一台服务器 + Docker | ~¥50-100 | 长期使用、数据敏感 |
| Vercel + Supabase | $0 | 纯免费，需改数据库 |

**推荐**：先用方案一（Vercel + Railway）快速上线，后续根据实际用量再决定是否迁移。
