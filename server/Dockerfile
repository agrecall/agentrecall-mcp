# AgentRecall MCP Server Dockerfile
# 多阶段构建以减少镜像体积

# 阶段1：依赖安装
FROM node:20-alpine AS deps
WORKDIR /app

# 安装必要的构建工具
RUN apk add --no-cache python3 make g++ curl

# 复制 package.json
COPY package.json ./

# 安装生产依赖
RUN npm install --only=production && npm cache clean --force

# 阶段2：构建
FROM node:20-alpine AS builder
WORKDIR /app

# 安装构建工具
RUN apk add --no-cache python3 make g++

# 复制所有依赖（包括 devDependencies）
COPY package.json ./
RUN npm install && npm cache clean --force

# 复制源代码
COPY tsconfig.json ./
COPY src ./src

# 构建 TypeScript
RUN npm run build

# 阶段3：生产运行
FROM node:20-alpine AS runner
WORKDIR /app

# 安装 curl 用于健康检查
RUN apk add --no-cache curl

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 设置日志目录权限
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app/logs

# 复制生产依赖
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# 复制构建产物
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# 复制 package.json（用于获取版本信息）
COPY --chown=nodejs:nodejs package.json ./

# 切换到非 root 用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 启动命令
CMD ["node", "dist/index.js"]
