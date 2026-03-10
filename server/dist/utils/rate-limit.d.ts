/**
 * AgentRecall MCP Server - Rate Limiting Module
 *
 * 使用 Redis 实现限流策略：
 * - 注册/激活：5次/小时/IP（防暴力破解）
 * - 提交知识：10次/小时/实例（防垃圾数据）
 * - 查询：100次/分钟/实例
 *
 * 限流 key：instanceId 或 IP
 */
interface RateLimitResult {
    allowed: boolean;
    currentCount: number;
    limit: number;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
}
/**
 * 检查限流
 *
 * @param identifier - 限流标识（IP 或 instanceId）
 * @param limitType - 限流类型（register, activate, submit, query）
 * @param maxRequests - 最大请求数（可选，覆盖默认配置）
 * @param windowSeconds - 时间窗口（秒）（可选，覆盖默认配置）
 * @returns 限流结果
 */
export declare function checkRateLimit(identifier: string, limitType: string, maxRequests?: number, windowSeconds?: number): Promise<RateLimitResult>;
/**
 * 获取限流状态（不增加计数）
 *
 * @param identifier - 限流标识
 * @param limitType - 限流类型
 * @returns 限流状态
 */
export declare function getRateLimitStatus(identifier: string, limitType: string): Promise<RateLimitResult>;
/**
 * 重置限流计数
 *
 * @param identifier - 限流标识
 * @param limitType - 限流类型
 */
export declare function resetRateLimit(identifier: string, limitType: string): Promise<void>;
/**
 * 创建限流中间件
 *
 * @param limitType - 限流类型
 * @param getIdentifier - 获取限流标识的函数
 * @returns Express 中间件
 */
export declare function createRateLimitMiddleware(limitType: string, getIdentifier: (req: any) => string): (req: any, res: any, next: any) => Promise<void>;
/**
 * IP 限流中间件
 *
 * @param limitType - 限流类型
 * @returns Express 中间件
 */
export declare function ipRateLimit(limitType: string): (req: any, res: any, next: any) => Promise<void>;
/**
 * 实例限流中间件
 *
 * @param limitType - 限流类型
 * @returns Express 中间件
 */
export declare function instanceRateLimit(limitType: string): (req: any, res: any, next: any) => Promise<void>;
/**
 * 关闭 Redis 连接
 */
export declare function closeRedisConnection(): Promise<void>;
/**
 * 测试限流功能
 */
export declare function testRateLimit(): Promise<void>;
export {};
//# sourceMappingURL=rate-limit.d.ts.map