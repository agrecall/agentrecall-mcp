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

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import nacl from 'tweetnacl';
import { z } from 'zod';
import { pool } from '../db/index.js';
import { checkRateLimit } from '../utils/rate-limit.js';

// ============================================
// 类型定义
// ============================================

interface JWTPayload {
  instanceId: string;
  fingerprint: string;
  iat: number;
  exp: number;
}

// 以下类型定义供外部使用
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

// ============================================
// 验证 Schema
// ============================================

const RegisterRequestSchema = z.object({
  metadata: z.record(z.any()).optional(),
});

const ActivateRequestSchema = z.object({
  otp: z.string().min(10),
  deviceFingerprint: z.string().min(1),
  publicKey: z.string().min(1),
  signature: z.string().min(1),
});

// ============================================
// OTP 生成和验证
// ============================================

/**
 * 生成 OTP
 * 格式：AR_ + Base64URL(随机20字节)
 * 
 * @returns OTP 字符串
 */
export function generateOTP(): string {
  // 生成 20 字节随机数据
  const randomBytes = nacl.randomBytes(20);
  
  // Base64URL 编码
  const base64url = Buffer.from(randomBytes)
    .toString('base64url')
    .replace(/=/g, ''); // 移除填充字符
  
  // 添加前缀
  return `AR_${base64url}`;
}

/**
 * 计算 OTP 的 SHA256 哈希
 * 
 * @param otp - OTP 字符串
 * @returns SHA256 哈希（hex 格式）
 */
export async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp + (process.env.OTP_MASTER_KEY || ''));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 获取 OTP 前缀（用于显示）
 * 
 * @param otp - OTP 字符串
 * @returns 前缀（如 AR_XXX）
 */
function getOTPPrefix(otp: string): string {
  return otp.substring(0, 10) + '...';
}

// ============================================
// Ed25519 签名验证
// ============================================

/**
 * 验证 Ed25519 签名
 * 
 * @param message - 原始消息
 * @param signatureBase64 - Base64 编码的签名
 * @param publicKeyBase64 - Base64 编码的公钥
 * @returns 签名是否有效
 */
export function verifySignature(
  message: string,
  signatureBase64: string,
  publicKeyBase64: string
): boolean {
  try {
    // 解码公钥
    const publicKey = Buffer.from(publicKeyBase64, 'base64');
    
    // 验证公钥长度（Ed25519 公钥为 32 字节）
    if (publicKey.length !== 32) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Invalid public key length',
        expected: 32,
        actual: publicKey.length,
        timestamp: new Date().toISOString(),
      }));
      return false;
    }
    
    // 解码签名
    const signature = Buffer.from(signatureBase64, 'base64');
    
    // 验证签名长度（Ed25519 签名为 64 字节）
    if (signature.length !== 64) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Invalid signature length',
        expected: 64,
        actual: signature.length,
        timestamp: new Date().toISOString(),
      }));
      return false;
    }
    
    // 编码消息
    const messageBytes = Buffer.from(message, 'utf-8');
    
    // 验证签名
    return nacl.sign.detached.verify(messageBytes, signature, publicKey);
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Signature verification failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }));
    return false;
  }
}

/**
 * 生成 Ed25519 密钥对（用于测试）
 * 
 * @returns 公钥和私钥（Base64 编码）
 */
export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const keyPair = nacl.sign.keyPair();
  return {
    publicKey: Buffer.from(keyPair.publicKey).toString('base64'),
    privateKey: Buffer.from(keyPair.secretKey).toString('base64'),
  };
}

/**
 * 使用私钥签名消息（用于测试）
 * 
 * @param message - 消息
 * @param privateKeyBase64 - Base64 编码的私钥
 * @returns Base64 编码的签名
 */
export function signMessage(message: string, privateKeyBase64: string): string {
  const privateKey = Buffer.from(privateKeyBase64, 'base64');
  const messageBytes = Buffer.from(message, 'utf-8');
  const signature = nacl.sign.detached(messageBytes, privateKey);
  return Buffer.from(signature).toString('base64');
}

// ============================================
// JWT 生成和验证
// ============================================

/**
 * 生成 JWT
 * 
 * @param instanceId - 实例ID
 * @param fingerprint - 设备指纹
 * @returns JWT 字符串
 */
export function generateJWT(instanceId: string, fingerprint: string): string {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  
  const expiresInSeconds = 30 * 24 * 60 * 60; // 30天（以秒为单位）
  
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    instanceId,
    fingerprint,
  };
  
  return jwt.sign(payload, secret, { expiresIn: expiresInSeconds });
}

/**
 * 验证 JWT
 * 
 * @param token - JWT 字符串
 * @returns 解码后的 payload 或 null
 */
export function verifyJWT(token: string): JWTPayload | null {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  
  try {
    return jwt.verify(token, secret) as JWTPayload;
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'JWT verification failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }));
    return null;
  }
}

/**
 * JWT 认证中间件
 */
export function authenticateJWT(req: Request, res: Response, next: Function): void {
  const authHeader = req.headers.authorization;
  const fingerprint = req.headers['x-device-fingerprint'] as string;
  
  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: 'Authorization header is required',
    });
    return;
  }
  
  const token = authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Token is required',
    });
    return;
  }
  
  const payload = verifyJWT(token);
  
  if (!payload) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
    return;
  }
  
  // 验证 fingerprint 绑定
  if (fingerprint && payload.fingerprint !== fingerprint) {
    res.status(403).json({
      success: false,
      error: 'Device fingerprint mismatch',
    });
    return;
  }
  
  // 将用户信息附加到请求对象
  (req as any).user = payload;
  
  next();
}

// ============================================
// 路由处理器
// ============================================

const router = Router();

/**
 * POST /api/v1/auth/register
 * 生成 OTP（24小时有效）
 */
router.post('/register', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // 1. 限流检查（5次/小时/IP）
    const clientIP = req.ip || 'unknown';
    const rateLimitResult = await checkRateLimit(clientIP, 'register', 5, 3600);
    
    if (!rateLimitResult.allowed) {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter,
      });
      return;
    }
    
    // 2. 验证请求体
    const parseResult = RegisterRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.errors,
      });
      return;
    }
    
    // 3. 生成 OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const otpPrefix = getOTPPrefix(otp);
    
    // 4. 设置过期时间（24小时）
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // 5. 存储到数据库
    await pool.query(
      `INSERT INTO activation_keys (otp_hash, otp_prefix, status, expires_at)
       VALUES ($1, $2, 'pending', $3)`,
      [otpHash, otpPrefix, expiresAt]
    );
    
    // 6. 记录日志
    console.log(JSON.stringify({
      level: 'info',
      message: 'OTP generated',
      otpPrefix,
      expiresAt: expiresAt.toISOString(),
      ip: clientIP,
      processingTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString(),
    }));
    
    // 7. 返回 OTP（注意：OTP 只在此返回一次）
    res.json({
      success: true,
      otp,
      expiresAt: expiresAt.toISOString(),
      processingTime: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Register failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }));
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/v1/auth/activate
 * Ed25519 验证 + JWT 颁发（30天）
 */
router.post('/activate', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // 1. 限流检查（5次/小时/IP）
    const clientIP = req.ip || 'unknown';
    const rateLimitResult = await checkRateLimit(clientIP, 'activate', 5, 3600);
    
    if (!rateLimitResult.allowed) {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter,
      });
      return;
    }
    
    // 2. 验证请求体
    const parseResult = ActivateRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.errors,
      });
      return;
    }
    
    const { otp, deviceFingerprint, publicKey, signature } = parseResult.data;
    
    // 3. 验证 OTP
    const otpHash = await hashOTP(otp);
    
    const otpResult = await pool.query(
      `SELECT * FROM activation_keys 
       WHERE otp_hash = $1 AND status = 'pending' AND expires_at > NOW()`,
      [otpHash]
    );
    
    if (otpResult.rows.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid or expired OTP',
      });
      return;
    }
    
    const otpRecord = otpResult.rows[0];
    
    // 4. 验证签名
    const isValidSignature = verifySignature(otp, signature, publicKey);
    
    if (!isValidSignature) {
      res.status(400).json({
        success: false,
        error: 'Invalid signature',
      });
      return;
    }
    
    // 5. 检查设备指纹是否已存在
    const existingInstance = await pool.query(
      'SELECT id, is_active FROM instances WHERE device_fingerprint = $1',
      [deviceFingerprint]
    );
    
    let instanceId: string;
    let isNewInstance = false;
    
    if (existingInstance.rows.length > 0) {
      // 更新现有实例
      instanceId = existingInstance.rows[0].id;
      await pool.query(
        `UPDATE instances 
         SET public_key = $1, is_active = TRUE, activated_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [publicKey, instanceId]
      );
    } else {
      // 创建新实例
      const newInstance = await pool.query(
        `INSERT INTO instances (device_fingerprint, public_key, is_active, activated_at)
         VALUES ($1, $2, TRUE, NOW())
         RETURNING id`,
        [deviceFingerprint, publicKey]
      );
      instanceId = newInstance.rows[0].id;
      isNewInstance = true;
    }
    
    // 6. 更新 OTP 状态
    await pool.query(
      `UPDATE activation_keys 
       SET status = 'activated', instance_id = $1, activated_at = NOW()
       WHERE id = $2`,
      [instanceId, otpRecord.id]
    );
    
    // 7. 生成 JWT
    const accessToken = generateJWT(instanceId, deviceFingerprint);
    
    // 8. 记录日志
    console.log(JSON.stringify({
      level: 'info',
      message: 'Instance activated',
      instanceId,
      isNewInstance,
      ip: clientIP,
      processingTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString(),
    }));
    
    // 9. 返回结果
    res.json({
      success: true,
      instanceId,
      accessToken,
      expiresIn: '30d',
      isNewInstance,
      processingTime: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Activation failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }));
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/v1/auth/refresh
 * 刷新 JWT
 */
router.post('/refresh', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTPayload;
    
    // 生成新的 JWT
    const accessToken = generateJWT(user.instanceId, user.fingerprint);
    
    res.json({
      success: true,
      accessToken,
      expiresIn: '30d',
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Token refresh failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }));
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/v1/auth/me
 * 获取当前实例信息
 */
router.get('/me', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTPayload;
    
    const instanceResult = await pool.query(
      `SELECT 
        id,
        device_fingerprint,
        name,
        description,
        is_active,
        activated_at,
        last_seen_at,
        metadata,
        created_at
       FROM instances
       WHERE id = $1`,
      [user.instanceId]
    );
    
    if (instanceResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
      return;
    }
    
    const instance = instanceResult.rows[0];
    
    // 更新最后活跃时间
    await pool.query(
      'UPDATE instances SET last_seen_at = NOW() WHERE id = $1',
      [user.instanceId]
    );
    
    res.json({
      success: true,
      instance: {
        id: instance.id,
        deviceFingerprint: instance.device_fingerprint,
        name: instance.name,
        description: instance.description,
        isActive: instance.is_active,
        activatedAt: instance.activated_at,
        lastSeenAt: instance.last_seen_at,
        metadata: instance.metadata,
        createdAt: instance.created_at,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Get instance info failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }));
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export { router as authRouter };
