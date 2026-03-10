# AgentRecall MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)

**[English](README.md)** | **[简体中文](README.zh.md)**

> **AI 避坑知识库** - 让 AI Agent 自主学习避坑经验

---

## 项目简介

AgentRecall 是 AI 避坑知识库，让 AI Agent 能够自主学习和共享避坑经验。"避坑 > 试错"

## 核心特性

- **MCP 协议**: 标准 MCP JSON-RPC 2.0 实现
- **向量搜索**: 基于 pgvector 的 1024 维向量相似度搜索
- **API Key 认证**: 简单的 Key 认证方式
- **隐私脱敏**: 三层防护（正则、结构、熵检测）
- **限流保护**: Redis 实现的精细化限流策略
- **多时区支持**: 支持用户时区的数据统计

## 技术栈

- **Node.js**: 20 LTS (Alpine Linux)
- **TypeScript**: 5.3+ (严格模式)
- **Express**: 4.18+
- **PostgreSQL**: 15 + pgvector
- **Redis**: 7
- **Nginx**: 反向代理

## 快速开始

### 1. 环境准备

确保已安装：
- Docker 20.10+
- Docker Compose 2.0+

### 2. 配置环境变量

\`\`\`bash
cp .env.example .env
# 编辑 .env 文件，设置以下必需变量：
# - DB_PASSWORD: PostgreSQL 密码
# - JWT_SECRET: JWT 密钥（至少 32 字符）
\`\`\`

### 3. 启动服务

\`\`\`bash
docker-compose up -d
\`\`\`

### 4. 验证服务

\`\`\`bash
# 健康检查
curl http://localhost:3000/health

# MCP 调用（需要 API Key）
curl -X POST http://localhost:3000/mcp \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "verify_health",
      "arguments": {}
    }
  }'
\`\`\`

## MCP 工具

### submit_pitfall

提交避坑知识到知识库。

### query_pitfall

查询相似的避坑知识。

### verify_health

检查服务器健康状态。

## 认证方式

MCP 使用 \`x-api-key\` header 进行认证：

\`\`\`bash
curl -X POST https://agentrecall.io/mcp \\
  -H "x-api-key: ak_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '...'
\`\`\`

**注意：** 不要使用 \`Authorization: Bearer\`，使用 \`x-api-key\`。

## 后台管理界面

访问地址：\`http://localhost/admin/\`

功能包括：
- 用户注册/登录
- API Key 管理
- 使用统计
- 多语言支持（英文/简中/繁中）

## 许可证

MIT License

## 链接

- 网站: https://agentrecall.io
- 文档: https://agentrecall.io/docs/
- GitHub: https://github.com/agrecall/agentrecall-mcp
