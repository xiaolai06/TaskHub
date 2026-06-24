# TaskFlow+ 部署指南

> 完整的生产环境部署说明，涵盖架构设计、部署流程、配置详解和运维手册。

---

## 目录

1. [系统架构总览](#1-系统架构总览)
2. [技术选型与部署方案](#2-技术选型与部署方案)
3. [服务器环境要求](#3-服务器环境要求)
4. [首次部署完整流程](#4-首次部署完整流程)
5. [环境变量配置详解](#5-环境变量配置详解)
6. [Nginx 反向代理配置](#6-nginx-反向代理配置)
7. [PM2 进程管理配置](#7-pm2-进程管理配置)
8. [数据库管理](#8-数据库管理)
9. [日常更新部署](#9-日常更新部署)
10. [安全配置说明](#10-安全配置说明)
11. [可选组件部署](#11-可选组件部署)
12. [监控与日志](#12-监控与日志)
13. [故障排查手册](#13-故障排查手册)
14. [HTTPS 升级指南](#14-https-升级指南)

---

## 1. 系统架构总览

### 1.1 整体架构图

```
                    ┌─────────────────────────────────────────────┐
                    │                Internet                      │
                    └──────────────────┬──────────────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────────────┐
                    │           Nginx 反向代理 (:80)              │
                    │                                             │
                    │  /api/auth/* ──→ :3001 (限频 5次/分钟)      │
                    │  /api/*      ──→ :3001 (限频 10次/秒)       │
                    │  /_next/static/ → :3000 (1年缓存)           │
                    │  /*           ──→ :3000 (前端页面)           │
                    └────────┬────────────────────┬───────────────┘
                             │                    │
                             ▼                    ▼
              ┌──────────────────┐    ┌──────────────────────┐
              │  后端 API 服务    │    │   前端 Web 服务       │
              │  Express 5       │    │   Next.js 16          │
              │  :3001           │    │   :3000               │
              │                  │    │                       │
              │  · 26 个 API 模块 │    │  · React 19           │
              │  · 28 个 Service  │    │  · shadcn/ui          │
              │  · AI 子系统      │    │  · React Query        │
              │  · 定时任务       │    │  · Zustand            │
              └────────┬─────────┘    └──────────────────────┘
                       │
                       ▼
              ┌──────────────────┐
              │   SQLite 数据库   │
              │   dev.db          │
              │   WAL 模式        │
              │   26 张数据表      │
              └──────────────────┘

              ┌──────────────────┐
              │   PM2 进程管理    │
              │   taskflow-api   │
              │   taskflow-web   │
              │   自动重启/日志   │
              └──────────────────┘
```

### 1.2 端口分配

| 服务 | 端口 | 说明 |
|------|------|------|
| Nginx | 80 | 用户访问入口，生产环境对外 |
| Next.js 前端 | 3000 | 通过 Nginx 代理，不对外暴露 |
| Express 后端 | 3001 | 通过 Nginx 代理，不对外暴露 |
| Next.js 开发模式 | 3002 | 仅开发环境使用 |

### 1.3 请求流转路径

```
用户浏览器
  → Nginx (:80)
    → 路由判断：
      /api/* → Express 后端 (:3001)
        → app.ts（CORS / JSON 解析 / Cookie 解析）
          → routes/index.ts（路由分发 + auth 中间件）
            → routes/xxx.routes.ts（具体路由）
              → validators/xxx.schema.ts（Zod 参数校验）
                → services/xxx.service.ts（业务逻辑 + Prisma）
                  → SQLite（dev.db）
      /* → Next.js 前端 (:3000)
        → 页面渲染 / API 请求转发
```

---

## 2. 技术选型与部署方案

### 2.1 为什么选择 Nginx + PM2 + SQLite 方案

| 问题 | 我们的方案 | 为什么 |
|------|-----------|--------|
| **如何让用户访问？** | Nginx 反向代理 | 单一入口 :80，前后端统一路由，无需用户知道端口号 |
| **如何管理 Node 进程？** | PM2 | 崩溃自动重启、日志管理、内存限制、零停机重载 |
| **用什么数据库？** | SQLite（WAL 模式） | 单文件、零运维、对个人项目足够，WAL 支持并发读 |
| **如何处理跨域？** | Nginx 统一代理 | 前后端同源（都通过 :80），彻底消除 CORS 问题 |
| **如何部署更新？** | 一键部署脚本 | git pull → 安装依赖 → 数据库迁移 → 构建 → PM2 重启 |
| **如何保证安全？** | 多层防护 | Nginx 限频 + 安全头，Express 验证 + JWT + AES 加密 |

### 2.2 为什么不选其他方案

| 备选方案 | 不选的原因 |
|----------|-----------|
| **Docker 容器化** | SQLite 单文件在容器中有持久化复杂度，个人项目过度工程化 |
| **Vercel / Netlify** | 后端是 Express + SQLite，无法在 Serverless 平台运行 |
| **Nginx + systemd** | PM2 比 systemd 更适合 Node.js：自动重启策略更智能、日志自动轮转 |
| **MySQL / PostgreSQL** | 个人项目不需要独立数据库服务，增加运维复杂度 |
| **集群多实例** | SQLite 单写入者限制，fork 模式单实例足够 |

---

## 3. 服务器环境要求

### 3.1 硬件配置

| 项目 | 最低要求 | 推荐配置 |
|------|---------|---------|
| CPU | 1 核 | 2 核 |
| 内存 | 1 GB | 2 GB |
| 磁盘 | 20 GB | 40 GB SSD |
| 带宽 | 1 Mbps | 3 Mbps |

### 3.2 软件环境

| 软件 | 版本要求 | 安装命令 |
|------|---------|---------|
| **Node.js** | ≥ 18.x（推荐 20 LTS） | `curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo -E bash - && sudo apt install -y nodejs` |
| **npm** | ≥ 9.x | 随 Node.js 安装 |
| **PM2** | ≥ 5.x | `npm install -g pm2` |
| **Nginx** | ≥ 1.18 | `sudo apt install -y nginx` |
| **Git** | ≥ 2.x | `sudo apt install -y git` |
| **sqlite3** | ≥ 3.x（CLI 工具，备份用） | `sudo apt install -y sqlite3` |

### 3.3 系统配置（Ubuntu / Debian）

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y curl wget git sqlite3 build-essential

# 安装 Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 验证版本
node -v    # 应显示 v20.x.x
npm -v     # 应显示 10.x.x

# 全局安装 PM2
sudo npm install -g pm2

# 安装 Nginx
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# 验证 Nginx 运行
curl http://localhost
# 应返回 Nginx 默认欢迎页
```

---

## 4. 首次部署完整流程

### 步骤概览

```
克隆代码 → 配置环境变量 → 安装依赖 → 数据库迁移 → 构建项目
→ 配置 Nginx → 启动 PM2 → 验证访问
```

### 4.1 克隆项目代码

```bash
# 创建项目目录
sudo mkdir -p /home/taskflow
sudo chown $USER:$USER /home/taskflow

# 克隆代码
cd /home/taskflow
git clone <你的仓库地址> .

# 确认项目结构
ls
# 应看到: backend/ frontend/ deploy/ ecosystem.config.js package.json ...
```

### 4.2 配置后端环境变量

```bash
cd /home/taskflow/backend

# 从模板创建 .env
cp .env.example .env
```

编辑 `backend/.env`，**必须修改以下必填项**：

```bash
# ===== 必填项（缺少任何一个服务都无法启动） =====

# 数据库路径（SQLite 文件位置）
DATABASE_URL="file:./dev.db"

# JWT 密钥 —— 生产环境必须更换！用以下命令生成：
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET="替换为你生成的64位随机字符串"

# AES 加密密钥 —— 用于加密敏感配置（API Key 等）
# node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
ENCRYPTION_KEY="替换为你生成的32位随机字符串"

# ===== 推荐修改项 =====

# 生产环境标识
NODE_ENV="production"

# 允许的前端地址（逗号分隔多个）
# 如果有域名，替换 IP 为域名
FRONTEND_URL="http://你的服务器IP:80,http://你的域名"

# Cookie 安全设置（启用 HTTPS 后改为 true）
COOKIE_SECURE="false"

# ===== 可选功能配置 =====

# AI 功能（不配置则 AI 模块不可用）
DEFAULT_AI_PROVIDER="deepseek"
DEFAULT_AI_API_KEY="你的AI API密钥"
DEFAULT_AI_BASE_URL="https://api.deepseek.com"
DEFAULT_AI_MODEL="deepseek-chat"

# 邮件通知（不配置则邮件功能不可用）
# SMTP_HOST="smtp.qq.com"
# SMTP_PORT="587"
# SMTP_USER="你的邮箱"
# SMTP_PASS="你的授权码"
```

> **为什么 `.env` 文件不在 Git 中？**
> `.env` 包含密钥和密码，属于敏感信息。`.gitignore` 已将其排除，防止意外提交到代码仓库。每个环境（开发/生产）各自维护一份。

### 4.3 配置前端环境变量

```bash
# 前端使用相对路径，通常无需修改
cat /home/taskflow/frontend/.env.local
# NEXT_PUBLIC_API_URL="/api"
```

> **为什么前端用相对路径 `/api` 而不是完整 URL？**
> 因为 Nginx 将前端和后端统一代理到同一个 :80 端口，浏览器看到的是同源请求，无需跨域。开发模式下，Next.js 的 rewrite 规则会自动将 `/api` 转发到后端 `:3001`。

### 4.4 安装依赖

```bash
# 后端依赖
cd /home/taskflow/backend
npm ci

# 前端依赖
cd /home/taskflow/frontend
npm ci
```

> **为什么用 `npm ci` 而不是 `npm install`？**
> `npm ci` 严格按照 `package-lock.json` 安装，确保服务器的依赖版本和开发环境完全一致。速度也更快，适合自动化部署。

### 4.5 数据库初始化

```bash
cd /home/taskflow/backend

# 生成 Prisma Client（根据 schema.prisma 生成类型安全的数据库客户端）
npx prisma generate

# 推送数据库结构到 SQLite 文件（开发阶段用 db push，生产用 migrate）
npx prisma migrate deploy
```

> **`prisma generate` 和 `prisma migrate deploy` 分别做什么？**
> - `generate`：读取 `schema.prisma`，生成 TypeScript 类型和查询函数到 `node_modules/.prisma/`
> - `migrate deploy`：执行已有的迁移文件，创建/更新数据库表结构
> - 两者缺一不可：没有 generate 则代码无法查询数据库，没有 migrate 则数据库表不存在

### 4.6 构建项目

```bash
# 构建后端（TypeScript 编译 → JavaScript）
cd /home/taskflow/backend
npm run build
# 输出到 backend/dist/ 目录

# 构建前端（Next.js 编译优化）
cd /home/taskflow/frontend
npm run build
# 输出到 frontend/.next/ 目录
```

> **构建做了什么？**
> - 后端：`tsc` 将 TypeScript 编译为 JavaScript（`src/` → `dist/`），同时复制 AI 提示词模板文件
> - 前端：Next.js 编译所有页面和组件，生成优化后的静态资源和 SSR 代码，Tree Shaking 去除未使用代码

### 4.7 配置 Nginx

```bash
# 复制 Nginx 配置文件
sudo cp /home/taskflow/deploy/nginx/taskflow.conf /etc/nginx/sites-available/taskflow.conf

# 如果有旧的默认站点，先移除
sudo rm -f /etc/nginx/sites-enabled/default

# 启用 TaskFlow 站点
sudo ln -sf /etc/nginx/sites-available/taskflow.conf /etc/nginx/sites-enabled/

# 测试配置语法
sudo nginx -t
# 应显示: syntax is ok / test is successful

# 重载 Nginx（不中断服务）
sudo systemctl reload nginx
```

> **为什么不直接编辑 nginx.conf？**
> 使用 sites-available / sites-enabled 分离配置，可以随时启用/禁用站点，不影响 Nginx 主配置。也方便未来添加更多站点。

### 4.8 启动 PM2

```bash
cd /home/taskflow

# 创建日志目录
mkdir -p backend/logs frontend/logs

# 启动所有服务
pm2 start ecosystem.config.js

# 查看运行状态
pm2 status
# 应显示 taskflow-api 和 taskflow-web 状态为 online

# 保存当前进程列表（用于开机自启恢复）
pm2 save

# 设置开机自启
pm2 startup
# 按提示执行输出的命令
```

> **PM2 的 fork 模式是什么？为什么不用 cluster？**
> fork 模式 = 单进程运行。cluster 模式可以启动多个实例利用多核 CPU，但 SQLite 同一时刻只允许一个写入者，多实例会导致写入冲突。fork 单实例配合 PM2 的自动重启，对个人项目完全足够。

### 4.9 验证部署

```bash
# 1. 检查后端是否响应
curl http://localhost:3001/api/auth/captcha
# 应返回 JSON（验证码数据）

# 2. 检查前端是否响应
curl -I http://localhost:3000
# 应返回 HTTP 200

# 3. 检查 Nginx 代理是否正常
curl -I http://你的服务器IP
# 应返回 HTTP 200

# 4. 浏览器访问
# 打开 http://你的服务器IP
# 应看到登录页面
```

### 4.10 导入 n8n 工作流（可选）

```bash
# 如果需要自动化工作流功能
cd /home/taskflow

# 启动 n8n（使用 Docker）
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  n8nio/n8n

# 访问 n8n 面板导入工作流
# 打开 http://你的服务器IP:5678
# 导入 n8n/workflows/ 目录下的 7 个 JSON 文件
```

---

## 5. 环境变量配置详解

### 5.1 完整环境变量表

文件位置：`backend/.env`

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `DATABASE_URL` | ✅ | `file:./dev.db` | SQLite 数据库文件路径 |
| `JWT_SECRET` | ✅ | 无 | JWT 签名密钥，≥32 字符 |
| `ENCRYPTION_KEY` | ✅ | 无 | AES-256 加密密钥，32 字符 |
| `PORT` | ❌ | `3001` | 后端监听端口 |
| `NODE_ENV` | ❌ | `production` | 运行环境 |
| `JWT_EXPIRES_IN` | ❌ | `7d` | Token 过期时间 |
| `FRONTEND_URL` | ❌ | `http://localhost:3000` | CORS 允许的前端地址（逗号分隔） |
| `COOKIE_SECURE` | ❌ | `false` | HTTPS 时设为 `true` |
| `TRUST_PROXY` | ❌ | `1` | 信任的代理层数（Nginx 为 1 层） |
| `LIMIT_ENABLED` | ❌ | `true` | 是否启用接口限频 |
| `CRON_ENABLED` | ❌ | `true` | 是否启用定时任务 |
| `DEFAULT_AI_PROVIDER` | ❌ | `deepseek` | AI 供应商名称 |
| `DEFAULT_AI_API_KEY` | ❌ | 无 | AI API 密钥 |
| `DEFAULT_AI_BASE_URL` | ❌ | 无 | AI 接口地址 |
| `DEFAULT_AI_MODEL` | ❌ | 无 | AI 模型名称 |
| `N8N_BASE_URL` | ❌ | `http://localhost:5678` | n8n 服务器地址 |
| `N8N_WEBHOOK_SECRET` | ❌ | 无 | Webhook 认证密钥 |
| `SMTP_HOST` | ❌ | 无 | 邮件服务器地址 |
| `SMTP_PORT` | ❌ | `587` | 邮件服务器端口 |
| `SMTP_USER` | ❌ | 无 | 邮件用户名 |
| `SMTP_PASS` | ❌ | 无 | 邮件密码/授权码 |
| `SEARXNG_URL` | ❌ | 无 | SearXNG 搜索引擎地址 |
| `PROXY_URL` | ❌ | 无 | HTTP 代理地址 |

### 5.2 生成安全密钥

```bash
# 生成 JWT_SECRET（64 位十六进制字符串）
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 生成 ENCRYPTION_KEY（32 位十六进制字符串 = 16 字节）
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

> **为什么 `JWT_SECRET` 和 `ENCRYPTION_KEY` 必须更换？**
> 默认值是开发用的占位符。如果上线不更换，任何知道源码的人都能伪造 JWT 登录任何账户，或解密已保存的 API Key。

### 5.3 各功能模块的环境变量依赖

```
核心功能（必须配置）:
  DATABASE_URL + JWT_SECRET + ENCRYPTION_KEY
  → 登录注册、项目管理、任务管理、客户管理、费用管理

AI 功能:
  DEFAULT_AI_API_KEY + DEFAULT_AI_BASE_URL + DEFAULT_AI_MODEL
  → AI 助手对话、智能任务解析、AI 洞察

邮件通知:
  SMTP_HOST + SMTP_PORT + SMTP_USER + SMTP_PASS
  → 注册确认、密码重置、任务提醒

自动化工作流:
  N8N_BASE_URL + N8N_WEBHOOK_SECRET
  → 过期提醒、费用预警、周报生成、AI 任务解析

网页搜索:
  SEARXNG_URL（或 PROXY_URL + 外部搜索 API）
  → 商业信息搜索、竞品调研
```

---

## 6. Nginx 反向代理配置

### 6.1 配置文件位置

```
源文件:   deploy/nginx/taskflow.conf
安装位置: /etc/nginx/sites-available/taskflow.conf
启用位置: /etc/nginx/sites-enabled/taskflow.conf → (软链接)
```

### 6.2 配置逐段解析

#### 限频规则定义（http 块级，server 块外）

```nginx
# API 接口限频：每秒 10 次请求
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

# 认证接口限频：每分钟 5 次请求（防暴力破解）
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
```

> **为什么分两级限频？**
> 登录/注册接口是暴力破解的主要目标，限频更严格（5次/分钟）。普通 API 允许正常操作频率（10次/秒）。`zone=api:10m` 表示用 10MB 内存存储 IP 地址，约可记录 16 万个 IP。

#### 安全头

```nginx
server_tokens off;                         # 隐藏 Nginx 版本号，防止针对性攻击
add_header X-Frame-Options "SAMEORIGIN"    # 禁止被嵌入 iframe（防点击劫持）
add_header X-Content-Type-Options "nosniff" # 禁止浏览器猜测 MIME 类型
add_header Referrer-Policy "strict-origin-when-cross-origin"  # 跨域不发送来源
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()"  # 禁用浏览器权限
```

#### Gzip 压缩

```nginx
gzip on;
gzip_comp_level 6;          # 压缩级别 1-9，6 是性能和压缩率的平衡点
gzip_min_length 1024;        # 小于 1KB 的响应不压缩（压缩收益太小）
gzip_types text/plain text/css application/json application/javascript ...;
```

> **为什么压缩级别选 6？**
> 级别 1 最快但压缩率低，级别 9 压缩率最高但 CPU 开销大。实测 6 级的压缩率接近 9 级（差异 <2%），但 CPU 占用低很多。

#### 后端 API 代理

```nginx
location /api/ {
    limit_req zone=api burst=20 nodelay;    # 允许瞬间突发 20 个请求

    proxy_pass http://127.0.0.1:3001;
    proxy_read_timeout 120s;                # AI 流式响应需要较长超时

    # SSE（Server-Sent Events）支持
    proxy_buffering off;                    # 不缓冲，实时转发 AI 流式输出
    proxy_cache off;

    # WebSocket 支持（实时通信）
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
}
```

> **为什么 API 超时设 120 秒？**
> AI 对话是流式响应（SSE），一次对话可能持续数十秒。如果超时太短，长回复会被 Nginx 中断。前端静态页面代理用默认 60 秒即可。

#### 认证接口代理（更严格的限频）

```nginx
location /api/auth/ {
    limit_req zone=auth burst=3 nodelay;    # 仅允许突发 3 个请求

    proxy_connect_timeout 10s;
    proxy_read_timeout 30s;                 # 认证接口不需要长时间等待
}
```

> **`location /api/auth/` 为什么要在 `/api/` 前面？**
> Nginx 的 location 匹配规则：前缀匹配时，更长的前缀优先。`/api/auth/` 比 `/api/` 更具体，所以 Nginx 会优先匹配认证路径，应用更严格的限频。

#### 前端静态资源缓存

```nginx
location /_next/static/ {
    proxy_pass http://127.0.0.1:3000;
    add_header Cache-Control "public, max-age=31536000, immutable";
    # 1 年强缓存。Next.js 的静态资源文件名包含内容哈希，
    # 文件内容变化 = 文件名变化，所以可以放心缓存 1 年。
}

location ~ /\. {
    deny all;    # 禁止访问 .env、.git 等隐藏文件
}
```

---

## 7. PM2 进程管理配置

### 7.1 配置文件

文件位置：`ecosystem.config.js`（项目根目录）

```javascript
// 两个应用进程
module.exports = {
  apps: [
    {
      name: 'taskflow-api',         // 后端 API
      script: 'dist/server.js',     // 编译后的入口文件
      cwd: 'backend/',
      instances: 1,                  // SQLite 限制，只能单实例
      exec_mode: 'fork',
      max_memory_restart: '512M',   // 内存超 512M 自动重启
    },
    {
      name: 'taskflow-web',         // 前端 Next.js
      script: 'next start -p 3000',
      cwd: 'frontend/',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
    }
  ]
};
```

### 7.2 关键配置解释

| 配置项 | 值 | 为什么 |
|--------|-----|--------|
| `instances: 1` | 单实例 | SQLite 同一时刻只允许一个写入者 |
| `exec_mode: 'fork'` | fork 模式 | cluster 模式会导致 SQLite 写入冲突 |
| `max_memory_restart: '512M'` | 512MB | 防止内存泄漏，超限自动重启 |
| `autorestart: true` | 自动重启 | 进程崩溃后自动恢复 |
| `kill_timeout: 10000` | 10 秒 | 等待优雅关闭，超时强制 kill |
| `watch: false` | 不监听文件 | 生产环境不热重载，避免误触发 |
| `max_size: '10M'` | 日志 10MB | 单个日志文件最大 10MB |
| `retain: 7` | 保留 7 份 | 最多保留 7 个日志轮转文件 |

### 7.3 PM2 常用命令

```bash
# 查看所有进程状态
pm2 status

# 查看实时日志
pm2 logs                    # 所有进程日志
pm2 logs taskflow-api       # 仅后端日志
pm2 logs taskflow-web       # 仅前端日志

# 重启服务
pm2 restart all             # 重启所有
pm2 restart taskflow-api    # 仅重启后端

# 停止服务
pm2 stop all
pm2 stop taskflow-api

# 监控面板（CPU / 内存 / 日志）
pm2 monit

# 查看详细信息
pm2 show taskflow-api

# 零停机重载（先启新进程再杀旧进程）
pm2 reload all
```

---

## 8. 数据库管理

### 8.1 SQLite 特性

| 特性 | 说明 |
|------|------|
| 存储方式 | 单文件 `backend/prisma/dev.db` |
| 并发模式 | WAL（Write-Ahead Logging）—— 支持并发读、单写 |
| 数据规模 | 当前约 6.7MB（含 WAL 文件），适合万级数据量 |
| 备份方式 | 文件复制（`sqlite3 .backup` 命令） |
| 无需服务 | 嵌入式数据库，不需要独立的数据库服务进程 |

### 8.2 常用命令

```bash
cd /home/taskflow/backend

# 修改 Schema 后同步到数据库
npx prisma db push && npx prisma generate

# 重新生成 Prisma Client（Schema 不变但依赖更新后）
npx prisma generate

# 执行生产环境迁移（有迁移文件时使用）
npx prisma migrate deploy

# 浏览器可视化查看/编辑数据
npx prisma studio    # 访问 http://localhost:5555

# 重置数据库（⚠️ 清空所有数据！）
npx prisma db push --force-reset

# 填充测试数据
npx prisma db seed
```

### 8.3 自动备份

备份脚本：`deploy/scripts/backup-db.sh`

```bash
# 手动备份
bash deploy/scripts/backup-db.sh

# 设置每日凌晨 3 点自动备份
crontab -e
# 添加以下行：
0 3 * * * /home/taskflow/deploy/scripts/backup-db.sh >> /home/taskflow/logs/backup.log 2>&1
```

备份脚本的工作流程：
```
1. 使用 sqlite3 .backup 命令安全复制数据库（不锁表，支持在线备份）
2. 执行 PRAGMA integrity_check 验证备份完整性
3. 自动清理超过 7 天的旧备份
```

> **为什么用 `sqlite3 .backup` 而不是 `cp`？**
> `cp` 在数据库正在写入时可能复制到不一致的状态。`sqlite3 .backup` 是 SQLite 官方的在线备份命令，即使有并发写入也能保证备份的数据一致性。

---

## 9. 日常更新部署

### 9.1 一键部署脚本

脚本位置：`deploy/scripts/deploy.sh`

```bash
cd /home/taskflow
bash deploy/scripts/deploy.sh
```

### 9.2 脚本执行的 6 个步骤

```
步骤 1: git pull origin main
        ↓ 拉取最新代码
步骤 2: npm ci（后端 + 前端）
        ↓ 安装/更新依赖
步骤 3: prisma generate + prisma migrate deploy
        ↓ 同步数据库结构
步骤 4: npm run build（后端 + 前端）
        ↓ 编译构建
步骤 5: mkdir -p logs
        ↓ 确保日志目录存在
步骤 6: pm2 startOrRestart ecosystem.config.js --update-env
        ↓ 零停机重启服务
```

### 9.3 手动部署（逐步执行）

如果需要更精细的控制，可以手动执行每一步：

```bash
cd /home/taskflow

# 1. 拉取代码
git pull origin main

# 2. 查看变更内容
git log --oneline -5

# 3. 如果有新的依赖，安装
cd backend && npm ci && cd ..
cd frontend && npm ci && cd ..

# 4. 如果有数据库变更
cd backend
npx prisma generate
npx prisma migrate deploy
cd ..

# 5. 构建
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..

# 6. 重启（可指定单个服务）
pm2 restart taskflow-api --update-env
pm2 restart taskflow-web --update-env

# 7. 验证
curl http://localhost:3001/api/auth/captcha
curl -I http://localhost:3000
```

### 9.4 回滚操作

```bash
# 查看 git 提交历史
git log --oneline -10

# 回滚到指定版本
git checkout <commit-hash>

# 重新构建和部署
npm ci && npm run build
pm2 restart all --update-env

# 确认后切回最新
git checkout main
```

---

## 10. 安全配置说明

### 10.1 安全架构总览

```
                    ┌─────────────────────────────────────┐
                    │          Nginx 层（入口防护）         │
                    │  · 限频: API 10r/s, Auth 5r/min     │
                    │  · 安全头: X-Frame, CSP, HSTS        │
                    │  · 隐藏文件拦截: .env, .git          │
                    │  · 版本号隐藏: server_tokens off     │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │      Express 层（应用防护）           │
                    │  · Helmet 安全头                     │
                    │  · CORS 白名单校验                    │
                    │  · JSON body 限制 1MB                │
                    │  · 应用层限频                         │
                    └──────────────┬──────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────┐
                    │      业务层（数据安全）               │
                    │  · JWT httpOnly Cookie 认证           │
                    │  · bcrypt 10 轮密码哈希               │
                    │  · AES-256-GCM 敏感数据加密           │
                    │  · Zod 全量输入校验                    │
                    │  · ownerId 数据隔离                   │
                    │  · Webhook 密钥认证                   │
                    └─────────────────────────────────────┘
```

### 10.2 安全措施详解

| 层级 | 措施 | 实现方式 | 防护目标 |
|------|------|---------|---------|
| **网络层** | 限频 | Nginx `limit_req_zone` | 防 DDoS、暴力破解 |
| **传输层** | HTTPS | Nginx SSL + Let's Encrypt | 防中间人攻击 |
| **头部层** | 安全头 | Nginx `add_header` + Helmet | 防点击劫持、XSS、信息泄露 |
| **认证层** | JWT Cookie | httpOnly + SameSite=Lax | 防 XSS 窃取 Token |
| **密码层** | bcrypt | 10 轮 salt 哈希 | 防彩虹表破解 |
| **数据层** | AES-256 | GCM 模式加密 | 保护 API Key 等敏感配置 |
| **输入层** | Zod | 所有接口参数校验 | 防注入、非法数据 |
| **隔离层** | ownerId | 所有查询带 ownerId 过滤 | 用户间数据完全隔离 |

### 10.3 安全检查清单

上线前必须确认：

- [ ] `JWT_SECRET` 已更换为随机生成的值
- [ ] `ENCRYPTION_KEY` 已更换为随机生成的值
- [ ] 测试账号密码已修改（admin@taskflow.com / user@taskflow.com）
- [ ] `NODE_ENV` 设为 `production`
- [ ] `FRONTEND_URL` 仅包含实际使用的域名/IP
- [ ] `COOKIE_SECURE` 在 HTTPS 下设为 `true`
- [ ] `.env` 文件权限设为 `600`（仅 owner 可读写）
- [ ] Nginx 隐藏文件拦截生效（访问 `/.env` 返回 403）
- [ ] PM2 日志中不输出敏感信息

```bash
# 设置 .env 文件权限
chmod 600 /home/taskflow/backend/.env

# 验证隐藏文件拦截
curl -I http://你的服务器IP/.env
# 应返回 403 Forbidden
```

---

## 11. 可选组件部署

### 11.1 n8n 自动化工作流

**用途**：自动化执行定时任务，如过期提醒、费用预警、周报生成。

**部署方式**：Docker

```bash
# 启动 n8n
docker run -d \
  --name n8n \
  --restart unless-stopped \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=你的密码 \
  n8nio/n8n

# 在 n8n 面板中导入工作流
# 打开 http://服务器IP:5678
# 导入 n8n/workflows/ 目录下的 JSON 文件
```

**在后端配置 n8n**：
```bash
# backend/.env
N8N_BASE_URL="http://localhost:5678"
N8N_WEBHOOK_SECRET="你的Webhook密钥"
```

**7 个预置工作流**：

| 工作流 | 触发方式 | 功能 |
|--------|---------|------|
| 过期提醒 | 每日定时 | 检查过期任务并发送通知 |
| 费用预警 | 每日定时 | 检查费用超阈值并预警 |
| 周报生成 | 每周定时 | 自动生成并发送周报 |
| 记忆整理 | 每周定时 | 整理 AI 对话记忆 |
| AI 任务解析 | Webhook | 智能解析自然语言创建任务 |
| 日程建议 | Webhook | AI 分析并推荐日程安排 |
| 商业搜索 | Webhook | 搜索商业信息和竞品 |

### 11.2 Clash 代理（中国大陆服务器）

**用途**：通过代理访问 DeepSeek、Google 等外部 API。

```bash
# 使用项目自带的安装脚本
bash scripts/install-clash.sh

# 安装后配置后端代理
# backend/.env
PROXY_URL="http://127.0.0.1:7890"
```

### 11.3 SearXNG 搜索引擎（可选）

**用途**：自托管的元搜索引擎，用于 AI 联网搜索功能。

```bash
# Docker 部署
docker run -d \
  --name searxng \
  --restart unless-stopped \
  -p 8888:8080 \
  searxng/searxng

# 配置后端
# backend/.env
SEARXNG_URL="http://localhost:8888"
```

---

## 12. 监控与日志

### 12.1 日志文件位置

```
后端日志:
  /home/taskflow/backend/logs/api-out.log      # 标准输出
  /home/taskflow/backend/logs/api-error.log    # 错误日志

前端日志:
  /home/taskflow/frontend/logs/web-out.log     # 标准输出
  /home/taskflow/frontend/logs/web-error.log   # 错误日志

备份日志:
  /home/taskflow/logs/backup.log               # 数据库备份日志

Nginx 日志:
  /var/log/nginx/access.log                    # 访问日志
  /var/log/nginx/error.log                     # 错误日志
```

### 12.2 日志轮转配置

PM2 已配置自动轮转：
- 单个日志文件最大 **10MB**
- 保留最近 **7 个** 日志文件
- 超出自动清理

### 12.3 常用监控命令

```bash
# 实时查看所有日志
pm2 logs --lines 100

# 仅看错误日志
pm2 logs taskflow-api --err --lines 50

# 查看 CPU 和内存使用
pm2 monit

# 查看进程详细信息（重启次数、运行时间等）
pm2 show taskflow-api

# 检查磁盘使用
df -h

# 检查 SQLite 数据库大小
ls -lh /home/taskflow/backend/prisma/dev.db*

# 检查备份文件
ls -lh /home/taskflow/backups/
```

### 12.4 健康检查脚本

```bash
#!/bin/bash
# health-check.sh — 快速检查所有服务状态

echo "=== PM2 进程状态 ==="
pm2 status

echo ""
echo "=== 后端 API 健康检查 ==="
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/auth/captcha)
if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ 后端 API 正常 (HTTP $HTTP_CODE)"
else
  echo "✗ 后端 API 异常 (HTTP $HTTP_CODE)"
fi

echo ""
echo "=== 前端健康检查 ==="
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ 前端服务正常 (HTTP $HTTP_CODE)"
else
  echo "✗ 前端服务异常 (HTTP $HTTP_CODE)"
fi

echo ""
echo "=== 磁盘使用 ==="
df -h / | tail -1

echo ""
echo "=== 内存使用 ==="
free -h | head -2

echo ""
echo "=== 数据库大小 ==="
ls -lh /home/taskflow/backend/prisma/dev.db 2>/dev/null || echo "数据库文件不存在"
```

---

## 13. 故障排查手册

### 13.1 常见问题与解决方案

#### 问题 1：网站无法访问

```bash
# 排查步骤：
# 1. 检查 Nginx 是否运行
sudo systemctl status nginx

# 2. 检查 PM2 进程状态
pm2 status
# 如果进程不是 online，查看错误日志
pm2 logs taskflow-api --err --lines 20

# 3. 检查端口是否监听
ss -tlnp | grep -E '80|3000|3001'

# 4. 检查防火墙
sudo ufw status
# 如果防火墙开启，需要放行 80 端口
sudo ufw allow 80/tcp
```

#### 问题 2：API 返回 502 Bad Gateway

```bash
# 原因：后端进程崩溃或未启动

# 检查后端进程
pm2 status

# 查看崩溃原因
pm2 logs taskflow-api --err --lines 50

# 常见原因：
# - 端口被占用: ss -tlnp | grep 3001
# - 内存不足: free -h
# - .env 配置错误: 检查必填变量是否缺失

# 重启后端
pm2 restart taskflow-api
```

#### 问题 3：数据库相关错误

```bash
# "database is locked"
# 原因：SQLite 写入冲突，可能有其他进程在操作数据库
# 解决：确保只有一个后端进程在运行
pm2 status  # 确认只有 1 个 taskflow-api 实例

# "no such table"
# 原因：数据库表未创建
cd /home/taskflow/backend
npx prisma migrate deploy

# "Prisma Client not generated"
cd /home/taskflow/backend
npx prisma generate
```

#### 问题 4：构建失败

```bash
# 后端构建失败
cd /home/taskflow/backend
npm run build 2>&1 | tail -20
# 查看 TypeScript 编译错误

# 前端构建失败
cd /home/taskflow/frontend
npm run build 2>&1 | tail -30
# 常见原因：内存不足
# 解决：增加 swap 空间
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

#### 问题 5：Nginx 504 Gateway Timeout

```bash
# 原因：后端响应超时
# 常见于 AI 流式响应

# 检查 Nginx 超时配置
grep -n "proxy_read_timeout" /etc/nginx/sites-available/taskflow.conf

# 确保 API 路由的超时足够长
# proxy_read_timeout 120s;  # AI 接口需要 120 秒
```

#### 问题 6：登录后立即跳回登录页

```bash
# 原因：JWT Cookie 无法设置

# 检查项：
# 1. FRONTEND_URL 是否正确（必须包含当前访问的地址）
# 2. COOKIE_SECURE 是否与协议匹配（HTTP 应为 false）
# 3. Nginx 是否正确传递了 X-Forwarded-Proto

# 检查 Cookie 设置
curl -v http://服务器IP/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@taskflow.com","password":"123456","captcha":"..."}'
# 查看响应中的 Set-Cookie 头
```

### 13.2 性能问题排查

```bash
# CPU 占用过高
pm2 monit  # 查看实时 CPU 使用
# 可能原因：AI 请求并发过多、大量定时任务

# 内存占用过高
pm2 show taskflow-api  # 查看内存使用
# 超过 512MB 会自动重启
# 如果频繁重启，考虑增加 max_memory_restart

# 磁盘空间不足
df -h
# 清理旧日志
find /home/taskflow -name "*.log" -mtime +7 -delete
# 清理旧备份
find /home/taskflow/backups -name "*.db" -mtime +7 -delete
```

---

## 14. HTTPS 升级指南

### 14.1 使用 Let's Encrypt 免费证书

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 申请证书（替换为你的域名）
sudo certbot --nginx -d your-domain.com

# 自动续期（Certbot 会自动设置 cron）
sudo certbot renew --dry-run
```

### 14.2 申请后的配置变更

```bash
# 1. Nginx 配置 —— 取消 HSTS 注释
# /etc/nginx/sites-available/taskflow.conf
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# 2. 后端 .env —— 更新 Cookie 安全设置
COOKIE_SECURE="true"
FRONTEND_URL="https://your-domain.com"

# 3. 前端 .env.local —— 确认使用相对路径（无需修改）
# NEXT_PUBLIC_API_URL="/api"   ← 已是相对路径，自动适配 HTTPS

# 4. 重启服务
sudo systemctl reload nginx
pm2 restart taskflow-api --update-env
```

### 14.3 HTTP 到 HTTPS 重定向

Certbot 会自动添加以下配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

---

## 附录 A：完整部署检查清单

### 首次部署

- [ ] 服务器环境已安装（Node.js 20+, PM2, Nginx, Git）
- [ ] 代码已克隆到 `/home/taskflow`
- [ ] `backend/.env` 已配置（3 个必填项 + 推荐项）
- [ ] 后端依赖已安装（`npm ci`）
- [ ] 前端依赖已安装（`npm ci`）
- [ ] Prisma Client 已生成（`prisma generate`）
- [ ] 数据库已迁移（`prisma migrate deploy`）
- [ ] 后端已构建（`npm run build`）
- [ ] 前端已构建（`npm run build`）
- [ ] Nginx 配置已部署并测试通过
- [ ] PM2 已启动并保存进程列表
- [ ] PM2 开机自启已设置
- [ ] 数据库备份 cron 已配置
- [ ] 安全检查清单全部通过
- [ ] 浏览器可以正常访问和登录

### 每次更新

- [ ] 代码已拉取最新版本
- [ ] 依赖已更新（如有变更）
- [ ] 数据库已迁移（如有变更）
- [ ] 项目已重新构建
- [ ] PM2 服务已重启
- [ ] 功能验证通过

---

## 附录 B：项目目录结构

```
/home/taskflow/
├── backend/                    # 后端 Express 服务
│   ├── src/
│   │   ├── server.ts          # 入口文件
│   │   ├── app.ts             # Express 应用配置
│   │   ├── config.ts          # 环境变量加载
│   │   ├── routes/            # 26 个路由模块
│   │   ├── services/          # 28 个业务服务
│   │   ├── validators/        # Zod 校验 Schema
│   │   ├── middleware/        # auth / rateLimit / validate
│   │   ├── ai/                # AI 子系统
│   │   ├── jobs/              # 8 个定时任务
│   │   └── prompts/           # AI 提示词模板
│   ├── prisma/
│   │   ├── schema.prisma      # 数据库 Schema（26 张表）
│   │   ├── migrations/        # 数据库迁移文件
│   │   └── dev.db             # SQLite 数据库文件
│   ├── dist/                  # 构建输出（TypeScript → JavaScript）
│   ├── .env                   # 环境变量（不入库）
│   ├── logs/                  # PM2 日志
│   └── package.json
├── frontend/                   # 前端 Next.js 服务
│   ├── src/
│   │   ├── app/               # 18 个页面
│   │   ├── components/        # UI 组件
│   │   └── hooks/             # 自定义 Hooks
│   ├── .next/                 # 构建输出
│   ├── .env.local             # 前端环境变量
│   ├── logs/                  # PM2 日志
│   └── package.json
├── deploy/                     # 部署配置
│   ├── nginx/taskflow.conf    # Nginx 配置
│   └── scripts/
│       ├── deploy.sh          # 一键部署脚本
│       └── backup-db.sh       # 数据库备份脚本
├── n8n/workflows/             # n8n 自动化工作流（7 个）
├── scripts/
│   └── install-clash.sh       # Clash 代理安装脚本
├── ecosystem.config.js         # PM2 进程配置
├── package.json                # 根目录编排脚本
└── backups/                    # 数据库备份目录
```

---

## 附录 C：技术栈版本表

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 20 LTS | 运行时环境 |
| Express | 5.1.0 | 后端 Web 框架 |
| Prisma | 6.9.0 | 数据库 ORM |
| SQLite | 内嵌 | 数据库引擎 |
| Zod | 3.25.23 | 参数校验 |
| Next.js | 16.2.6 | 前端框架 |
| React | 19.2.4 | UI 库 |
| Tailwind CSS | 4.x | 样式框架 |
| shadcn/ui | 4.8.3 | 组件库 |
| React Query | 5.x | 服务端状态管理 |
| Zustand | 5.x | 客户端状态管理 |
| OpenAI SDK | 4.x | AI 接口调用 |
| PM2 | 5.x | 进程管理 |
| Nginx | 1.18+ | 反向代理 |
| TypeScript | 5.8.3 | 类型系统 |
| Vitest | 3.x | 测试框架 |

---

> **文档版本**：v1.0
> **最后更新**：2026-06-24
> **适用项目**：TaskFlow+ v1.0.0
