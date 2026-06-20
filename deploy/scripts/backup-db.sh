#!/bin/bash
# ============================================================
# TaskFlow+ SQLite 数据库备份脚本
# 用法: bash deploy/scripts/backup-db.sh
# 建议加入系统 cron: 0 3 * * * /path/to/deploy/scripts/backup-db.sh
# ============================================================

set -euo pipefail

# ===== 配置 =====
DB_PATH="${DB_PATH:-/home/taskflow/backend/prisma/dev.db}"
BACKUP_DIR="${BACKUP_DIR:-/home/taskflow/backups}"
KEEP_DAYS=7           # 保留最近 N 天的备份
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/dev_${DATE}.db"

# ===== 检查 =====
if [ ! -f "$DB_PATH" ]; then
  echo "[ERROR] 数据库文件不存在: $DB_PATH"
  exit 1
fi

# ===== 创建备份目录 =====
mkdir -p "$BACKUP_DIR"

# ===== 使用 SQLite .backup 命令（安全在线备份） =====
sqlite3 "$DB_PATH" ".backup '${BACKUP_FILE}'"

# ===== 验证备份完整性 =====
INTEGRITY=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;")
if [ "$INTEGRITY" != "ok" ]; then
  echo "[ERROR] 备份文件完整性检查失败: $INTEGRITY"
  rm -f "$BACKUP_FILE"
  exit 1
fi

echo "[OK] 备份成功: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# ===== 清理旧备份 =====
find "$BACKUP_DIR" -name "dev_*.db" -mtime +${KEEP_DAYS} -delete 2>/dev/null || true
REMAINING=$(find "$BACKUP_DIR" -name "dev_*.db" | wc -l)
echo "[INFO] 备份目录保留 ${REMAINING} 个备份文件"
