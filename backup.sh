#!/bin/bash
set -e

BACKUP_DIR="/opt/agentrecall/backups"
DATE=$(date +%Y%m%d_%H%M%S)
echo "=== AgentRecall Backup Started at $DATE ==="

mkdir -p $BACKUP_DIR

# 1. Git backup
cd /opt/agentrecall
echo "[1/6] Backing up Git..."
git add . 2>/dev/null || true
git commit -m "Backup before update $DATE" 2>/dev/null || echo "No changes"
tar czf $BACKUP_DIR/git_$DATE.tar.gz .git 2>/dev/null || true

# 2. Config files
echo "[2/6] Backing up config files..."
cp /opt/agentrecall/.env $BACKUP_DIR/
cp /opt/agentrecall/docker-compose.yml $BACKUP_DIR/
cp /opt/agentrecall/nginx/nginx.conf $BACKUP_DIR/

# 3. Web static files
echo "[3/6] Backing up web static files..."
if [ -d "/opt/agentrecall/web/dist" ]; then
    tar czf $BACKUP_DIR/web_dist_$DATE.tar.gz -C /opt/agentrecall web/dist
fi

# 4. Database
echo "[4/6] Backing up PostgreSQL..."
docker exec agentrecall-db pg_dump -U agentrecall agentrecall > $BACKUP_DIR/db_$DATE.sql

# 5. Docker images (optional)
echo "[5/6] Listing backup..."
ls -lh $BACKUP_DIR/

echo "=== Backup finished at $(date) ==="
