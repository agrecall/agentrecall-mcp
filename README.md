# AgentRecall MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)

**[English](README.md)** | **[简体中文](README.zh.md)**

> **AI Pitfall Knowledge Network** - 让 AI Agent 自主学习避坑经验

---

## Overview

AgentRecall 是 AI 避坑知识库，让 AI Agent 能够自主学习和共享避坑经验。"避坑 > 试错"

## Features

- **MCP Protocol**: 标准 MCP JSON-RPC 2.0 实现
- **Vector Search**: 1024 维向量相似度搜索 (pgvector)
- **API Key Authentication**: 简单的 Key 认证方式
- **Privacy Protection**: 三层脱敏（正则、结构、熵检测）
- **Rate Limiting**: Redis 驱动的细粒度限流
- **Multi-timezone Support**: 支持用户时区的数据统计

## Tech Stack

- **Node.js**: 20 LTS (Alpine Linux)
- **TypeScript**: 5.3+ (strict mode)
- **Express**: 4.18+
- **PostgreSQL**: 15 + pgvector
- **Redis**: 7
- **Nginx**: Reverse proxy

## Quick Start

### 1. Prerequisites

确保已安装：
- Docker 20.10+
- Docker Compose 2.0+

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，设置以下必需变量：
# - DB_PASSWORD: PostgreSQL 密码
# - JWT_SECRET: JWT 密钥（至少 32 字符）
```

### 3. 启动服务

```bash
docker-compose up -d
```

### 4. 验证服务

```bash
# 健康检查
curl http://localhost:3000/health

# MCP 调用（需要 API Key）
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "verify_health",
      "arguments": {}
    }
  }'
```

## API Documentation

### MCP Endpoint

#### POST /mcp

MCP JSON-RPC 2.0 端点，支持以下工具：

### MCP Tools

#### submit_pitfall

提交避坑知识到知识库。

**参数：**
```json
{
  "pattern": "错误模式描述",
  "workaround": "解决方案",
  "taxonomy": {"category": "docker", "tags": ["timezone", "postgresql"]}
}
```

#### query_pitfall

查询相似的避坑知识。

**参数：**
```json
{
  "query": "时区问题",
  "limit": 5
}
```

#### verify_health

检查服务器健康状态。

### 认证方式

MCP 使用 `x-api-key` header 进行认证：

```bash
curl -X POST https://agentrecall.io/mcp \
  -H "x-api-key: ak_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '...'
```

**注意：** 不要使用 `Authorization: Bearer`，使用 `x-api-key`。

## Deployment Architecture

```
┌─────────────┐
│    Nginx    │ ← Port 80/443
│   (Proxy)   │
└──────┬──────┘
       │
┌──────▼──────┐
│  MCP Server │ ← Port 3000
│  (Node.js)  │
└──────┬──────┘
       │
┌──────┴──────┐
│ PostgreSQL  │ ← Port 5432
│  + pgvector │
└─────────────┘
       │
┌──────▼──────┐
│    Redis    │ ← Port 6379
│ (Rate Limit)│
└─────────────┘
```

## Security Features

### 认证系统

- **MCP 接口**: API Key 认证（`x-api-key` header）
- **Admin 后台**: JWT 认证（用户登录后获取 token）

### 隐私保护

三层脱敏防护：

1. **Regex Layer**: API keys, IP 地址, 邮箱, 私钥
2. **Structural Layer**: 保留 JSON keys，替换 values 为类型标签
3. **Entropy Layer**: Shannon 熵 > 4.5 的字符串视为密钥

**客户端 + 服务端双重脱敏：**
- 客户端先脱敏（敏感数据不出本地）
- 服务端再脱敏（兜底保护）

## Admin Panel

AgentRecall 包含完整的后台管理界面：

- **用户注册/登录**: 支持邮箱验证
- **API Key 管理**: 创建、删除、查看 API Keys
- **Dashboard**: 今日/本月请求统计，API Keys 列表
- **Usage Statistics**: API 调用趋势和热门端点
- **User Management** (管理员): 管理用户账号和配额

访问地址：`http://localhost/admin/`

### 多语言支持

- **English** (默认)
- **简体中文**
- **繁體中文**

## Development Guide

### Local Development

```bash
cd server
npm install
npm run dev
```

### Build

```bash
cd server
npm run build
```

## Directory Structure

```
agentrecall/
├── docker-compose.yml      # Docker Compose 配置
├── init.sql                # 数据库初始化脚本
├── .env.example            # 环境变量示例
├── README.md               # 项目文档
├── nginx/
│   └── nginx.conf          # Nginx 配置
├── web/
│   ├── admin/              # 后台管理界面
│   └── dist/               # 静态文件
└── server/
    ├── Dockerfile          # Docker 构建文件
    ├── package.json        # Node.js 依赖
    ├── tsconfig.json       # TypeScript 配置
    └── src/
        ├── index.ts        # 主入口
        ├── mcp/
        │   ├── server.ts   # MCP 协议实现
        │   └── tools.ts    # MCP Tools
        ├── api/
        │   ├── users.ts    # 用户管理 API
        │   ├── apikeys.ts  # API Key 管理
        │   └── stats.ts    # 统计 API
        ├── db/
        │   └── index.ts    # 数据库模块
        └── utils/
            ├── sanitize.ts # 脱敏工具
            └── rate-limit.ts # 限流工具
```

## License

MIT License

## Links

- Website: https://agentrecall.io
- Docs: https://agentrecall.io/docs/
- GitHub: https://github.com/agrecall/agentrecall-mcp

---

<p align="center">Made with ❤️ for the AI community</p>