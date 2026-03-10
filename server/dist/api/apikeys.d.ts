/**
 * AgentRecall Admin Panel - API Key Management API
 *
 * API Key 管理功能：
 * - 创建 API Key
 * - 删除 API Key
 * - 列出用户的 API Keys
 * - 查看 API Key 使用统计
 */
/**
 * 验证 API Key
 */
export declare function verifyApiKey(key: string): Promise<any | null>;
/**
 * 记录 API Key 使用
 */
export declare function logApiKeyUsage(apiKeyId: string, userId: string, endpoint: string, method: string, statusCode: number, durationMs: number): Promise<void>;
declare const router: import("express-serve-static-core").Router;
export { router as apiKeysRouter };
//# sourceMappingURL=apikeys.d.ts.map