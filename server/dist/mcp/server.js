/**
 * AgentRecall MCP Server - MCP Protocol Implementation
 *
 * 实现 MCP (Model Context Protocol) 2024-11-05 版本
 * 支持 JSON-RPC 2.0 通信协议
 *
 * 功能：
 * - Initialize 握手
 * - Tools/List 工具列表
 * - Tools/Call 工具调用
 * - SSE (Server-Sent Events) 支持
 */
import { Router } from 'express';
import { z } from 'zod';
import { tools, toolHandlers } from './tools.js';
import { verifyApiKey, logApiKeyUsage } from '../api/apikeys.js';
// MCP 协议版本
const MCP_PROTOCOL_VERSION = '2024-11-05';
// JSON-RPC 2.0 错误码
const JSONRPC_ERROR_CODES = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
};
// JSON-RPC 请求验证 Schema
const JSONRPCRequestSchema = z.object({
    jsonrpc: z.literal('2.0'),
    id: z.union([z.string(), z.number(), z.null()]).optional(),
    method: z.string(),
    params: z.record(z.any()).optional(),
});
// Initialize 请求参数 Schema
const InitializeParamsSchema = z.object({
    protocolVersion: z.string(),
    capabilities: z.object({
        tools: z.object({}).optional(),
        resources: z.object({}).optional(),
        prompts: z.object({}).optional(),
    }).optional(),
    clientInfo: z.object({
        name: z.string(),
        version: z.string(),
    }),
});
const sseClients = new Map();
/**
 * 创建 JSON-RPC 成功响应
 */
function createSuccessResponse(id, result) {
    return {
        jsonrpc: '2.0',
        id,
        result,
    };
}
/**
 * 创建 JSON-RPC 错误响应
 */
function createErrorResponse(id, code, message, data) {
    return {
        jsonrpc: '2.0',
        id,
        error: {
            code,
            message,
            data,
        },
    };
}
/**
 * 发送 SSE 事件
 */
function sendSSEEvent(clientId, event, data) {
    const client = sseClients.get(clientId);
    if (client && !client.res.writableEnded) {
        client.res.write(`event: ${event}\n`);
        client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
}
/**
 * 广播 SSE 事件到所有客户端
 */
function broadcastSSEEvent(event, data) {
    sseClients.forEach((client) => {
        if (!client.res.writableEnded) {
            client.res.write(`event: ${event}\n`);
            client.res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    });
}
/**
 * 处理 Initialize 请求
 */
async function handleInitialize(params, clientId) {
    const parseResult = InitializeParamsSchema.safeParse(params);
    if (!parseResult.success) {
        return createErrorResponse(null, JSONRPC_ERROR_CODES.INVALID_PARAMS, 'Invalid initialize params', parseResult.error.errors);
    }
    const { protocolVersion, clientInfo } = parseResult.data;
    console.log(JSON.stringify({
        level: 'info',
        message: 'MCP client initializing',
        clientName: clientInfo.name,
        clientVersion: clientInfo.version,
        protocolVersion,
        timestamp: new Date().toISOString(),
    }));
    // 标记客户端为已初始化
    if (clientId) {
        const client = sseClients.get(clientId);
        if (client) {
            client.initialized = true;
        }
    }
    // 返回服务器能力
    return createSuccessResponse(null, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
            tools: {
                listChanged: true,
            },
            resources: {
                subscribe: false,
                listChanged: false,
            },
            prompts: {
                listChanged: false,
            },
            logging: {},
        },
        serverInfo: {
            name: 'AgentRecall MCP Server',
            version: '1.0.0',
        },
    });
}
/**
 * 处理 Tools/List 请求
 */
async function handleToolsList() {
    return createSuccessResponse(null, {
        tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
        })),
    });
}
/**
 * 处理 Tools/Call 请求
 */
async function handleToolsCall(params, apiKeyInfo) {
    const { name, arguments: args } = params;
    if (!name || typeof name !== 'string') {
        return createErrorResponse(null, JSONRPC_ERROR_CODES.INVALID_PARAMS, 'Tool name is required');
    }
    // 检查工具是否存在
    const tool = tools.find(t => t.name === name);
    if (!tool) {
        return createErrorResponse(null, JSONRPC_ERROR_CODES.METHOD_NOT_FOUND, `Tool not found: ${name}`);
    }
    // 获取工具处理器
    const handler = toolHandlers[name];
    if (!handler) {
        return createErrorResponse(null, JSONRPC_ERROR_CODES.INTERNAL_ERROR, `Tool handler not implemented: ${name}`);
    }
    try {
        // 验证输入参数
        const parseResult = tool.inputSchema.safeParse(args || {});
        if (!parseResult.success) {
            return createErrorResponse(null, JSONRPC_ERROR_CODES.INVALID_PARAMS, 'Invalid tool arguments', parseResult.error.errors);
        }
        // 如果没有 instanceId 但有 API Key 认证，使用 API Key 的 instance_id
        if (apiKeyInfo && apiKeyInfo.instance_id && !parseResult.data.instanceId) {
            parseResult.data.instanceId = apiKeyInfo.instance_id;
        }
        // 执行工具
        const result = await handler(parseResult.data);
        return createSuccessResponse(null, {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result),
                },
            ],
            isError: false,
        });
    }
    catch (error) {
        console.error(JSON.stringify({
            level: 'error',
            message: 'Tool execution failed',
            tool: name,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
        }));
        return createSuccessResponse(null, {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        error: error instanceof Error ? error.message : 'Tool execution failed',
                    }),
                },
            ],
            isError: true,
        });
    }
}
/**
 * 处理 JSON-RPC 请求
 */
async function handleJSONRPCRequest(request, clientId) {
    // 验证 JSON-RPC 格式
    const parseResult = JSONRPCRequestSchema.safeParse(request);
    if (!parseResult.success) {
        return createErrorResponse(request?.id || null, JSONRPC_ERROR_CODES.INVALID_REQUEST, 'Invalid JSON-RPC request', parseResult.error.errors);
    }
    const { id, method, params } = parseResult.data;
    const apiKeyInfo = parseResult.data._apiKey; // 从请求中获取 API Key 信息
    // 路由到对应的处理器
    switch (method) {
        case 'initialize':
            return handleInitialize(params, clientId);
        case 'initialized':
            // 客户端通知服务器初始化完成
            return createSuccessResponse(id, {});
        case 'tools/list':
            return handleToolsList();
        case 'tools/call':
            return handleToolsCall(params, apiKeyInfo);
        case 'ping':
            return createSuccessResponse(id, {});
        default:
            return createErrorResponse(id, JSONRPC_ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
}
/**
 * 创建 MCP Router
 */
export function createMCPRouter() {
    const router = Router();
    // ============================================
    // SSE 端点（用于实时推送）
    // ============================================
    router.get('/', (req, res) => {
        // 设置 SSE 头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲
        const clientId = crypto.randomUUID();
        // 注册客户端
        sseClients.set(clientId, {
            id: clientId,
            res,
            initialized: false,
        });
        console.log(JSON.stringify({
            level: 'info',
            message: 'SSE client connected',
            clientId,
            totalClients: sseClients.size,
            timestamp: new Date().toISOString(),
        }));
        // 发送初始事件
        res.write(`event: connected\n`);
        res.write(`data: ${JSON.stringify({ clientId })}\n\n`);
        // 发送 endpoint 信息（MCP 规范要求）
        res.write(`event: endpoint\n`);
        res.write(`data: ${JSON.stringify({
            endpoint: `/mcp?clientId=${clientId}`,
            protocolVersion: MCP_PROTOCOL_VERSION,
        })}\n\n`);
        // 保持连接
        const keepAlive = setInterval(() => {
            if (res.writableEnded) {
                clearInterval(keepAlive);
                return;
            }
            res.write(`: keepalive\n\n`);
        }, 30000); // 每 30 秒发送一次保活
        // 清理
        req.on('close', () => {
            clearInterval(keepAlive);
            sseClients.delete(clientId);
            console.log(JSON.stringify({
                level: 'info',
                message: 'SSE client disconnected',
                clientId,
                totalClients: sseClients.size,
                timestamp: new Date().toISOString(),
            }));
        });
        req.on('error', (err) => {
            clearInterval(keepAlive);
            sseClients.delete(clientId);
            console.error(JSON.stringify({
                level: 'error',
                message: 'SSE client error',
                clientId,
                error: err.message,
                timestamp: new Date().toISOString(),
            }));
        });
    });
    // ============================================
    // POST 端点（用于 STDIO 模式和 SSE 消息）
    // ============================================
    router.post('/', async (req, res) => {
        const startTime = Date.now();
        try {
            // API Key 验证
            const apiKey = req.headers['x-api-key'];
            if (apiKey) {
                const apiKeyResult = await verifyApiKey(apiKey);
                if (apiKeyResult) {
                    req.apiKey = apiKeyResult;
                }
            }
            const body = req.body;
            // 支持批量请求
            if (Array.isArray(body)) {
                // 将 API Key 信息附加到每个请求
                const apiKeyInfo = req.apiKey;
                const requestsWithApiKey = body.map((request) => {
                    if (apiKeyInfo) {
                        request._apiKey = apiKeyInfo;
                    }
                    return handleJSONRPCRequest(request);
                });
                const responses = await Promise.all(requestsWithApiKey);
                // 记录 API Key 使用
                if (req.apiKey && body && body.length > 0) {
                    const method = body[0]?.method || 'batch';
                    await logApiKeyUsage(req.apiKey.id, req.apiKey.user_id, method, 'POST', 200, Date.now() - startTime);
                }
                return res.json(responses);
            }
            // 将 API Key 信息附加到请求 body
            if (req.apiKey) {
                body._apiKey = req.apiKey;
            }
            // 单请求
            const response = await handleJSONRPCRequest(body);
            // 记录 API Key 使用
            if (req.apiKey && body && body.method) {
                await logApiKeyUsage(req.apiKey.id, req.apiKey.user_id, body.method, 'POST', 200, Date.now() - startTime);
            }
            return res.json(response);
        }
        catch (error) {
            console.error(JSON.stringify({
                level: 'error',
                message: 'MCP request handling failed',
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
            }));
            return res.status(500).json({
                jsonrpc: '2.0',
                id: req.body?.id || null,
                error: {
                    code: JSONRPC_ERROR_CODES.INTERNAL_ERROR,
                    message: 'Internal server error',
                },
            });
        }
    });
    // ============================================
    // 带 clientId 的 POST 端点（用于 SSE 模式的消息回复）
    // ============================================
    router.post('/:clientId', async (req, res) => {
        const { clientId } = req.params;
        const startTime = Date.now();
        try {
            // API Key 验证
            const apiKey = req.headers['x-api-key'];
            if (apiKey) {
                const apiKeyResult = await verifyApiKey(apiKey);
                if (apiKeyResult) {
                    req.apiKey = apiKeyResult;
                }
            }
            const body = req.body;
            // 支持批量请求
            if (Array.isArray(body)) {
                const responses = await Promise.all(body.map(request => handleJSONRPCRequest(request, clientId)));
                // 记录 API Key 使用
                if (req.apiKey && body && body.length > 0) {
                    const method = body[0]?.method || 'batch';
                    await logApiKeyUsage(req.apiKey.id, req.apiKey.user_id, method, 'POST', 200, Date.now() - startTime);
                }
                return res.json(responses);
            }
            // 单请求
            const response = await handleJSONRPCRequest(body, clientId);
            // 记录 API Key 使用
            if (req.apiKey && body && body.method) {
                await logApiKeyUsage(req.apiKey.id, req.apiKey.user_id, body.method, 'POST', 200, Date.now() - startTime);
            }
            return res.json(response);
        }
        catch (error) {
            console.error(JSON.stringify({
                level: 'error',
                message: 'MCP request handling failed',
                clientId,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
            }));
            return res.status(500).json({
                jsonrpc: '2.0',
                id: req.body?.id || null,
                error: {
                    code: JSONRPC_ERROR_CODES.INTERNAL_ERROR,
                    message: 'Internal server error',
                },
            });
        }
    });
    return router;
}
// 导出 SSE 广播函数供其他模块使用
export { broadcastSSEEvent, sendSSEEvent, sseClients };
//# sourceMappingURL=server.js.map