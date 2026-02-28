/**
 * AgentRecall Admin Panel - User Management API
 * 
 * 用户管理功能：
 * - 用户注册
 * - 用户登录
 * - 用户信息获取/更新
 * - 用户列表（管理员）
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db/index.js';
import { authenticateJWT } from './auth.js';
import { checkRateLimit } from '../utils/rate-limit.js';

// ============================================
// 类型定义
// ============================================

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// ============================================
// 验证 Schema
// ============================================

const RegisterSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  username: z.string().min(2, 'Username must be at least 2 characters').max(100),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const UpdateUserSchema = z.object({
  username: z.string().min(2).max(100).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

// ============================================
// 辅助函数
// ============================================

/**
 * 生成用户 JWT
 */
function generateUserJWT(userId: string, email: string, role: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  
  const expiresInSeconds = 7 * 24 * 60 * 60; // 7天
  
  return jwt.sign({ userId, email, role }, secret, { expiresIn: expiresInSeconds });
}

/**
 * 验证用户 JWT
 */
export function verifyUserJWT(token: string): JWTPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  
  try {
    return jwt.verify(token, secret) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * 用户认证中间件
 */
export function authenticateUser(req: Request, res: Response, next: Function): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({ success: false, error: 'Authorization header is required' });
    return;
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    res.status(401).json({ success: false, error: 'Token is required' });
    return;
  }
  
  const payload = verifyUserJWT(token);
  
  if (!payload) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
    return;
  }
  
  (req as any).user = payload;
  next();
}

/**
 * 管理员权限中间件
 */
export function requireAdmin(req: Request, res: Response, next: Function): void {
  const user = (req as any).user as JWTPayload;
  
  if (user.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin permission required' });
    return;
  }
  
  next();
}

// ============================================
// 路由
// ============================================

const router = Router();

/**
 * POST /api/v1/users/register
 * 用户注册
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    // 检查是否开放注册
    const configResult = await pool.query(
      "SELECT config_value FROM system_configs WHERE config_key = 'enable_registration'"
    );
    
    if (configResult.rows.length > 0 && configResult.rows[0].config_value === 'false') {
      res.status(403).json({ success: false, error: 'Registration is currently disabled' });
      return;
    }
    
    // 限流检查
    const clientIP = req.ip || 'unknown';
    const rateLimitResult = await checkRateLimit(clientIP, 'register', 5, 3600);
    
    if (!rateLimitResult.allowed) {
      res.status(429).json({ success: false, error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter });
      return;
    }
    
    // 验证请求体
    const parseResult = RegisterSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Invalid request', details: parseResult.error.errors });
      return;
    }
    
    const { email, password, username } = parseResult.data;
    
    // 检查邮箱是否已存在
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }
    
    // 获取默认 API 配额
    const quotaResult = await pool.query(
      "SELECT config_value FROM system_configs WHERE config_key = 'default_api_quota'"
    );
    const defaultQuota = quotaResult.rows.length > 0 ? parseInt(quotaResult.rows[0].config_value) : 1000;
    
    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);
    
    // 创建用户
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, username, api_quota) 
       VALUES ($1, $2, $3, $4) RETURNING id, email, username, role, created_at`,
      [email, passwordHash, username, defaultQuota]
    );
    
    const user = userResult.rows[0];
    
    // 生成 JWT
    const token = generateUserJWT(user.id, user.email, user.role);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        createdAt: user.created_at,
      },
      token,
      expiresIn: '7d',
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/users/login
 * 用户登录
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    // 限流检查
    const clientIP = req.ip || 'unknown';
    const rateLimitResult = await checkRateLimit(clientIP, 'login', 10, 300);
    
    if (!rateLimitResult.allowed) {
      res.status(429).json({ success: false, error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter });
      return;
    }
    
    // 验证请求体
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Invalid request', details: parseResult.error.errors });
      return;
    }
    
    const { email, password } = parseResult.data;
    
    // 查询用户
    const userResult = await pool.query(
      'SELECT id, email, username, password_hash, role, status, api_quota, api_used FROM users WHERE email = $1',
      [email]
    );
    
    if (userResult.rows.length === 0) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }
    
    const user = userResult.rows[0];
    
    // 检查用户状态
    if (user.status !== 'active') {
      res.status(403).json({ success: false, error: 'Account is suspended or deleted' });
      return;
    }
    
    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }
    
    // 更新最后登录时间
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    
    // 生成 JWT
    const token = generateUserJWT(user.id, user.email, user.role);
    
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        apiQuota: user.api_quota,
        apiUsed: user.api_used,
      },
      token,
      expiresIn: '7d',
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/users/me
 * 获取当前用户信息
 */
router.get('/me', authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTPayload;
    
    const userResult = await pool.query(
      `SELECT id, email, username, role, status, api_quota, api_used, last_login_at, created_at 
       FROM users WHERE id = $1`,
      [user.userId]
    );
    
    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    
    const userData = userResult.rows[0];
    
    // 获取 API Key 数量
    const apiKeyCount = await pool.query(
      'SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND is_active = TRUE',
      [user.userId]
    );
    
    res.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        role: userData.role,
        status: userData.status,
        apiQuota: userData.api_quota,
        apiUsed: userData.api_used,
        apiKeyCount: parseInt(apiKeyCount.rows[0].count),
        lastLoginAt: userData.last_login_at,
        createdAt: userData.created_at,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /api/v1/users/me
 * 更新当前用户信息
 */
router.put('/me', authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as JWTPayload;
    
    const parseResult = UpdateUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, error: 'Invalid request', details: parseResult.error.errors });
      return;
    }
    
    const { username, currentPassword, newPassword } = parseResult.data;
    
    // 如果要修改密码，需要验证当前密码
    if (newPassword) {
      if (!currentPassword) {
        res.status(400).json({ success: false, error: 'Current password is required' });
        return;
      }
      
      const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.userId]);
      const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
      
      if (!isValidPassword) {
        res.status(401).json({ success: false, error: 'Current password is incorrect' });
        return;
      }
      
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', 
        [newPasswordHash, user.userId]);
    }
    
    // 更新用户名
    if (username) {
      await pool.query('UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2', 
        [username, user.userId]);
    }
    
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/users
 * 获取用户列表（管理员）
 */
router.get('/', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    
    const search = req.query.search as string;
    const role = req.query.role as string;
    const status = req.query.status as string;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (email ILIKE $${params.length} OR username ILIKE $${params.length})`;
    }
    
    if (role) {
      params.push(role);
      whereClause += ` AND role = $${params.length}`;
    }
    
    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }
    
    // 获取总数
    const countResult = await pool.query(`SELECT COUNT(*) FROM users ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);
    
    // 获取用户列表
    params.push(limit);
    params.push(offset);
    
    const usersResult = await pool.query(
      `SELECT id, email, username, role, status, api_quota, api_used, last_login_at, created_at 
       FROM users ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    
    res.json({
      success: true,
      users: usersResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /api/v1/users/:id/status
 * 更新用户状态（管理员）
 */
router.put('/:id/status', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['active', 'suspended', 'deleted'].includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }
    
    // 不能修改自己的状态
    const currentUser = (req as any).user as JWTPayload;
    if (id === currentUser.userId) {
      res.status(403).json({ success: false, error: 'Cannot modify your own status' });
      return;
    }
    
    await pool.query('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);
    
    // 记录管理员操作
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [currentUser.userId, 'update_user_status', 'user', id, JSON.stringify({ newStatus: status }), req.ip]
    );
    
    res.json({ success: true, message: 'User status updated successfully' });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /api/v1/users/:id/quota
 * 更新用户 API 配额（管理员）
 */
router.put('/:id/quota', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { quota } = req.body;
    
    if (!quota || quota < 0) {
      res.status(400).json({ success: false, error: 'Invalid quota' });
      return;
    }
    
    await pool.query('UPDATE users SET api_quota = $1, updated_at = NOW() WHERE id = $2', [quota, id]);
    
    // 记录管理员操作
    const currentUser = (req as any).user as JWTPayload;
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [currentUser.userId, 'update_user_quota', 'user', id, JSON.stringify({ newQuota: quota }), req.ip]
    );
    
    res.json({ success: true, message: 'User quota updated successfully' });
  } catch (error) {
    console.error('Update user quota error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export { router as usersRouter };
