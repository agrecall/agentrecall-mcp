/**
 * AgentRecall MCP Server - Authentication Module
 *
 * 实现完整的认证体系：
 * 1. OTP 生成和验证（AR_ + Base64URL(20字节)）
 * 2. Ed25519 签名验证（tweetnacl 库）
 * 3. JWT 颁发和验证（包含 fingerprint 绑定）
 *
 * 激活流程：
 * 1. Server 生成 OTP → 存储 hash，状态 pending
 * 2. Agent 用私钥对 OTP 签名 → 提交公钥 + 签名
 * 3. Server 验证签名 → OTP 标记 activated → 颁发 JWT
 */
import { Request, Response } from 'express';
interface JWTPayload {
    instanceId: string;
    fingerprint: string;
    iat: number;
    exp: number;
}
export interface OTPResponse {
    otp: string;
    expiresAt: string;
}
export interface ActivationResponse {
    success: boolean;
    instanceId?: string;
    accessToken?: string;
    expiresIn?: string;
    error?: string;
}
/**
 * 生成 OTP
 * 格式：AR_ + Base64URL(随机20字节)
 *
 * @returns OTP 字符串
 */
export declare function generateOTP(): string;
/**
 * 计算 OTP 的 SHA256 哈希
 *
 * @param otp - OTP 字符串
 * @returns SHA256 哈希（hex 格式）
 */
export declare function hashOTP(otp: string): Promise<string>;
/**
 * 验证 Ed25519 签名
 *
 * @param message - 原始消息
 * @param signatureBase64 - Base64 编码的签名
 * @param publicKeyBase64 - Base64 编码的公钥
 * @returns 签名是否有效
 */
export declare function verifySignature(message: string, signatureBase64: string, publicKeyBase64: string): boolean;
/**
 * 生成 Ed25519 密钥对（用于测试）
 *
 * @returns 公钥和私钥（Base64 编码）
 */
export declare function generateKeyPair(): {
    publicKey: string;
    privateKey: string;
};
/**
 * 使用私钥签名消息（用于测试）
 *
 * @param message - 消息
 * @param privateKeyBase64 - Base64 编码的私钥
 * @returns Base64 编码的签名
 */
export declare function signMessage(message: string, privateKeyBase64: string): string;
/**
 * 生成 JWT
 *
 * @param instanceId - 实例ID
 * @param fingerprint - 设备指纹
 * @returns JWT 字符串
 */
export declare function generateJWT(instanceId: string, fingerprint: string): string;
/**
 * 验证 JWT
 *
 * @param token - JWT 字符串
 * @returns 解码后的 payload 或 null
 */
export declare function verifyJWT(token: string): JWTPayload | null;
/**
 * JWT 认证中间件
 */
export declare function authenticateJWT(req: Request, res: Response, next: Function): void;
declare const router: import("express-serve-static-core").Router;
export { router as authRouter };
//# sourceMappingURL=auth.d.ts.map