/**
 * AgentRecall MCP Server - Main Entry Point
 *
 * 核心功能：
 * - Express 应用创建和配置
 * - Helmet 安全头
 * - CORS 配置（允许 OpenClaw 插件来源）
 * - JSON-RPC 2.0 请求体解析
 * - 路由挂载：/mcp (MCP 端点), /api/v1 (REST API), /health (健康检查)
 * - Graceful shutdown 处理
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { createMCPRouter } from './mcp/server.js';
import { authRouter } from './api/auth.js';
import { pitfallsRouter } from './api/pitfalls.js';
import { usersRouter } from './api/users.js';
import { apiKeysRouter } from './api/apikeys.js';
import { statsRouter } from './api/stats.js';
import { pool } from './db/index.js';
// 加载环境变量
dotenv.config();
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
// ============================================
// 安全中间件
// ============================================
// Helmet 安全头
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));
// CORS 配置（允许 OpenClaw 插件来源）
app.use(cors({
    origin: '*', // 生产环境应限制为特定域名
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Fingerprint', 'X-Request-ID'],
    credentials: true,
}));
// JSON 解析中间件
app.use(express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
        req.rawBody = buf;
    }
}));
// 请求日志中间件
app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-ID', requestId);
    const startTime = Date.now();
    console.log(JSON.stringify({
        level: 'info',
        message: 'Request started',
        requestId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        timestamp: new Date().toISOString(),
    }));
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        console.log(JSON.stringify({
            level: 'info',
            message: 'Request completed',
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
        }));
    });
    next();
});
// ============================================
// 路由挂载
// ============================================
// 健康检查（用于 Docker Compose depends_on）
app.get('/health', async (_req, res) => {
    try {
        // 检查数据库连接
        const dbStart = Date.now();
        await pool.query('SELECT 1');
        const dbLatency = Date.now() - dbStart;
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            services: {
                database: { status: 'ok', latency: `${dbLatency}ms` },
                server: { status: 'ok', uptime: process.uptime() },
            }
        });
    }
    catch (err) {
        console.error(JSON.stringify({
            level: 'error',
            message: 'Health check failed',
            error: err instanceof Error ? err.message : String(err),
            timestamp: new Date().toISOString(),
        }));
        res.status(503).json({
            status: 'error',
            message: 'Database unavailable',
            timestamp: new Date().toISOString(),
        });
    }
});
// MCP 端点 (SSE 和 POST)
app.use('/mcp', createMCPRouter());
// REST API
app.use('/api/v1/auth', authRouter);
// app.use('/api/v1/pitfalls', pitfallsRouter); // 已禁用，仅通过 MCP 提供
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/apikeys', apiKeysRouter);
app.use('/api/v1/stats', statsRouter);
// 根路径
app.get('/', (_req, res) => {
    res.json({
        name: 'AgentRecall MCP Server',
        version: '1.0.0',
        description: 'AI-to-AI Distributed Failure Knowledge Network',
        endpoints: {
            mcp: '/mcp',
            health: '/health',
            api: '/api/v1',
        },
        documentation: 'https://github.com/agentrecall/docs',
    });
});
// ============================================
// 错误处理
// ============================================
// 404 处理
app.use((req, res) => {
    res.status(404).json({
        jsonrpc: '2.0',
        error: {
            code: -32601,
            message: 'Method not found',
            data: { path: req.path, method: req.method }
        },
        id: null,
    });
});
// 全局错误处理
app.use((err, req, res, _next) => {
    console.error(JSON.stringify({
        level: 'error',
        message: 'Unhandled error',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        requestId: res.getHeader('X-Request-ID'),
        timestamp: new Date().toISOString(),
    }));
    // 根据请求路径返回不同格式的错误
    if (req.path.startsWith('/mcp') || req.path.startsWith('/api/')) {
        res.status(500).json({
            jsonrpc: '2.0',
            error: {
                code: -32603,
                message: 'Internal error',
                data: process.env.NODE_ENV === 'development' ? { error: err.message } : undefined
            },
            id: req.body?.id || null,
        });
    }
    else {
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            requestId: res.getHeader('X-Request-ID'),
        });
    }
});
// ============================================
// 启动服务器
// ============================================
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(JSON.stringify({
        level: 'info',
        message: `[AgentRecall] MCP Server running on port ${PORT}`,
        port: PORT,
        nodeVersion: process.version,
        platform: process.platform,
        timestamp: new Date().toISOString(),
    }));
});
// ============================================
// Graceful Shutdown
// ============================================
const gracefulShutdown = async (signal) => {
    console.log(JSON.stringify({
        level: 'info',
        message: `[Shutdown] ${signal} received, starting graceful shutdown...`,
        timestamp: new Date().toISOString(),
    }));
    // 停止接受新连接
    server.close(async () => {
        console.log(JSON.stringify({
            level: 'info',
            message: '[Shutdown] HTTP server closed',
            timestamp: new Date().toISOString(),
        }));
        try {
            // 关闭数据库连接池
            await pool.end();
            console.log(JSON.stringify({
                level: 'info',
                message: '[Shutdown] Database connections closed',
                timestamp: new Date().toISOString(),
            }));
            console.log(JSON.stringify({
                level: 'info',
                message: '[Shutdown] Graceful shutdown completed',
                timestamp: new Date().toISOString(),
            }));
            process.exit(0);
        }
        catch (err) {
            console.error(JSON.stringify({
                level: 'error',
                message: '[Shutdown] Error during shutdown',
                error: err instanceof Error ? err.message : String(err),
                timestamp: new Date().toISOString(),
            }));
            process.exit(1);
        }
    });
    // 强制关闭超时
    setTimeout(() => {
        console.error(JSON.stringify({
            level: 'error',
            message: '[Shutdown] Forced shutdown due to timeout',
            timestamp: new Date().toISOString(),
        }));
        process.exit(1);
    }, 30000); // 30 秒超时
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// 未捕获的异常处理
process.on('uncaughtException', (err) => {
    console.error(JSON.stringify({
        level: 'fatal',
        message: 'Uncaught exception',
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
    }));
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error(JSON.stringify({
        level: 'error',
        message: 'Unhandled rejection',
        reason: String(reason),
        timestamp: new Date().toISOString(),
    }));
});
//# sourceMappingURL=index.js.map