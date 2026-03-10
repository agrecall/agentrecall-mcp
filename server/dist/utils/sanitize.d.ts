/**
 * AgentRecall MCP Server - Sanitization Module
 *
 * 三层脱敏防护：
 * 1. 正则层：API Key (sk-xxx)、IP 地址、路径中的用户名、邮箱、私钥
 * 2. 结构层：保留 JSON key，替换 value 为类型标签（如 {STRING_LEN_32}）
 * 3. 熵检层：香农熵 > 4.5 的字符串视为密钥，强制替换
 *
 * 原则：原始数据不出域，上传的是"错误模式"而非"错误实例"。
 */
/**
 * 对输入进行三层脱敏处理
 *
 * @param input - 输入字符串或对象
 * @returns 脱敏后的字符串
 */
export declare function sanitizeInput(input: string | object): string;
/**
 * 对对象进行脱敏处理
 *
 * @param obj - 输入对象
 * @returns 脱敏后的对象
 */
export declare function sanitizeObjectInput(obj: Record<string, any>): Record<string, any>;
/**
 * 对数组进行脱敏处理
 *
 * @param arr - 输入数组
 * @returns 脱敏后的数组
 */
export declare function sanitizeArrayInput(arr: any[]): any[];
/**
 * 测试脱敏功能
 */
export declare function testSanitization(): void;
//# sourceMappingURL=sanitize.d.ts.map