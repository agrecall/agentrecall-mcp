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
import { Router, Response } from 'express';
interface SSEClient {
    id: string;
    res: Response;
    initialized: boolean;
}
declare const sseClients: Map<string, SSEClient>;
/**
 * 发送 SSE 事件
 */
declare function sendSSEEvent(clientId: string, event: string, data: any): void;
/**
 * 广播 SSE 事件到所有客户端
 */
declare function broadcastSSEEvent(event: string, data: any): void;
/**
 * 创建 MCP Router
 */
export declare function createMCPRouter(): Router;
export { broadcastSSEEvent, sendSSEEvent, sseClients };
//# sourceMappingURL=server.d.ts.map