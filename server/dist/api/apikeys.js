/**
 * AgentRecall Admin Panel - API Key Management API
 *
 * API Key 管理功能：
 * - 创建 API Key
 * - 删除 API Key
 * - 列出用户的 API Keys
 * - 查看 API Key 使用统计
 */
import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { pool } from '../db/index.js';
import { authenticateUser, requireAdmin } from './users.js';
// ============================================
// 验证 Schema
// ============================================
const CreateApiKeySchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    permissions: z.array(z.enum(['read', 'write', 'admin'])).default(['read']),
    rateLimit: z.number().int().min(10).max(10000).default(100),
    expiresInDays: z.number().int().min(1).max(365).optional(),
});
// ============================================
// 辅助函数
// ============================================
/**
 * 生成 API Key
 * 格式: ak_<base64url>
 */
function generateApiKey() {
    const randomBytes = crypto.randomBytes(32);
    const key = 'ak_' + randomBytes.toString('base64url');
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const prefix = key.substring(0, 10) + '...';
    return { key, hash, prefix };
}
/**
 * 验证 API Key
 */
export async function verifyApiKey(key) {
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const result = await pool.query(`SELECT ak.*, u.id as user_id, u.email, u.status as user_status, u.api_quota, u.api_used
     FROM api_keys ak
     JOIN users u ON ak.user_id = u.id
     WHERE ak.key_hash = $1 AND ak.is_active = TRUE
     AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`, [hash]);
    if (result.rows.length === 0) {
        return null;
    }
    const apiKey = result.rows[0];
    // 检查用户状态
    if (apiKey.user_status !== 'active') {
        return null;
    }
    // 检查 API 配额
    if (apiKey.api_used >= apiKey.api_quota) {
        return null;
    }
    return apiKey;
}
/**
 * 记录 API Key 使用
 */
export async function logApiKeyUsage(apiKeyId, userId, endpoint, method, statusCode, durationMs) {
    // 更新 API Key 使用次数
    await pool.query('UPDATE api_keys SET usage_count = usage_count + 1, last_used_at = NOW() WHERE id = $1', [apiKeyId]);
    // 更新用户使用次数
    await pool.query('UPDATE users SET api_used = api_used + 1 WHERE id = $1', [userId]);
    // 记录使用日志
    await pool.query(`INSERT INTO api_usage_logs (user_id, api_key_id, endpoint, method, status_code, duration_ms) 
     VALUES ($1, $2, $3, $4, $5, $6)`, [userId, apiKeyId, endpoint, method, statusCode, durationMs]);
}
// ============================================
// 路由
// ============================================
const router = Router();
/**
 * GET /api/v1/apikeys
 * 获取当前用户的 API Keys
 */
router.get('/', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        const apiKeysResult = await pool.query(`SELECT id, key_name, key_prefix, permissions, rate_limit, usage_count, 
              is_active, expires_at, last_used_at, created_at
       FROM api_keys 
       WHERE user_id = $1 
       ORDER BY created_at DESC`, [user.userId]);
        res.json({
            success: true,
            apiKeys: apiKeysResult.rows,
        });
    }
    catch (error) {
        console.error('Get API keys error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * POST /api/v1/apikeys
 * 创建新的 API Key
 */
router.post('/', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        // 验证请求体
        const parseResult = CreateApiKeySchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({ success: false, error: 'Invalid request', details: parseResult.error.errors });
            return;
        }
        const { name, permissions, rateLimit, expiresInDays } = parseResult.data;
        // 检查用户 API Key 数量限制
        const maxKeysResult = await pool.query("SELECT config_value FROM system_configs WHERE config_key = 'max_api_keys_per_user'");
        const maxKeys = maxKeysResult.rows.length > 0 ? parseInt(maxKeysResult.rows[0].config_value) : 5;
        const currentKeysResult = await pool.query('SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND is_active = TRUE', [user.userId]);
        const currentKeys = parseInt(currentKeysResult.rows[0].count);
        if (currentKeys >= maxKeys) {
            res.status(403).json({
                success: false,
                error: `Maximum number of API keys (${maxKeys}) reached. Please delete an existing key first.`
            });
            return;
        }
        // 生成 API Key
        const { key, hash, prefix } = generateApiKey();
        // 计算过期时间
        const expiresAt = expiresInDays
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
            : null;
        // 创建 API Key
        const apiKeyResult = await pool.query(`INSERT INTO api_keys (user_id, key_name, key_hash, key_prefix, permissions, rate_limit, expires_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, key_name, key_prefix, permissions, rate_limit, expires_at, created_at`, [user.userId, name, hash, prefix, JSON.stringify(permissions), rateLimit, expiresAt]);
        const apiKey = apiKeyResult.rows[0];
        res.status(201).json({
            success: true,
            message: 'API key created successfully',
            apiKey: {
                id: apiKey.id,
                name: apiKey.key_name,
                prefix: apiKey.key_prefix,
                permissions: apiKey.permissions,
                rateLimit: apiKey.rate_limit,
                expiresAt: apiKey.expires_at,
                createdAt: apiKey.created_at,
                // 重要：只返回一次完整的 key
                key: key,
            },
            warning: 'Please copy your API key now. You will not be able to see it again.',
        });
    }
    catch (error) {
        console.error('Create API key error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * DELETE /api/v1/apikeys/:id
 * 删除 API Key（真正的删除操作）
 */
router.delete('/:id', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        // 检查 API Key 是否属于当前用户（管理员可以删除任何 key）
        let query = 'SELECT user_id FROM api_keys WHERE id = $1';
        let params = [id];
        if (user.role !== 'admin') {
            query += ' AND user_id = $2';
            params.push(user.userId);
        }
        const apiKeyResult = await pool.query(query, params);
        if (apiKeyResult.rows.length === 0) {
            res.status(404).json({ success: false, error: 'API key not found' });
            return;
        }
        // 真正的删除操作
        await pool.query('DELETE FROM api_keys WHERE id = $1', [id]);
        res.json({ success: true, message: 'API key deleted successfully' });
    }
    catch (error) {
        console.error('Delete API key error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * GET /api/v1/apikeys/:id/usage
 * 获取 API Key 使用统计
 */
router.get('/:id/usage', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        // 检查 API Key 是否属于当前用户（管理员可以查看任何 key）
        let query = 'SELECT user_id FROM api_keys WHERE id = $1';
        let params = [id];
        if (user.role !== 'admin') {
            query += ' AND user_id = $2';
            params.push(user.userId);
        }
        const apiKeyResult = await pool.query(query, params);
        if (apiKeyResult.rows.length === 0) {
            res.status(404).json({ success: false, error: 'API key not found' });
            return;
        }
        // 获取使用统计
        const days = parseInt(req.query.days) || 30;
        const usageResult = await pool.query(`SELECT 
        DATE(created_at) as date,
        COUNT(*) as request_count,
        AVG(duration_ms) as avg_duration
       FROM api_usage_logs 
       WHERE api_key_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`, [id]);
        const endpointsResult = await pool.query(`SELECT 
        endpoint,
        COUNT(*) as request_count
       FROM api_usage_logs 
       WHERE api_key_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY endpoint
       ORDER BY request_count DESC
       LIMIT 10`, [id]);
        res.json({
            success: true,
            usage: {
                daily: usageResult.rows,
                topEndpoints: endpointsResult.rows,
            },
        });
    }
    catch (error) {
        console.error('Get API key usage error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * GET /api/v1/apikeys/admin/all
 * 获取所有 API Keys（管理员）
 */
router.get('/admin/all', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = (page - 1) * limit;
        // 获取总数
        const countResult = await pool.query('SELECT COUNT(*) FROM api_keys');
        const total = parseInt(countResult.rows[0].count);
        // 获取 API Key 列表
        const apiKeysResult = await pool.query(`SELECT ak.*, u.email as user_email, u.username as user_username
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.id
       ORDER BY ak.created_at DESC
       LIMIT $1 OFFSET $2`, [limit, offset]);
        res.json({
            success: true,
            apiKeys: apiKeysResult.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error('Get all API keys error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
export { router as apiKeysRouter };
//# sourceMappingURL=apikeys.js.map