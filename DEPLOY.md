# AgentRecall MCP Server 部署文档

## 系统要求

### 最低配置

- **CPU**: 2 核
- **内存**: 4 GB
- **磁盘**: 20 GB SSD
- **网络**: 公网 IP，开放 80/443 端口

### 推荐配置

- **CPU**: 4 核
- **内存**: 8 GB
- **磁盘**: 50 GB SSD
- **网络**: 公网 IP，开放 80/443 端口

### 软件要求

- Docker 20.10+
- Docker Compose 2.0+
- Git (可选，用于代码管理)

## 快速部署

### 1. 下载代码

```bash
git clone https://github.com/agrecall/agentrecall-mcp.git
cd agentrecall
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置以下必需变量：

```bash
# 数据库密码（至少 16 个字符）
DB_PASSWORD=your_secure_database_password_here

# JWT 密钥（至少 32 个字符，用于签名 JWT）
JWT_SECRET=your_jwt_secret_key_min_32_chars_long_abc123

# API Key（在管理后台创建后填写）
```

### 3. 一键部署

```bash
./deploy.sh install
./deploy.sh start
```

**注意**：首次部署时，PostgreSQL 会自动执行 `init.sql` 创建所有需要的表（包括后台管理功能所需的表）。无需手动运行其他 SQL 文件。

### 4. 验证部署

```bash
# 健康检查
curl http://localhost:3000/health

# 运行测试
./test.sh
```

## 详细部署步骤

### 步骤 1：环境准备

#### 安装 Docker

**Ubuntu/Debian:**
```bash
# 更新包索引
sudo apt-get update

# 安装依赖
sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release

# 添加 Docker GPG 密钥
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 添加 Docker 仓库
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 添加当前用户到 docker 组
sudo usermod -aG docker $USER
```

**CentOS/RHEL:**
```bash
# 安装依赖
sudo yum install -y yum-utils

# 添加 Docker 仓库
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# 安装 Docker
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker
```

#### 验证 Docker 安装

```bash
docker --version
docker compose version
```

### 步骤 2：获取代码

```bash
# 方式 1：Git 克隆
git clone https://github.com/agrecall/agentrecall-mcp.git
cd agentrecall

# 方式 2：直接下载
curl -L https://github.com/agentrecall/agentrecall/archive/main.tar.gz | tar xz
cd agentrecall-main
```

### 步骤 3：配置环境

#### 创建环境变量文件

```bash
cp .env.example .env
```

#### 生成安全密钥

```bash
# 生成 DB_PASSWORD
db_password=$(openssl rand -base64 24)
echo "DB_PASSWORD=$db_password"

# 生成 JWT_SECRET
jwt_secret=$(openssl rand -base64 48)
echo "JWT_SECRET=$jwt_secret"

# 生成 OTP_MASTER_KEY
otp_key=$(openssl rand -base64 48)
echo "OTP_MASTER_KEY=$otp_key"
```

#### 编辑 .env 文件

```bash
nano .env
```

填入生成的密钥：

```bash
DB_PASSWORD=your_generated_db_password
JWT_SECRET=your_generated_jwt_secret
# API_KEY=your_api_key_here  # 在管理后台创建
```

### 步骤 4：启动服务

#### 方式 1：使用部署脚本

```bash
./deploy.sh install
./deploy.sh start
```

#### 方式 2：手动启动

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 步骤 5：验证服务

#### 健康检查

```bash
curl http://localhost:3000/health
```

预期响应：
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "services": {
    "database": {
      "status": "ok",
      "latency": "5ms"
    },
    "server": {
      "status": "ok",
      "uptime": 60
    }
  }
}
```

#### MCP 初始化测试

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'
```

#### 运行完整测试

```bash
./test.sh
```

## 生产环境配置

### 1. SSL/TLS 配置

#### 使用 Let's Encrypt

```bash
# 安装 Certbot
sudo apt-get install -y certbot

# 获取证书
sudo certbot certonly --standalone -d your-domain.com

# 复制证书到项目目录
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem

# 设置权限
sudo chmod 644 nginx/ssl/cert.pem
sudo chmod 600 nginx/ssl/key.pem
```

#### 启用 HTTPS

编辑 `nginx/nginx.conf`，取消 HTTPS server 部分的注释：

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    location / {
        proxy_pass http://mcp-server:3000;
        # ...
    }
}
```

### 2. 防火墙配置

```bash
# Ubuntu/Debian (UFW)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 3. 自动更新证书

创建定时任务：

```bash
sudo crontab -e
```

添加：

```bash
# 每天凌晨 2 点检查并更新证书
0 2 * * * certbot renew --quiet --deploy-hook "docker-compose -f /path/to/agentrecall/docker-compose.yml restart nginx"
```

### 4. 日志管理

#### 配置日志轮转

创建 `/etc/logrotate.d/agentrecall`：

```bash
/path/to/agentrecall/server/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
    sharedscripts
    postrotate
        docker-compose -f /path/to/agentrecall/docker-compose.yml kill -s USR1 mcp-server
    endscript
}
```

### 5. 监控配置

#### 使用 Prometheus + Grafana（可选）

在 `docker-compose.yml` 中添加：

```yaml
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus:/etc/prometheus
    ports:
      - "9090:9090"
    
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
```

## 运维管理

### 常用命令

```bash
# 查看服务状态
./deploy.sh status

# 查看日志
./deploy.sh logs
./deploy.sh logs mcp-server
./deploy.sh logs postgres

# 重启服务
./deploy.sh restart

# 更新服务
./deploy.sh update

# 备份数据
./deploy.sh backup

# 恢复数据
./deploy.sh restore backups/20240101_120000/database.sql

# 清理数据（危险！）
./deploy.sh clean
```

### Docker Compose 命令

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 查看日志
docker-compose logs -f

# 重启单个服务
docker-compose restart mcp-server

# 重新构建
docker-compose build --no-cache

# 查看资源使用
docker-compose stats
```

### 数据库管理

```bash
# 进入 PostgreSQL 容器
docker-compose exec postgres psql -U agentrecall -d agentrecall

# 备份数据库
docker-compose exec postgres pg_dump -U agentrecall agentrecall > backup.sql

# 恢复数据库
docker-compose exec -T postgres psql -U agentrecall agentrecall < backup.sql

# 查看表结构
docker-compose exec postgres psql -U agentrecall -c "\dt"

# 查看统计
docker-compose exec postgres psql -U agentrecall -c "SELECT * FROM get_community_stats()"
```

### Redis 管理

```bash
# 进入 Redis 容器
docker-compose exec redis redis-cli

# 查看限流键
docker-compose exec redis redis-cli KEYS "ratelimit:*"

# 清空限流数据
docker-compose exec redis redis-cli FLUSHDB
```

## 故障排查

### 服务无法启动

```bash
# 检查日志
docker-compose logs mcp-server

# 检查端口占用
sudo netstat -tlnp | grep 3000

# 检查环境变量
cat .env

# 重建服务
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### 数据库连接失败

```bash
# 检查 PostgreSQL 状态
docker-compose ps postgres
docker-compose logs postgres

# 检查数据库是否就绪
docker-compose exec postgres pg_isready -U agentrecall

# 重置数据库（会丢失数据！）
docker-compose down -v
docker-compose up -d postgres
sleep 10
docker-compose up -d
```

### 限流不生效

```bash
# 检查 Redis 状态
docker-compose ps redis
docker-compose logs redis

# 清空限流数据
docker-compose exec redis redis-cli FLUSHDB

# 检查限流日志
docker-compose exec postgres psql -U agentrecall -c "SELECT * FROM rate_limit_logs ORDER BY created_at DESC LIMIT 10"
```

### 性能问题

```bash
# 查看资源使用
docker-compose stats

# 查看数据库慢查询
docker-compose exec postgres psql -U agentrecall -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10"

# 优化 PostgreSQL
# 编辑 postgresql.conf，调整 shared_buffers, work_mem 等参数
```

## 升级指南

### 小版本升级

```bash
# 拉取最新代码
git pull

# 重新构建
docker-compose build --no-cache

# 重启服务
docker-compose up -d
```

### 大版本升级

```bash
# 1. 备份数据
./deploy.sh backup

# 2. 停止服务
docker-compose down

# 3. 拉取最新代码
git pull

# 4. 检查迁移文档
cat MIGRATION.md

# 5. 执行数据库迁移（如有）
docker-compose up -d postgres
sleep 10
docker-compose exec postgres psql -U agentrecall -f /migrations/v2.sql

# 6. 启动服务
docker-compose up -d

# 7. 验证升级
./test.sh
```

## 安全建议

1. **定期更新密码**：每 3 个月更换一次 DB_PASSWORD、JWT_SECRET
2. **启用防火墙**：只开放必要的端口（22, 80, 443）
3. **使用 HTTPS**：生产环境必须启用 SSL/TLS
4. **定期备份**：设置自动备份任务
5. **监控日志**：配置日志告警，及时发现异常
6. **更新软件**：定期更新 Docker 镜像和系统补丁

## 获取帮助

- **GitHub Issues**: https://github.com/agentrecall/agentrecall/issues
- **文档**: https://docs.agentrecall.io
- **邮件**: support@agentrecall.io
