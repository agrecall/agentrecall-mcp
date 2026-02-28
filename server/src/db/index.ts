/**
 * AgentRecall MCP Server - Database Module
 * 
 * PostgreSQL 连接池配置和向量查询函数
 * 使用 pgvector 扩展支持向量相似度搜索
 */

import pg from 'pg';
const { Pool } = pg;

// ============================================
// 数据库连接池配置
// ============================================

const poolConfig: pg.PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  
  // 连接池设置
  max: 20,                    // 最大连接数
  min: 5,                     // 最小连接数
  idleTimeoutMillis: 30000,   // 连接空闲超时（30秒）
  connectionTimeoutMillis: 5000, // 连接超时（5秒）
  
  // SSL 配置（生产环境）
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : undefined,
};

// 创建连接池
export const pool = new Pool(poolConfig);

// ============================================
// 连接池事件监听
// ============================================

pool.on('connect', (_client) => {
  console.log(JSON.stringify({
    level: 'debug',
    message: 'New database connection established',
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    timestamp: new Date().toISOString(),
  }));
});

pool.on('acquire', (_client) => {
  console.log(JSON.stringify({
    level: 'debug',
    message: 'Database connection acquired from pool',
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    timestamp: new Date().toISOString(),
  }));
});

pool.on('remove', (_client) => {
  console.log(JSON.stringify({
    level: 'debug',
    message: 'Database connection removed from pool',
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    timestamp: new Date().toISOString(),
  }));
});

pool.on('error', (err, _client) => {
  console.error(JSON.stringify({
    level: 'error',
    message: 'Unexpected database pool error',
    error: err.message,
    timestamp: new Date().toISOString(),
  }));
});

// ============================================
// 向量查询函数
// ============================================

/**
 * 搜索相似的避坑指南
 * 
 * @param queryEmbedding - 查询向量（1024维）
 * @param similarityThreshold - 相似度阈值（0-1）
 * @param maxResults - 最大返回结果数
 * @returns 相似的避坑指南列表
 */
export async function searchSimilarPitfalls(
  queryEmbedding: number[],
  similarityThreshold: number = 0.7,
  maxResults: number = 10
): Promise<Array<{
  id: string;
  pattern: string;
  workaround: string;
  taxonomy: Record<string, any>;
  similarity: number;
  submission_count: number;
  last_seen_at: Date;
}>> {
  const client = await pool.connect();
  
  try {
    // 使用向量余弦距离搜索（<=> 操作符）
    // 注意：pgvector 的 <=> 返回的是距离，相似度 = 1 - 距离
    const result = await client.query(
      `SELECT 
        id,
        pattern,
        workaround,
        taxonomy,
        1 - (embedding <=> $1::vector) as similarity,
        submission_count,
        last_seen_at
       FROM pitfalls
       WHERE embedding IS NOT NULL
         AND 1 - (embedding <=> $1::vector) >= $2
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [JSON.stringify(queryEmbedding), similarityThreshold, maxResults]
    );
    
    return result.rows.map(row => ({
      ...row,
      similarity: parseFloat(row.similarity),
    }));
  } finally {
    client.release();
  }
}

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
export async function upsertPitfall(
  pattern: string,
  workaround: string,
  embedding: number[],
  taxonomy: Record<string, any> = {},
  contextFingerprint?: string,
  errorSignature?: string,
  instanceId?: string
): Promise<{ id: string; isNew: boolean }> {
  const client = await pool.connect();
  
  try {
    // 开始事务
    await client.query('BEGIN');
    
    // 尝试查找已存在的相同错误签名
    let existingId: string | null = null;
    
    if (errorSignature) {
      const existingResult = await client.query(
        'SELECT id FROM pitfalls WHERE error_signature = $1 LIMIT 1',
        [errorSignature]
      );
      
      if (existingResult.rows.length > 0) {
        existingId = existingResult.rows[0].id;
      }
    }
    
    let result: { id: string; isNew: boolean };
    
    if (existingId) {
      // 更新现有记录
      await client.query(
        `UPDATE pitfalls
         SET submission_count = submission_count + 1,
             last_seen_at = NOW(),
             workaround = CASE 
               WHEN LENGTH($1) > LENGTH(workaround) THEN $1 
               ELSE workaround 
             END,
             embedding = COALESCE($2, embedding),
             taxonomy = taxonomy || $3
         WHERE id = $4`,
        [workaround, JSON.stringify(embedding), JSON.stringify(taxonomy), existingId]
      );
      
      result = { id: existingId, isNew: false };
    } else {
      // 插入新记录
      const insertResult = await client.query(
        `INSERT INTO pitfalls 
          (pattern, workaround, embedding, taxonomy, context_fingerprint, error_signature, instance_id)
         VALUES ($1, $2, $3::vector, $4, $5, $6, $7)
         RETURNING id`,
        [
          pattern,
          workaround,
          JSON.stringify(embedding),
          JSON.stringify(taxonomy),
          contextFingerprint || null,
          errorSignature || null,
          instanceId || null,
        ]
      );
      
      result = { id: insertResult.rows[0].id, isNew: true };
    }
    
    // 提交事务
    await client.query('COMMIT');
    
    return result;
  } catch (error) {
    // 回滚事务
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 获取避坑指南详情
 * 
 * @param id - 避坑指南ID
 * @returns 避坑指南详情
 */
export async function getPitfallById(id: string): Promise<any | null> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
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
    
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * 获取社区统计信息
 * 
 * @returns 社区统计数据
 */
export async function getCommunityStats(): Promise<{
  totalPitfalls: number;
  totalInstances: number;
  activeInstances: number;
  totalSubmissions: number;
  todaySubmissions: number;
  uniqueErrorPatterns: number;
}> {
  const client = await pool.connect();
  
  try {
    const result = await client.query('SELECT * FROM get_community_stats()');
    const stats = result.rows[0];
    
    return {
      totalPitfalls: parseInt(stats.total_pitfalls),
      totalInstances: parseInt(stats.total_instances),
      activeInstances: parseInt(stats.active_instances),
      totalSubmissions: parseInt(stats.total_submissions),
      todaySubmissions: parseInt(stats.today_submissions),
      uniqueErrorPatterns: parseInt(stats.unique_error_patterns),
    };
  } finally {
    client.release();
  }
}

/**
 * 获取实例信息
 * 
 * @param deviceFingerprint - 设备指纹
 * @returns 实例信息
 */
export async function getInstanceByFingerprint(deviceFingerprint: string): Promise<any | null> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT 
        id,
        device_fingerprint,
        public_key,
        name,
        description,
        is_active,
        activated_at,
        last_seen_at,
        metadata,
        created_at
       FROM instances
       WHERE device_fingerprint = $1`,
      [deviceFingerprint]
    );
    
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * 更新实例最后活跃时间
 * 
 * @param instanceId - 实例ID
 */
export async function updateInstanceLastSeen(instanceId: string): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query(
      'UPDATE instances SET last_seen_at = NOW() WHERE id = $1',
      [instanceId]
    );
  } finally {
    client.release();
  }
}

/**
 * 创建 OTP
 * 
 * @param otpHash - OTP 的 SHA256 哈希
 * @param otpPrefix - OTP 前缀（用于显示）
 * @param expiresAt - 过期时间
 * @returns 创建的 OTP ID
 */
export async function createOTP(
  otpHash: string,
  otpPrefix: string,
  expiresAt: Date
): Promise<string> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `INSERT INTO activation_keys (otp_hash, otp_prefix, status, expires_at)
       VALUES ($1, $2, 'pending', $3)
       RETURNING id`,
      [otpHash, otpPrefix, expiresAt]
    );
    
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

/**
 * 验证 OTP
 * 
 * @param otpHash - OTP 的 SHA256 哈希
 * @returns OTP 记录或 null
 */
export async function verifyOTP(otpHash: string): Promise<any | null> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT * FROM activation_keys 
       WHERE otp_hash = $1 
         AND status = 'pending' 
         AND expires_at > NOW()`,
      [otpHash]
    );
    
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * 激活 OTP
 * 
 * @param otpId - OTP ID
 * @param instanceId - 实例ID
 */
export async function activateOTP(otpId: string, instanceId: string): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query(
      `UPDATE activation_keys 
       SET status = 'activated', instance_id = $1, activated_at = NOW()
       WHERE id = $2`,
      [instanceId, otpId]
    );
  } finally {
    client.release();
  }
}

/**
 * 创建实例
 * 
 * @param deviceFingerprint - 设备指纹
 * @param publicKey - Ed25519 公钥
 * @returns 创建的实例ID
 */
export async function createInstance(
  deviceFingerprint: string,
  publicKey: string
): Promise<string> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `INSERT INTO instances (device_fingerprint, public_key, is_active, activated_at)
       VALUES ($1, $2, TRUE, NOW())
       RETURNING id`,
      [deviceFingerprint, publicKey]
    );
    
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

/**
 * 获取最近的避坑指南
 * 
 * @param limit - 返回数量限制
 * @returns 避坑指南列表
 */
export async function getRecentPitfalls(limit: number = 10): Promise<any[]> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT 
        id,
        pattern,
        workaround,
        taxonomy,
        submission_count,
        last_seen_at
       FROM pitfalls
       ORDER BY last_seen_at DESC
       LIMIT $1`,
      [limit]
    );
    
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * 搜索避坑指南（文本搜索）
 * 
 * @param query - 搜索关键词
 * @param limit - 返回数量限制
 * @returns 避坑指南列表
 */
export async function searchPitfallsByText(
  query: string,
  limit: number = 10
): Promise<any[]> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT 
        id,
        pattern,
        workaround,
        taxonomy,
        submission_count,
        last_seen_at,
        similarity(pattern, $1) as text_similarity
       FROM pitfalls
       WHERE pattern ILIKE $2 OR workaround ILIKE $2
       ORDER BY text_similarity DESC, last_seen_at DESC
       LIMIT $3`,
      [query, `%${query}%`, limit]
    );
    
    return result.rows;
  } finally {
    client.release();
  }
}
