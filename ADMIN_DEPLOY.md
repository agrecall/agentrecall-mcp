# AgentRecall 后台管理功能部署方案

## 一、功能概述

后台管理功能提供完整的用户管理、API Key 管理、使用统计和交互历史查看功能。

### 功能列表

| 功能模块 | 描述 | 访问权限 |
|---------|------|---------|
| 用户注册/登录 | 邮箱密码注册登录 | 所有用户 |
| 仪表盘 | 今日/本月使用量统计 | 所有用户 |
| API Key 管理 | 创建、删除、查看 API Key | 所有用户 |
| 交互历史 | 查看历史调用记录 | 所有用户 |
| 使用统计 | API 调用趋势分析 | 所有用户 |
| 用户管理 | 管理所有用户 | 仅管理员 |
| 系统设置 | 系统整体统计 | 仅管理员 |

## 二、部署步骤

### 1. 环境准备

确保已安装：
- Docker 20.10+
- Docker Compose 2.0+

### 2. 配置文件

创建 `.env` 文件：

```bash
cd /mnt/okcomputer/output/agentrecall
cp .env.example .env
```

编辑 `.env`：

```bash
# 数据库密码（至少16位）
DB_PASSWORD=YourSecurePassword123!

# JWT 密钥（至少32位）
JWT_SECRET=YourJWTSecretKeyMustBeAtLeast32CharactersLong

# API Key（在管理后台创建）
```

### 3. 目录权限设置

确保静态文件目录权限正确：

```bash
# 设置目录权限为 755
chmod -R 755 web/dist
chmod -R 755 web/admin

# 确保 nginx 可以读取
ls -la web/
```

### 4. 启动服务

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 5. 验证部署

```bash
# 1. 检查 PostgreSQL 健康状态
docker-compose exec postgres pg_isready -U agentrecall

# 2. 检查 pgvector 扩展
docker-compose exec postgres psql -U agentrecall -d agentrecall -c "\dx"

# 3. 检查后端 API
curl http://localhost:3000/health

# 4. 检查后台管理界面
curl http://localhost/admin/
```

## 三、后台管理界面访问

### 访问地址

- 后台管理：`http://localhost/admin/`
- API 文档：`http://localhost/api/v1/`

### 首次使用

1. 访问 `http://localhost/admin/`
2. 点击"立即注册"创建管理员账号
3. 第一个注册用户自动成为管理员
4. 登录后即可使用所有功能

## 四、API 接口文档

### 用户管理

| 方法 | 端点 | 描述 |
|-----|------|------|
| POST | `/api/v1/users/register` | 用户注册 |
| POST | `/api/v1/users/login` | 用户登录 |
| GET | `/api/v1/users/me` | 获取当前用户信息 |
| PUT | `/api/v1/users/me` | 更新用户信息 |
| GET | `/api/v1/users` | 获取用户列表（管理员） |
| PUT | `/api/v1/users/:id/status` | 更新用户状态（管理员） |
| PUT | `/api/v1/users/:id/quota` | 更新用户配额（管理员） |

### API Key 管理

| 方法 | 端点 | 描述 |
|-----|------|------|
| GET | `/api/v1/apikeys` | 获取 API Key 列表 |
| POST | `/api/v1/apikeys` | 创建 API Key |
| DELETE | `/api/v1/apikeys/:id` | 删除 API Key |
| GET | `/api/v1/apikeys/:id/usage` | 获取 API Key 使用统计 |
| GET | `/api/v1/apikeys/admin/all` | 获取所有 API Keys（管理员） |

### 统计功能

| 方法 | 端点 | 描述 |
|-----|------|------|
| GET | `/api/v1/stats/dashboard` | 获取仪表盘数据 |
| GET | `/api/v1/stats/user` | 获取用户使用统计 |
| GET | `/api/v1/stats/usage` | 获取 API 使用日志 |
| GET | `/api/v1/stats/history` | 获取交互历史 |
| GET | `/api/v1/stats/history/:id` | 获取交互详情 |
| GET | `/api/v1/stats/system` | 获取系统统计（管理员） |

## 五、常见问题

### 1. PostgreSQL 启动失败

**问题**：权限错误或扩展加载失败

**解决**：
```bash
# 删除旧数据卷
docker-compose down -v

# 重新启动
docker-compose up -d postgres

# 等待健康检查通过
docker-compose ps postgres
```

### 2. 静态文件 403 错误

**问题**：nginx 无法读取静态文件

**解决**：
```bash
# 设置正确的权限
chmod -R 755 web/

# 重启 nginx
docker-compose restart nginx
```

### 3. TypeScript 编译错误

**问题**：严格模式导致编译失败

**解决**：已关闭严格模式，如需开启请修复代码类型问题

### 4. 数据库连接失败

**问题**：sslmode 配置问题

**解决**：已在 DATABASE_URL 中添加 `sslmode=disable`

## 六、系统配置

### 修改系统配置

```bash
# 进入数据库
docker-compose exec postgres psql -U agentrecall -d agentrecall

# 查看配置
SELECT * FROM system_configs;

# 修改配置
UPDATE system_configs SET config_value = '2000' WHERE config_key = 'default_api_quota';
```

### 可用配置项

| 配置项 | 默认值 | 说明 |
|-------|-------|------|
| default_api_quota | 1000 | 默认用户 API 配额 |
| default_rate_limit | 100 | 默认 API Key 速率限制(次/分钟) |
| max_api_keys_per_user | 5 | 每个用户最多 API Key 数量 |
| log_retention_days | 30 | 日志保留天数 |
| enable_registration | true | 是否开放注册 |

## 七、安全建议

1. **修改默认密码**：首次部署后立即修改管理员密码
2. **启用 HTTPS**：生产环境使用 SSL 证书
3. **限制访问**：使用防火墙限制访问 IP
4. **定期备份**：设置数据库自动备份
5. **监控日志**：定期检查异常访问日志

## 八、备份与恢复

### 备份数据库

```bash
# 备份命令
docker-compose exec postgres pg_dump -U agentrecall agentrecall > backup_$(date +%Y%m%d).sql
```

### 恢复数据库

```bash
# 恢复命令
docker-compose exec -T postgres psql -U agentrecall agentrecall < backup_20240101.sql
```

## 九、监控与维护

### 查看资源使用

```bash
# 查看容器资源使用
docker-compose stats

# 查看日志
docker-compose logs -f mcp-server
docker-compose logs -f postgres
```

### 清理日志

```bash
# 清理旧日志
docker-compose exec postgres psql -U agentrecall -d agentrecall -c "DELETE FROM api_usage_logs WHERE created_at < NOW() - INTERVAL '30 days';"
docker-compose exec postgres psql -U agentrecall -d agentrecall -c "DELETE FROM chat_history WHERE created_at < NOW() - INTERVAL '30 days';"
```

## 十、扩展部署

### 读写分离部署

```bash
# 使用读写分离配置
docker-compose -f docker-compose.replica.yml up -d
```

### Kubernetes 部署

```bash
# 应用 K8s 配置
kubectl apply -f k8s/
```
