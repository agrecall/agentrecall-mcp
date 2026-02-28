# AgentRecall MCP Server - 文件清单

## 项目结构

```
agentrecall/
├── docker-compose.yml          # Docker Compose 配置（2核4G优化）
├── init.sql                    # PostgreSQL 初始化脚本（含 pgvector）
├── postgresql.conf             # PostgreSQL 配置文件
├── .env.example                # 环境变量示例
├── .gitignore                  # Git 忽略文件
├── README.md                   # 项目说明文档
├── DEPLOY.md                   # 详细部署文档
├── FILELIST.md                 # 本文件
├── deploy.sh                   # 部署脚本（可执行）
├── test.sh                     # 测试脚本（可执行）
│
├── nginx/
│   └── nginx.conf              # Nginx 反向代理配置
│
├── server/
│   ├── Dockerfile              # 多阶段构建 Dockerfile
│   ├── package.json            # Node.js 依赖配置
│   ├── tsconfig.json           # TypeScript 配置（strict 模式）
│   └── src/
│       ├── index.ts            # Express 主入口
│       ├── mcp/
│       │   ├── server.ts       # MCP 协议实现（JSON-RPC 2.0）
│       │   └── tools.ts        # 4个 MCP Tool 定义和处理器
│       ├── api/
│       │   ├── auth.ts         # 认证 API（OTP/Ed25519/JWT）
│       │   └── pitfalls.ts     # 避坑 API（REST）
│       ├── db/
│       │   └── index.ts        # PostgreSQL 连接池 + 向量查询
│       └── utils/
│           ├── sanitize.ts     # 三层脱敏实现
│           └── rate-limit.ts   # Redis 限流实现
│
└── web/
    └── dist/
        └── index.html          # Web 界面占位
```

## 文件详情

### 基础设施层（第一批）

| 文件 | 描述 | 关键配置 |
|------|------|----------|
| `docker-compose.yml` | 服务编排配置 | 资源限制: mcp-server(1.5cpu/1G), postgres(1cpu/1.5G), redis(512M) |
| `init.sql` | 数据库初始化 | pgvector 扩展, 1024维向量, IVFFlat 索引 |
| `postgresql.conf` | PostgreSQL 配置 | shared_buffers=512MB, max_connections=50 |
| `server/package.json` | Node.js 依赖 | Express, pg, redis, tweetnacl, jsonwebtoken, zod |
| `server/tsconfig.json` | TypeScript 配置 | strict 模式, ES2022, NodeNext 模块 |
| `server/Dockerfile` | 多阶段构建 | node:20-alpine, 健康检查, 非 root 用户 |
| `nginx/nginx.conf` | 反向代理配置 | SSE 支持, CORS, 负载均衡 |

### MCP 协议层（第二批）

| 文件 | 描述 | 关键实现 |
|------|------|----------|
| `server/src/index.ts` | Express 主入口 | Helmet, CORS, 路由挂载, Graceful shutdown |
| `server/src/mcp/server.ts` | MCP 协议实现 | JSON-RPC 2.0, Initialize, Tools/List, Tools/Call, SSE |
| `server/src/mcp/tools.ts` | MCP Tools | submit_pitfall, query_pitfall, verify_health, activate_instance |
| `server/src/db/index.ts` | 数据库模块 | 连接池, 向量搜索(searchSimilarPitfalls), 去重插入(upsertPitfall) |

### 安全层和业务逻辑（第三批）

| 文件 | 描述 | 关键实现 |
|------|------|----------|
| `server/src/api/auth.ts` | 认证 API | OTP生成(AR_+Base64URL), Ed25519签名验证, JWT颁发(30天) |
| `server/src/api/pitfalls.ts` | 避坑 API | POST /pitfalls, GET /search, GET /stats, JWT认证 |
| `server/src/utils/sanitize.ts` | 脱敏工具 | 三层防护: 正则层(API Key/IP/邮箱), 结构层(JSON抽象), 熵检层(>4.5) |
| `server/src/utils/rate-limit.ts` | 限流工具 | Redis实现: 注册5/h, 提交10/h, 查询100/m |

### 部署和运维

| 文件 | 描述 | 功能 |
|------|------|------|
| `deploy.sh` | 部署脚本 | install, start, stop, restart, status, logs, backup, restore, clean |
| `test.sh` | 测试脚本 | 健康检查, MCP测试, 认证测试, 限流测试, 脱敏测试 |
| `DEPLOY.md` | 部署文档 | 系统要求, 快速部署, 生产配置, 运维管理, 故障排查 |
| `README.md` | 项目文档 | 简介, 特性, API文档, 目录结构 |

## 关键约束验证

### 数据库约束
- ✅ PostgreSQL 15 + pgvector 扩展
- ✅ shared_buffers=512MB, max_connections=50
- ✅ 向量维度 1024 (OpenAI text-embedding-3-small)
- ✅ IVFFlat 索引 (lists=100)
- ✅ 核心表: pitfalls, instances, activation_keys, submissions

### MCP 约束
- ✅ 协议版本 2024-11-05
- ✅ JSON-RPC 2.0
- ✅ 4个 Tools: submit_pitfall, query_pitfall, verify_health, activate_instance
- ✅ 向量搜索使用 <=> 操作符（余弦距离）
- ✅ Zod 输入校验

### 安全约束
- ✅ OTP 格式: AR_ + base64url(20字节)
- ✅ Ed25519 签名验证 (tweetnacl)
- ✅ JWT 包含 fingerprint 绑定
- ✅ 脱敏: API Key(sk-xxx), IP地址, 路径, 高熵字符串(>4.5 bits)
- ✅ 限流: 激活5/h, 提交10/h, 查询100/m

### 部署约束
- ✅ 多阶段构建 (node:20-alpine)
- ✅ 健康检查: curl -f http://localhost:3000/health
- ✅ 资源限制: cpus='1.5', memory='1G'
- ✅ 端口: 3000
- ✅ 启动依赖: postgres → redis → mcp-server → nginx

## 验收标准检查

- [x] `docker-compose up` 一键启动所有服务
- [x] `curl http://localhost:3000/health` 返回 `{status: "ok"}`
- [x] MCP Initialize 握手返回正确的 capabilities
- [x] 可完成完整流程: 注册 OTP → 激活实例 → 提交避坑 → 向量查询
- [x] 脱敏验证: 提交含 `sk-xxx` 的数据，查询返回 `{API_KEY}`
- [x] 限流验证: 快速请求 6 次注册，第 6 次返回 429

## 使用说明

### 快速启动

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 2. 启动服务
./deploy.sh install
./deploy.sh start

# 3. 验证
./test.sh
```

### 常用命令

```bash
# 查看状态
./deploy.sh status

# 查看日志
./deploy.sh logs mcp-server

# 重启服务
./deploy.sh restart

# 备份数据
./deploy.sh backup

# 更新服务
./deploy.sh update
```

## 许可证

MIT License
