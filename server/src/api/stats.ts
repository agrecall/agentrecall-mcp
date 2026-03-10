/**
 * AgentRecall Admin Panel - Statistics API
 *
 * 统计功能：
 * - 用户使用统计
 * - API 调用统计
 * - Dashboard 数据
 * - 系统整体统计
 */
import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { authenticateUser, requireAdmin } from './users.js';

const router = Router();

/**
 * GET /api/v1/stats/dashboard
 * 获取仪表盘数据（支持多时区）
 * Query params: timezone - 用户时区，如 'Asia/Shanghai', 'America/New_York'
 */
router.get('/dashboard', authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    // 从查询参数获取时区，默认使用 UTC
    const userTimezone = (req.query.timezone as string) || 'UTC';
    
    // 验证时区是否有效
    let validTimezone = 'UTC';
    try {
      const tzCheck = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = $1)`,
        [userTimezone]
      );
      if (tzCheck.rows[0].exists) {
        validTimezone = userTimezone;
      }
    } catch (e) {
      console.warn('Invalid timezone:', userTimezone, ', using UTC');
    }

    // 获取今日统计（正确计算用户时区的今日开始时间）
    const todayStatsResult = await pool.query(
      `SELECT COUNT(*) as request_count
       FROM api_usage_logs
       WHERE user_id = $1 
         AND created_at >= (DATE_TRUNC('day', NOW() AT TIME ZONE $2) AT TIME ZONE $2)`,
      [user.userId, validTimezone]
    );

    // 获取本月统计
    const monthStatsResult = await pool.query(
      `SELECT COUNT(*) as request_count
       FROM api_usage_logs
       WHERE user_id = $1 
         AND created_at >= (DATE_TRUNC('month', NOW() AT TIME ZONE $2) AT TIME ZONE $2)`,
      [user.userId, validTimezone]
    );

    // 获取 API Keys 列表
    const apiKeysResult = await pool.query(
      `SELECT id, key_name, key_prefix, permissions, usage_count, is_active, last_used_at, created_at
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.userId]
    );

    res.json({
      success: true,
      dashboard: {
        timezone: validTimezone,
        today: { request_count: todayStatsResult.rows[0].request_count },
        thisMonth: { request_count: monthStatsResult.rows[0].request_count },
        apiKeys: apiKeysResult.rows.map((k: any) => ({
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

/**
 * GET /api/v1/stats/user
 * 获取当前用户使用统计
 */
router.get('/user', authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const userStatsResult = await pool.query(
      'SELECT * FROM user_usage_stats WHERE user_id = $1',
      [user.userId]
    );

    const trendResult = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as request_count
       FROM api_usage_logs
       WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [user.userId]
    );

    const apiKeyStatsResult = await pool.query(
      'SELECT * FROM api_key_usage_stats WHERE user_id = $1',
      [user.userId]
    );

    res.json({
      success: true,
      stats: userStatsResult.rows[0] || null,
      trends: trendResult.rows,
      apiKeys: apiKeyStatsResult.rows,
    });
  }
  catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/stats/system
 * 获取系统整体统计（管理员）
 */
router.get('/system', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const statsResult = await pool.query('SELECT * FROM system_stats');

    const trendResult = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as request_count
       FROM api_usage_logs
       WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`
    );

    const endpointsResult = await pool.query(
      `SELECT endpoint, COUNT(*) as request_count
       FROM api_usage_logs
       WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY endpoint
       ORDER BY request_count DESC
       LIMIT 10`
    );

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

export { router as statsRouter };
