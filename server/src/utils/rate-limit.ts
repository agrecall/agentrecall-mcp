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

import { createClient, RedisClientType } from 'redis';

// ============================================
// Redis 客户端
// ============================================

let redisClient: RedisClientType | null = null;

/**
 * 获取 Redis 客户端（单例模式）
 * 
 * @returns Redis 客户端
 */
async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error(JSON.stringify({
              level: 'error',
              message: 'Redis max reconnection attempts reached',
              timestamp: new Date().toISOString(),
            }));
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });
    
    redisClient.on('error', (err) => {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Redis client error',
        error: err.message,
        timestamp: new Date().toISOString(),
      }));
    });
    
    redisClient.on('connect', () => {
      console.log(JSON.stringify({
        level: 'info',
        message: 'Redis client connected',
        timestamp: new Date().toISOString(),
      }));
    });
    
    redisClient.on('reconnecting', () => {
      console.warn(JSON.stringify({
        level: 'warn',
        message: 'Redis client reconnecting',
        timestamp: new Date().toISOString(),
      }));
    });
    
    await redisClient.connect();
  }
  
  return redisClient;
}

// ============================================
// 限流配置
// ============================================

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

// 限流策略配置
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  register: { maxRequests: 5, windowSeconds: 3600 },    // 5次/小时
  activate: { maxRequests: 5, windowSeconds: 3600 },    // 5次/小时
  submit: { maxRequests: 10, windowSeconds: 3600 },     // 10次/小时
  query: { maxRequests: 100, windowSeconds: 60 },       // 100次/分钟
};

// ============================================
// 限流结果类型
// ============================================

interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// ============================================
// 核心限流函数
// ============================================

/**
 * 检查限流
 * 
 * @param identifier - 限流标识（IP 或 instanceId）
 * @param limitType - 限流类型（register, activate, submit, query）
 * @param maxRequests - 最大请求数（可选，覆盖默认配置）
 * @param windowSeconds - 时间窗口（秒）（可选，覆盖默认配置）
 * @returns 限流结果
 */
export async function checkRateLimit(
  identifier: string,
  limitType: string,
  maxRequests?: number,
  windowSeconds?: number
): Promise<RateLimitResult> {
  try {
    const client = await getRedisClient();
    
    // 获取配置
    const config = RATE_LIMIT_CONFIGS[limitType];
    const limit = maxRequests || config?.maxRequests || 100;
    const window = windowSeconds || config?.windowSeconds || 3600;
    
    // 构建 Redis key
    const key = `ratelimit:${limitType}:${identifier}`;
    
    // 获取当前计数
    const currentCount = await client.get(key);
    const count = currentCount ? parseInt(currentCount, 10) : 0;
    
    // 获取 key 的过期时间
    const ttl = await client.ttl(key);
    const resetTime = ttl > 0 ? Date.now() + ttl * 1000 : Date.now() + window * 1000;
    
    // 检查是否超过限制
    if (count >= limit) {
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
      
      // 记录限流日志
      await logRateLimit(identifier, limitType, count, limit, true);
      
      return {
        allowed: false,
        currentCount: count,
        limit,
        remaining: 0,
        resetTime,
        retryAfter: Math.max(1, retryAfter),
      };
    }
    
    // 增加计数
    const pipeline = client.multi();
    pipeline.incr(key);
    
    // 如果是第一次请求，设置过期时间
    if (count === 0) {
      pipeline.expire(key, window);
    }
    
    await pipeline.exec();
    
    return {
      allowed: true,
      currentCount: count + 1,
      limit,
      remaining: limit - count - 1,
      resetTime,
    };
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Rate limit check failed',
      identifier,
      limitType,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }));
    
    // 如果 Redis 失败，允许请求通过（降级策略）
    return {
      allowed: true,
      currentCount: 0,
      limit: maxRequests || 100,
      remaining: maxRequests || 100,
      resetTime: Date.now() + 3600000,
    };
  }
}

/**
 * 获取限流状态（不增加计数）
 * 
 * @param identifier - 限流标识
 * @param limitType - 限流类型
 * @returns 限流状态
 */
export async function getRateLimitStatus(
  identifier: string,
  limitType: string
): Promise<RateLimitResult> {
  try {
    const client = await getRedisClient();
    
    const config = RATE_LIMIT_CONFIGS[limitType];
    const limit = config?.maxRequests || 100;
    const window = config?.windowSeconds || 3600;
    
    const key = `ratelimit:${limitType}:${identifier}`;
    
    const currentCount = await client.get(key);
    const count = currentCount ? parseInt(currentCount, 10) : 0;
    
    const ttl = await client.ttl(key);
    const resetTime = ttl > 0 ? Date.now() + ttl * 1000 : Date.now() + window * 1000;
    
    return {
      allowed: count < limit,
      currentCount: count,
      limit,
      remaining: Math.max(0, limit - count),
      resetTime,
    };
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Get rate limit status failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }));
    
    return {
      allowed: true,
      currentCount: 0,
      limit: 100,
      remaining: 100,
      resetTime: Date.now() + 3600000,
    };
  }
}

/**
 * 重置限流计数
 * 
 * @param identifier - 限流标识
 * @param limitType - 限流类型
 */
export async function resetRateLimit(
  identifier: string,
  limitType: string
): Promise<void> {
  try {
    const client = await getRedisClient();
    const key = `ratelimit:${limitType}:${identifier}`;
    await client.del(key);
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Reset rate limit failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }));
  }
}

/**
 * 记录限流日志到数据库
 * 
 * @param identifier - 限流标识
 * @param limitType - 限流类型
 * @param currentCount - 当前计数
 * @param limit - 限制数
 * @param isBlocked - 是否被阻止
 */
async function logRateLimit(
  identifier: string,
  limitType: string,
  currentCount: number,
  limit: number,
  isBlocked: boolean
): Promise<void> {
  try {
    const { pool } = await import('../db/index.js');
    
    await pool.query(
      `INSERT INTO rate_limit_logs (identifier, limit_type, current_count, limit_count, window_start, is_blocked)
       VALUES ($1, $2, $3, $4, NOW(), $5)`,
      [identifier, limitType, currentCount, limit, isBlocked]
    );
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Log rate limit failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }));
  }
}

// ============================================
// Express 中间件
// ============================================

/**
 * 创建限流中间件
 * 
 * @param limitType - 限流类型
 * @param getIdentifier - 获取限流标识的函数
 * @returns Express 中间件
 */
export function createRateLimitMiddleware(
  limitType: string,
  getIdentifier: (req: any) => string
) {
  return async (req: any, res: any, next: any) => {
    try {
      const identifier = getIdentifier(req);
      
      if (!identifier) {
        res.status(400).json({
          success: false,
          error: 'Unable to determine rate limit identifier',
        });
        return;
      }
      
      const result = await checkRateLimit(identifier, limitType);
      
      // 设置限流响应头
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));
      
      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter || 3600);
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
        });
        return;
      }
      
      next();
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Rate limit middleware error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }));
      
      // 出错时允许请求通过
      next();
    }
  };
}

/**
 * IP 限流中间件
 * 
 * @param limitType - 限流类型
 * @returns Express 中间件
 */
export function ipRateLimit(limitType: string) {
  return createRateLimitMiddleware(limitType, (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  });
}

/**
 * 实例限流中间件
 * 
 * @param limitType - 限流类型
 * @returns Express 中间件
 */
export function instanceRateLimit(limitType: string) {
  return createRateLimitMiddleware(limitType, (req) => {
    const user = req.user;
    return user?.instanceId || 'unknown';
  });
}

// ============================================
// 清理函数
// ============================================

/**
 * 关闭 Redis 连接
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    
    console.log(JSON.stringify({
      level: 'info',
      message: 'Redis connection closed',
      timestamp: new Date().toISOString(),
    }));
  }
}

// ============================================
// 测试函数
// ============================================

/**
 * 测试限流功能
 */
export async function testRateLimit(): Promise<void> {
  const testIdentifier = 'test:client:123';
  const limitType = 'query';
  
  console.log('=== Rate Limit Test ===\n');
  
  // 重置限流
  await resetRateLimit(testIdentifier, limitType);
  
  // 测试 105 次请求（超过 100 次限制）
  for (let i = 1; i <= 105; i++) {
    const result = await checkRateLimit(testIdentifier, limitType);
    
    if (i <= 100) {
      console.log(`Request ${i}: allowed=${result.allowed}, remaining=${result.remaining}`);
    } else if (i === 101) {
      console.log(`Request ${i}: allowed=${result.allowed}, retryAfter=${result.retryAfter}s (BLOCKED!)`);
    }
    
    if (i === 101) {
      break; // 停止测试
    }
  }
  
  // 获取状态
  const status = await getRateLimitStatus(testIdentifier, limitType);
  console.log('\nRate limit status:', status);
  
  // 清理
  await resetRateLimit(testIdentifier, limitType);
  console.log('\nTest completed and cleaned up.');
}

// 如果直接运行此文件，执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testRateLimit().then(() => {
    closeRedisConnection().then(() => process.exit(0));
  });
}
