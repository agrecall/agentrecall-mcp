/**
 * AgentRecall MCP Server - Database Module
 *
 * PostgreSQL 连接池配置和向量查询函数
 * 使用 pgvector 扩展支持向量相似度搜索
 */
export declare const pool: import("pg").Pool;
/**
 * 搜索相似的避坑指南
 *
 * @param queryEmbedding - 查询向量（1024维）
 * @param similarityThreshold - 相似度阈值（0-1）
 * @param maxResults - 最大返回结果数
 * @returns 相似的避坑指南列表
 */
export declare function searchSimilarPitfalls(queryEmbedding: number[], similarityThreshold?: number, maxResults?: number): Promise<Array<{
    id: string;
    pattern: string;
    workaround: string;
    taxonomy: Record<string, any>;
    similarity: number;
    submission_count: number;
    last_seen_at: Date;
}>>;
/**
 * 插入或更新避坑指南（去重逻辑）
 *
 * @param pattern - 错误模式描述
 * @param workaround - 解决方案
 * @param embedding - 向量嵌入
 * @param taxonomy - 分类标签
 * @param contextFingerprint - 上下文指纹
 * @param errorSignature - 错误签名
 * @param instanceId - 提交实例ID
 * @returns 包含 id 和 isNew 的对象
 */
export declare function upsertPitfall(pattern: string, workaround: string, embedding: number[], taxonomy?: Record<string, any>, contextFingerprint?: string, errorSignature?: string, instanceId?: string): Promise<{
    id: string;
    isNew: boolean;
}>;
/**
 * 获取避坑指南详情
 *
 * @param id - 避坑指南ID
 * @returns 避坑指南详情
 */
export declare function getPitfallById(id: string): Promise<any | null>;
/**
 * 获取社区统计信息
 *
 * @returns 社区统计数据
 */
export declare function getCommunityStats(): Promise<{
    totalPitfalls: number;
    totalInstances: number;
    activeInstances: number;
    totalSubmissions: number;
    todaySubmissions: number;
    uniqueErrorPatterns: number;
}>;
/**
 * 获取实例信息
 *
 * @param deviceFingerprint - 设备指纹
 * @returns 实例信息
 */
export declare function getInstanceByFingerprint(deviceFingerprint: string): Promise<any | null>;
/**
 * 更新实例最后活跃时间
 *
 * @param instanceId - 实例ID
 */
export declare function updateInstanceLastSeen(instanceId: string): Promise<void>;
/**
 * 创建 OTP
 *
 * @param otpHash - OTP 的 SHA256 哈希
 * @param otpPrefix - OTP 前缀（用于显示）
 * @param expiresAt - 过期时间
 * @returns 创建的 OTP ID
 */
export declare function createOTP(otpHash: string, otpPrefix: string, expiresAt: Date): Promise<string>;
/**
 * 验证 OTP
 *
 * @param otpHash - OTP 的 SHA256 哈希
 * @returns OTP 记录或 null
 */
export declare function verifyOTP(otpHash: string): Promise<any | null>;
/**
 * 激活 OTP
 *
 * @param otpId - OTP ID
 * @param instanceId - 实例ID
 */
export declare function activateOTP(otpId: string, instanceId: string): Promise<void>;
/**
 * 创建实例
 *
 * @param deviceFingerprint - 设备指纹
 * @param publicKey - Ed25519 公钥
 * @returns 创建的实例ID
 */
export declare function createInstance(deviceFingerprint: string, publicKey: string): Promise<string>;
/**
 * 获取最近的避坑指南
 *
 * @param limit - 返回数量限制
 * @returns 避坑指南列表
 */
export declare function getRecentPitfalls(limit?: number): Promise<any[]>;
/**
 * 搜索避坑指南（文本搜索）
 *
 * @param query - 搜索关键词
 * @param limit - 返回数量限制
 * @returns 避坑指南列表
 */
export declare function searchPitfallsByText(query: string, limit?: number): Promise<any[]>;
//# sourceMappingURL=index.d.ts.map