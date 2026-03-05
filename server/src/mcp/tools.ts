/**
 * AgentRecall MCP Server - Tool Definitions and Handlers
 * 
 * 定义 4 个核心 MCP Tool：
 * 1. submit_pitfall - 提交避坑指南
 * 2. query_pitfall - 查询相似错误
 * 3. verify_health - 健康检查
  */

import { z } from 'zod';
import { pool, searchSimilarPitfalls, upsertPitfall } from '../db/index.js';
import { verifySignature, generateJWT } from '../api/auth.js';
import { sanitizeInput } from '../utils/sanitize.js';
import { checkRateLimit } from '../utils/rate-limit.js';

// ============================================
// Tool 输入 Schema 定义
// ============================================

// submit_pitfall 输入 Schema
const SubmitPitfallSchema = z.object({
  pattern: z.string().min(1).max(10000).describe('错误模式描述'),
  workaround: z.string().min(1).max(20000).describe('解决方案'),
  embedding: z.array(z.number()).length(1024).optional().describe('向量嵌入（1024维）'),
  taxonomy: z.record(z.any()).default({}).describe('分类标签'),
  contextFingerprint: z.string().optional().describe('上下文指纹'),
  errorSignature: z.string().optional().describe('错误签名（哈希）'),
  instanceId: z.string().uuid().optional().describe('提交实例ID'),
});

// query_pitfall 输入 Schema
const QueryPitfallSchema = z.object({
  contextFingerprint: z.string().optional().describe('上下文指纹'),
  errorSignature: z.string().optional().describe('错误签名'),
  embedding: z.array(z.number()).length(1024).optional().describe('查询向量（1024维）'),
  limit: z.number().int().min(1).max(50).default(10).describe('返回结果数量'),
  similarityThreshold: z.number().min(0).max(1).default(0.7).describe('相似度阈值'),
});

// verify_health 输入 Schema
const VerifyHealthSchema = z.object({}).default({});

// Tool 类型定义
// ============================================

export type ToolName = 'submit_pitfall' | 'query_pitfall' | 'verify_health';

interface ToolDefinition {
  name: ToolName;
  description: string;
  inputSchema: z.ZodTypeAny;
}

// ============================================
// Tool 定义列表
// ============================================

export const tools: ToolDefinition[] = [
  {
    name: 'submit_pitfall',
    description: '提交一个避坑指南到知识网络。用于分享错误模式和解决方案，让其他 AI Agent 能从历史失败中学习。',
    inputSchema: SubmitPitfallSchema,
  },
  {
    name: 'query_pitfall',
    description: '查询相似的避坑指南。根据上下文指纹、错误签名或向量嵌入搜索相关的错误模式和解决方案。',
    inputSchema: QueryPitfallSchema,
  },
  {
    name: 'verify_health',
    description: '验证服务器健康状态。检查数据库连接和服务可用性。',
    inputSchema: VerifyHealthSchema,
  },
];

// ============================================
// Tool 处理器实现
// ============================================

/**
 * submit_pitfall 处理器
 * 提交避坑指南到知识网络
 */
async function handleSubmitPitfall(input: z.infer<typeof SubmitPitfallSchema>): Promise<any> {
  const startTime = Date.now();
  
  try {
    // 1. 检查限流（如果提供了 instanceId）
    if (input.instanceId) {
      const rateLimitResult = await checkRateLimit(input.instanceId, 'submit', 10, 3600); // 10次/小时
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter,
        };
      }
    }
    
    // 2. 脱敏处理
    const sanitizedPattern = sanitizeInput(input.pattern);
    const sanitizedWorkaround = sanitizeInput(input.workaround);
    
    // 3. 准备向量嵌入（如果未提供，使用零向量）
    const embedding = input.embedding || new Array(1024).fill(0);
    
    // 4. 插入或更新数据库
    const result = await upsertPitfall(
      sanitizedPattern,
      sanitizedWorkaround,
      embedding,
      input.taxonomy,
      input.contextFingerprint,
      input.errorSignature,
      input.instanceId
    );
    
    // 5. 记录提交日志
    await pool.query(
      `INSERT INTO submissions (instance_id, pitfall_id, action, request_payload, processing_time_ms)
       VALUES ($1, $2, 'submit', $3, $4)`,
      [
        input.instanceId || null,
        result.id,
        JSON.stringify({ 
          pattern: sanitizedPattern.substring(0, 200),
          hasEmbedding: !!input.embedding,
          taxonomy: input.taxonomy,
        }),
        Date.now() - startTime,
      ]
    );
    
    return {
      success: true,
      id: result.id,
      status: result.isNew ? 'created' : 'updated',
      processingTime: `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'submit_pitfall failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }));
    
    throw error;
  }
}

/**
 * query_pitfall 处理器
 * 查询相似的避坑指南
 */
async function handleQueryPitfall(input: z.infer<typeof QueryPitfallSchema>): Promise<any> {
  const startTime = Date.now();
  
  try {
    let results: any[] = [];
    
    // 1. 优先使用向量搜索（如果提供了 embedding）
    if (input.embedding) {
      const vectorResults = await searchSimilarPitfalls(
        input.embedding,
        input.similarityThreshold,
        input.limit
      );
      results = vectorResults;
    }
    
    // 2. 如果没有向量结果，尝试使用 errorSignature 搜索
    if (results.length === 0 && input.errorSignature) {
      const signatureResult = await pool.query(
        `SELECT 
          id, pattern, workaround, taxonomy,
          1.0 as similarity, submission_count, last_seen_at
         FROM pitfalls 
         WHERE error_signature = $1
         LIMIT $2`,
        [input.errorSignature, input.limit]
      );
      results = signatureResult.rows;
    }
    
    // 3. 如果还没有结果，尝试使用 contextFingerprint 搜索
    if (results.length === 0 && input.contextFingerprint) {
      const fingerprintResult = await pool.query(
        `SELECT 
          id, pattern, workaround, taxonomy,
          0.9 as similarity, submission_count, last_seen_at
         FROM pitfalls 
         WHERE context_fingerprint = $1
         ORDER BY last_seen_at DESC
         LIMIT $2`,
        [input.contextFingerprint, input.limit]
      );
      results = fingerprintResult.rows;
    }
    
    // 4. 如果仍然没有结果，返回最近的避坑指南
    if (results.length === 0) {
      const recentResult = await pool.query(
        `SELECT 
          id, pattern, workaround, taxonomy,
          0.0 as similarity, submission_count, last_seen_at
         FROM pitfalls 
         ORDER BY last_seen_at DESC
         LIMIT $1`,
        [input.limit]
      );
      results = recentResult.rows;
    }
    
    return {
      success: true,
      count: results.length,
      pitfalls: results.map(row => ({
        id: row.id,
        pattern: row.pattern,
        workaround: row.workaround,
        taxonomy: row.taxonomy,
        similarity: parseFloat(row.similarity),
        submissionCount: row.submission_count,
        lastSeenAt: row.last_seen_at,
      })),
      processingTime: `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'query_pitfall failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }));
    
    throw error;
  }
}

/**
 * verify_health 处理器
 * 验证服务器健康状态
 */
async function handleVerifyHealth(_input: z.infer<typeof VerifyHealthSchema>): Promise<any> {
  const startTime = Date.now();
  
  try {
    // 检查数据库连接
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    const dbLatency = Date.now() - dbStart;
    
    // 获取统计信息
    const statsResult = await pool.query('SELECT * FROM get_community_stats()');
    const stats = statsResult.rows[0];
    
    return {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: {
          status: 'ok',
          latency: `${dbLatency}ms`,
        },
      },
      stats: {
        totalPitfalls: parseInt(stats.total_pitfalls),
        totalInstances: parseInt(stats.total_instances),
        activeInstances: parseInt(stats.active_instances),
        totalSubmissions: parseInt(stats.total_submissions),
      },
      processingTime: `${Date.now() - startTime}ms`,
    };
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'verify_health failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }));
    
    return {
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Health check failed',
      processingTime: `${Date.now() - startTime}ms`,
    };
  }
}
// 辅助函数
// ============================================

/**
 * 计算 OTP 的 SHA256 哈希
 */
async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp + (process.env.OTP_MASTER_KEY || ''));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================
// Tool 处理器映射
// ============================================

export const toolHandlers: Record<ToolName, (input: any) => Promise<any>> = {
  submit_pitfall: handleSubmitPitfall,
  query_pitfall: handleQueryPitfall,
  verify_health: handleVerifyHealth,
};
