#!/bin/bash
# AgentRecall 一键恢复脚本

set -e

BACKUP_DIR="/opt/agentrecall/backups"

echo "=== AgentRecall Restore Script ==="
echo ""

# 列出可用备份
echo "Available backups:"
ls -lh $BACKUP_DIR/*.sql 2>/dev/null | tail -5
echo ""

# 读取用户输入
read -p "Enter backup date (YYYYMMDD_HHMMSS) or press Enter for latest: " DATE

if [ -z "$DATE" ]; then
    # 使用最新的备份
    DATE=$(ls -1 $BACKUP_DIR/db_*.sql 2>/dev/null | head -1 | xargs basename | sed s/db_// | sed s/.sql//)
    echo "Using latest backup: $DATE"
fi

DB_BACKUP="$BACKUP_DIR/db_$DATE.sql"
WEB_BACKUP="$BACKUP_DIR/web_dist_$DATE.tar.gz"

# 确认恢复
echo ""
echo "=== Restore Summary ==="
echo "  Database: $DB_BACKUP"
echo "  Web dist: $WEB_BACKUP"
echo ""
read -p "Continue? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "Aborted."
    exit 0
fi

# 1. 停止服务
echo "[1/4] Stopping services..."
cd /opt/agentrecall
docker compose down

# 2. 恢复代码（如果需要）
if [ -f "$BACKUP_DIR/git_$DATE.tar.gz" ]; then
    echo "[2/4] Restoring Git..."
    # Git 恢复通过 git reset --hard 实现更安全
    cd /opt/agentrecall
    git fetch origin main
    git reset --hard origin/main
fi

# 3. 恢复前端静态文件
if [ -f "$WEB_BACKUP" ]; then
    echo "[3/4] Restoring web static files..."
    rm -rf /opt/agentrecall/web/dist
    tar xzf $WEB_BACKUP -C /opt/agentrecall
fi

# 4. 恢复数据库
if [ -f "$DB_BACKUP" ]; then
    echo "[4/4] Restoring database..."
    docker compose up -d postgres redis
    sleep 5
    docker exec -i agentrecall-db psql -U agentrecall agentrecall < $DB_BACKUP
fi

# 重启服务
echo ""
echo "Restarting services..."
docker compose up -d

echo ""
echo "=== Restore complete! ==="
echo "Check status with: docker ps"
