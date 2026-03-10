/**
 * AgentRecall MCP Server - Pitfalls REST API
 * 
 * REST API 端点：
 * - POST /api/v1/pitfalls - 提交避坑（需 JWT，限流 10/h）
 * - GET /api/v1/pitfalls/search - 向量相似度搜索（余弦距离）
 * - GET /api/v1/pitfalls/stats - 社区统计
 * - GET /api/v1/pitfalls/:id - 获取单个避坑详情
 * - GET /api/v1/pitfalls - 获取避坑列表
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool, searchSimilarPitfalls, upsertPitfall, getCommunityStats, getRecentPitfalls } from '../db/index.js';
import { authenticateJWT } from './auth.js';
import { sanitizeInput } from '../utils/sanitize.js';
import { checkRateLimit } from '../utils/rate-limit.js';

// ============================================
// 验证 Schema
// ============================================

const SubmitPitfallSchema = z.object({
  pattern: z.string().min(1).max(10000),
  workaround: z.string().min(1).max(20000),
  embedding: z.array(z.number()).length(1024).optional(),
  taxonomy: z.record(z.any()).default({}),
  contextFingerprint: z.string().optional(),
  errorSignature: z.string().optional(),
});

const SearchQuerySchema = z.object({
  q: z.string().optional(),
  embedding: z.string().optional(), // JSON 编码的向量
  contextFingerprint: z.string().optional(),
  errorSignature: z.string().optional(),
  limit: z.string().default('10').transform(Number).pipe(z.number().int().min(1).max(50)),
  threshold: z.string().default('0.7').transform(Number).pipe(z.number().min(0).max(1)),
});

// ============================================
// 路由
// ============================================

const router = Router();

/**
 * POST /api/v1/pitfalls
 * 提交避坑（需 JWT，限流 10/h）
 */
router.post('/', authenticateJWT, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const user = (req as any).user;
    
    // 1. 限流检查（10次/小时/实例）
    const rateLimitResult = await checkRateLimit(user.instanceId, 'submit', 10, 3600);
    
    if (!rateLimitResult.allowed) {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter,
      });
      return;
    }
    
    // 2. 验证请求体
    const parseResult = SubmitPitfallSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.errors,
      });
      return;
    }
    
    const { pattern, workaround, embedding, taxonomy, contextFingerprint, errorSignature } = parseResult.data;
    
    // 3. 脱敏处理
    const sanitizedPattern = sanitizeInput(pattern);
    const sanitizedWorkaround = sanitizeInput(workaround);
    
    // 4. 准备向量嵌入
    const embeddingVector = embedding || new Array(1024).fill(0);
    
    // 5. 插入或更新数据库
    const result = await upsertPitfall(
      sanitizedPattern,
      sanitizedWorkaround,
      embeddingVector,
      taxonomy,
      contextFingerprint,
      errorSignature,
      user.instanceId
    );
    
    // 6. 记录提交日志
    await pool.query(
      `INSERT INTO submissions (instance_id, pitfall_id, action, ip_address, request_payload, processing_time_ms)
       VALUES ($1, $2, 'submit', $3, $4, $5)`,
      [
        user.instanceId,
        result.id,
        req.ip,
        JSON.stringify({ 
          pattern: sanitizedPattern.substring(0, 200),
          hasEmbedding: !!embedding,
          taxonomy,
        }),
        Date.now() - startTime,
      ]
    );
    
    // 7. 返回结果
    res.status(result.isNew ? 201 : 200).json({
      success: true,
      id: result.id,
      status: result.isNew ? 'created' : 'updated',
      processingTime: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Submit pitfall failed',
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
 * GET /api/v1/pitfalls/search
 * 向量相似度搜索（余弦距离）
 */
router.get('/search', async (_req: Request, res: Response) => {
  // 搜索已移除，请使用 MCP query_pitfall
  res.status(410).json({success: false, error: 'Search removed. Use MCP query_pitfall.'});
  return;
});
router.get('/stats', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const stats = await getCommunityStats();
    
    // 获取最近 7 天的提交趋势
    const trendResult = await pool.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
       FROM submissions
       WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`
    );
    
    // 获取热门分类
    const categoryResult = await pool.query(
      `SELECT 
        taxonomy->>'category' as category,
        COUNT(*) as count
       FROM pitfalls
       WHERE taxonomy->>'category' IS NOT NULL
       GROUP BY taxonomy->>'category'
       ORDER BY count DESC
       LIMIT 10`
    );
    
    res.json({
      success: true,
      stats: {
        ...stats,
        trend: trendResult.rows.map(row => ({
          date: row.date,
          count: parseInt(row.count),
        })),
        topCategories: categoryResult.rows.map(row => ({
          category: row.category,
          count: parseInt(row.count),
        })),
      },
      processingTime: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Get stats failed',
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
 * GET /api/v1/pitfalls/:id
 * 获取单个避坑详情
 */
router.get('/:id', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT 
        id,
        pattern,
        workaround,
        taxonomy,
        context_fingerprint,
        error_signature,
        submission_count,
        first_seen_at,
        last_seen_at,
        created_at
       FROM pitfalls
       WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Pitfall not found',
      });
      return;
    }
    
    const pitfall = result.rows[0];
    
    res.json({
      success: true,
      pitfall: {
        id: pitfall.id,
        pattern: pitfall.pattern,
        workaround: pitfall.workaround,
        taxonomy: pitfall.taxonomy,
        contextFingerprint: pitfall.context_fingerprint,
        errorSignature: pitfall.error_signature,
        submissionCount: pitfall.submission_count,
        firstSeenAt: pitfall.first_seen_at,
        lastSeenAt: pitfall.last_seen_at,
        createdAt: pitfall.created_at,
      },
      processingTime: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Get pitfall failed',
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
 * GET /api/v1/pitfalls
 * 获取避坑列表
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    
    // 获取列表
    const listResult = await pool.query(
      `SELECT 
        id,
        pattern,
        workaround,
        taxonomy,
        submission_count,
        last_seen_at
       FROM pitfalls
       ORDER BY last_seen_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    // 获取总数
    const countResult = await pool.query('SELECT COUNT(*) FROM pitfalls');
    const total = parseInt(countResult.rows[0].count);
    
    res.json({
      success: true,
      pitfalls: listResult.rows.map(row => ({
        id: row.id,
        pattern: row.pattern,
        workaround: row.workaround,
        taxonomy: row.taxonomy,
        submissionCount: row.submission_count,
        lastSeenAt: row.last_seen_at,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      processingTime: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Get pitfalls list failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }));
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export { router as pitfallsRouter };
