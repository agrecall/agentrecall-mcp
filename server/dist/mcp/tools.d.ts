/**
 * AgentRecall MCP Server - Tool Definitions and Handlers
 *
 * 定义 4 个核心 MCP Tool：
 * 1. submit_pitfall - 提交避坑指南
 * 2. query_pitfall - 查询相似错误
 * 3. verify_health - 健康检查
  */
import { z } from 'zod';
export type ToolName = 'submit_pitfall' | 'query_pitfall' | 'verify_health';
interface ToolDefinition {
    name: ToolName;
    description: string;
    inputSchema: z.ZodTypeAny;
}
export declare const tools: ToolDefinition[];
/**
 * 计算 OTP 的 SHA256 哈希
 */
export declare const toolHandlers: Record<ToolName, (input: any) => Promise<any>>;
export {};
//# sourceMappingURL=tools.d.ts.map