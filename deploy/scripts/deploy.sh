#!/bin/bash
# ============================================================
# TaskFlow+ 一键部署脚本
# 用法: bash deploy/scripts/deploy.sh
# 前提: 已安装 Node.js、PM2、Nginx
# ============================================================

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/taskflow}"
echo "=============================="
echo " TaskFlow+ 部署"
echo "=============================="

# 1. 拉取最新代码
echo "[1/6] 拉取最新代码..."
cd "$PROJECT_DIR"
git pull origin main

# 2. 安装依赖（含 devDeps，构建需要 tsc/prisma 等）
echo "[2/6] 安装后端依赖..."
cd "$PROJECT_DIR/backend"
npm ci

echo "      安装前端依赖..."
cd "$PROJECT_DIR/frontend"
npm ci

# 3. 数据库迁移
echo "[3/6] 数据库迁移..."
cd "$PROJECT_DIR/backend"
npx prisma generate
npx prisma migrate deploy

# 4. 构建
echo "[4/6] 构建后端..."
cd "$PROJECT_DIR/backend"
npm run build

echo "      构建前端..."
cd "$PROJECT_DIR/frontend"
npm run build

# 5. 确保日志目录存在
echo "[5/6] 初始化目录..."
mkdir -p "$PROJECT_DIR/backend/logs"
mkdir -p "$PROJECT_DIR/frontend/logs"

# 6. 重启服务
echo "[6/6] 重启 PM2 服务..."
cd "$PROJECT_DIR"
pm2 startOrRestart ecosystem.config.js --update-env

echo ""
echo "=============================="
echo " 部署完成！"
echo " 后端: http://localhost:3001"
echo " 前端: http://localhost:3000"
echo " PM2:  pm2 status"
echo "=============================="
