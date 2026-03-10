/**
 * AgentRecall Admin Panel - Statistics API
 *
 * 统计功能：
 * - 用户使用统计
 * - API 调用统计
 * - 交互历史查询
 * - 系统整体统计
 */
import { Router } from 'express';
import { pool } from '../db/index.js';
import { authenticateUser, requireAdmin } from './users.js';
// ============================================
// 路由
// ============================================
const router = Router();
/**
 * GET /api/v1/stats/system
 * 获取系统整体统计（管理员）
 */
router.get('/system', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const statsResult = await pool.query('SELECT * FROM system_stats');
        // 获取最近 7 天的 API 调用趋势
        const trendResult = await pool.query(`SELECT 
        DATE(created_at) as date,
        COUNT(*) as request_count
       FROM api_usage_logs
       WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`);
        // 获取热门端点
        const endpointsResult = await pool.query(`SELECT 
        endpoint,
        COUNT(*) as request_count
       FROM api_usage_logs
       WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY endpoint
       ORDER BY request_count DESC
       LIMIT 10`);
        res.json({
            success: true,
            stats: statsResult.rows[0],
            trends: trendResult.rows,
            topEndpoints: endpointsResult.rows,
        });
    }
    catch (error) {
        console.error('Get system stats error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * GET /api/v1/stats/user
 * 获取当前用户使用统计
 */
router.get('/user', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        // 获取用户统计
        const userStatsResult = await pool.query('SELECT * FROM user_usage_stats WHERE user_id = $1', [user.userId]);
        // 获取最近 7 天的 API 调用趋势
        const trendResult = await pool.query(`SELECT 
        DATE(created_at) as date,
        COUNT(*) as request_count
       FROM api_usage_logs
       WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`, [user.userId]);
        // 获取 API Key 使用统计
        const apiKeyStatsResult = await pool.query(`SELECT * FROM api_key_usage_stats WHERE user_id = $1`, [user.userId]);
        // 获取用户 Top Endpoints
        const topEndpointsResult = await pool.query(`SELECT endpoint, COUNT(*) as request_count FROM api_usage_logs WHERE user_id = $1 GROUP BY endpoint ORDER BY request_count DESC LIMIT 10`, [user.userId]);
        res.json({
            success: true,
            stats: userStatsResult.rows[0] || null,
            trends: trendResult.rows,
            apiKeys: apiKeyStatsResult.rows,
            topEndpoints: topEndpointsResult.rows,
        });
    }
    catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * GET /api/v1/stats/usage
 * 获取 API 使用日志
 */
router.get('/usage', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = (page - 1) * limit;
        const days = parseInt(req.query.days) || 7;
        // 构建查询条件
        let whereClause = 'WHERE l.created_at >= NOW() - INTERVAL \'' + days + ' days\'';
        const params = [];
        // 非管理员只能查看自己的日志
        if (user.role !== 'admin') {
            params.push(user.userId);
            whereClause += ` AND l.user_id = $${params.length}`;
        }
        // 获取总数
        const countResult = await pool.query(`SELECT COUNT(*) FROM api_usage_logs l ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count);
        // 获取日志列表
        params.push(limit);
        params.push(offset);
        const logsResult = await pool.query(`SELECT 
        l.id, l.endpoint, l.method, l.status_code, l.duration_ms, l.created_at,
        u.email as user_email,
        ak.key_name as api_key_name
       FROM api_usage_logs l
       LEFT JOIN users u ON l.user_id = u.id
       LEFT JOIN api_keys ak ON l.api_key_id = ak.id
       ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        res.json({
            success: true,
            logs: logsResult.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error('Get usage logs error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * GET /api/v1/stats/history
 * 获取交互历史
 */
router.get('/history', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = (page - 1) * limit;
        const requestType = req.query.type;
        const sessionId = req.query.sessionId;
        const days = parseInt(req.query.days) || 30;
        // 构建查询条件
        let whereClause = 'WHERE ch.created_at >= NOW() - INTERVAL \'' + days + ' days\'';
        const params = [];
        // 非管理员只能查看自己的历史
        if (user.role !== 'admin') {
            params.push(user.userId);
            whereClause += ` AND ch.user_id = $${params.length}`;
        }
        if (requestType) {
            params.push(requestType);
            whereClause += ` AND ch.request_type = $${params.length}`;
        }
        if (sessionId) {
            params.push(sessionId);
            whereClause += ` AND ch.session_id = $${params.length}`;
        }
        // 获取总数
        const countResult = await pool.query(`SELECT COUNT(*) FROM api_usage_logs ch ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count);
        // 获取历史列表
        params.push(limit);
        params.push(offset);
        const historyResult = await pool.query(`SELECT 
        ch.id, ch.session_id, ch.request_type, ch.status, 
        ch.tokens_input, ch.tokens_output, ch.processing_time_ms, ch.created_at,
        u.email as user_email,
        ak.key_name as api_key_name
       FROM api_usage_logs ch
       LEFT JOIN users u ON ch.user_id = u.id
       LEFT JOIN api_keys ak ON ch.api_key_id = ak.id
       ${whereClause}
       ORDER BY ch.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
        res.json({
            success: true,
            history: historyResult.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error('Get chat history error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * GET /api/v1/stats/history/:id
 * 获取交互详情
 */
router.get('/history/:id', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        // 构建查询条件
        let query = 'SELECT * FROM api_usage_logs WHERE id = $1';
        const params = [id];
        // 非管理员只能查看自己的历史
        if (user.role !== 'admin') {
            query += ' AND user_id = $2';
            params.push(user.userId);
        }
        const historyResult = await pool.query(query, params);
        if (historyResult.rows.length === 0) {
            res.status(404).json({ success: false, error: 'History not found' });
            return;
        }
        res.json({
            success: true,
            history: historyResult.rows[0],
        });
    }
    catch (error) {
        console.error('Get history detail error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
/**
 * GET /api/v1/stats/dashboard
 * 获取仪表盘数据
 */
/**
 * GET /api/v1/stats/dashboard
 * 获取仪表盘数据（支持多时区）
 * Query params: timezone - 用户时区，如 'Asia/Shanghai', 'America/New_York'
 */
/**
 * GET /api/v1/stats/dashboard
 * 获取仪表盘数据（支持多时区）
 * Query params: timezone - 用户时区，如 'Asia/Shanghai', 'America/New_York'
 */
router.get('/dashboard', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        // 从查询参数获取时区，默认使用 UTC
        const userTimezone = req.query.timezone || 'UTC';
        
        // 验证时区是否有效
        let validTimezone = 'UTC';
        try {
            await pool.query(`SELECT $1::text AS tz`, [userTimezone]);
            // 检查时区是否存在
            const tzCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT 1 FROM pg_timezone_names WHERE name = $1
                )
            `, [userTimezone]);
            if (tzCheck.rows[0].exists) {
                validTimezone = userTimezone;
            }
        } catch (e) {
            console.warn('Invalid timezone:', userTimezone, ', using UTC');
        }

        // 获取今日统计（正确计算用户时区的今日开始时间）
        // 方法：将当前时间转换到用户时区，取日期部分，再转回 UTC
        const todayStatsResult = await pool.query(`
            SELECT COUNT(*) as request_count
            FROM api_usage_logs
            WHERE user_id = $1 
              AND created_at >= (DATE_TRUNC('day', NOW() AT TIME ZONE $2) AT TIME ZONE $2)
        `, [user.userId, validTimezone]);

        // 获取本月统计（正确计算用户时区的本月开始时间）
        const monthStatsResult = await pool.query(`
            SELECT COUNT(*) as request_count
            FROM api_usage_logs
            WHERE user_id = $1 
              AND created_at >= (DATE_TRUNC('month', NOW() AT TIME ZONE $2) AT TIME ZONE $2)
        `, [user.userId, validTimezone]);

        // 获取 API Keys 列表
        const apiKeysResult = await pool.query(`
            SELECT id, key_name, key_prefix, permissions, usage_count, is_active, last_used_at, created_at
            FROM api_keys
            WHERE user_id = $1
            ORDER BY created_at DESC
        `, [user.userId]);

        res.json({
            success: true,
            dashboard: {
                timezone: validTimezone,
                today: { request_count: todayStatsResult.rows[0].request_count },
                thisMonth: { request_count: monthStatsResult.rows[0].request_count },
                apiKeys: apiKeysResult.rows.map(k => ({
                    id: k.id,
                    name: k.key_name,
                    prefix: k.key_prefix,
                    permissions: k.permissions,
                    usageCount: k.usage_count,
                    isActive: k.is_active,
                    lastUsedAt: k.last_used_at,
                    createdAt: k.created_at
                }))
            },
        });
    }
    catch (error) {
        console.error('Get dashboard error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

export { router as statsRouter };
//# sourceMappingURL=stats.js.map