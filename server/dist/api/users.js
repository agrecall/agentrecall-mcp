/**
 * AgentRecall Admin Panel - User Management API
 *
 * 用户管理功能：
 * - 用户注册（带邮箱验证）
 * - 用户登录
 * - 用户信息获取/更新
 * - 用户列表（管理员）
 * - 重置密码
 */
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db/index.js';
import { checkRateLimit } from '../utils/rate-limit.js';
import { sendVerificationCode, verifyCode, deleteVerifiedCode } from './email-verification.js';

// ============================================
// 验证 Schema
// ============================================
const RegisterSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    username: z.string().min(2, 'Username must be at least 2 characters').max(100),
    code: z.string().length(6, 'Verification code must be 6 digits'),
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
function generateUserJWT(userId, email, role) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not configured');
    return jwt.sign({ userId, email, role }, secret, { expiresIn: '7d' });
}

export function verifyUserJWT(token) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not configured');
    try {
        return jwt.verify(token, secret);
    } catch {
        return null;
    }
}

export function authenticateUser(req, res, next) {
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
    req.user = payload;
    next();
}

export function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
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
 * POST /api/v1/users/send-code
 * 发送注册验证码
 */
router.post('/send-code', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ success: false, error: 'Email is required' });
            return;
        }
        const clientIP = req.ip || 'unknown';
        const result = await sendVerificationCode(email, clientIP, 'register');
        if (result.success) {
            res.json({ success: true, message: result.message });
        } else {
            res.status(400).json({ success: false, error: result.message });
        }
    } catch (error) {
        console.error('Send code error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * POST /api/v1/users/send-reset-code
 * 发送重置密码验证码
 */
router.post('/send-reset-code', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ success: false, error: 'Email is required' });
            return;
        }
        const clientIP = req.ip || 'unknown';
        const result = await sendVerificationCode(email, clientIP, 'reset_password');
        if (result.success) {
            res.json({ success: true, message: result.message });
        } else {
            res.status(400).json({ success: false, error: result.message });
        }
    } catch (error) {
        console.error('Send reset code error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * POST /api/v1/users/register
 * 用户注册（需要验证码）
 */
router.post('/register', async (req, res) => {
    try {
        const configResult = await pool.query(
            "SELECT config_value FROM system_configs WHERE config_key = 'enable_registration'"
        );
        if (configResult.rows.length > 0 && configResult.rows[0].config_value === 'false') {
            res.status(403).json({ success: false, error: 'Registration is currently disabled' });
            return;
        }

        const clientIP = req.ip || 'unknown';
        const rateLimitResult = await checkRateLimit(clientIP, 'register', 5, 3600);
        if (!rateLimitResult.allowed) {
            res.status(429).json({ success: false, error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter });
            return;
        }

        const parseResult = RegisterSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({ success: false, error: 'Invalid request', details: parseResult.error.errors });
            return;
        }

        const { email, password, username, code } = parseResult.data;

        const verifyResult = await verifyCode(email, code, 'register');
        if (!verifyResult.success) {
            res.status(400).json({ success: false, error: verifyResult.message });
            return;
        }

        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            res.status(409).json({ success: false, error: 'Email already registered' });
            return;
        }

        const quotaResult = await pool.query(
            "SELECT config_value FROM system_configs WHERE config_key = 'default_api_quota'"
        );
        const defaultQuota = quotaResult.rows.length > 0 ? parseInt(quotaResult.rows[0].config_value) : 1000;

        const passwordHash = await bcrypt.hash(password, 10);

        const userResult = await pool.query(
            'INSERT INTO users (email, password_hash, username, api_quota) VALUES ($1, $2, $3, $4) RETURNING id, email, username, role, created_at',
            [email, passwordHash, username, defaultQuota]
        );

        const user = userResult.rows[0];
        await deleteVerifiedCode(email, 'register');

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
 * POST /api/v1/users/reset-password
 * 重置密码
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        
        if (!email || !code || !newPassword) {
            res.status(400).json({ success: false, error: 'Missing required fields' });
            return;
        }

        if (newPassword.length < 8) {
            res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
            return;
        }

        const verifyResult = await verifyCode(email, code, 'reset_password');
        if (!verifyResult.success) {
            res.status(400).json({ success: false, error: verifyResult.message });
            return;
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2', [passwordHash, email]);
        await deleteVerifiedCode(email, 'reset_password');

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * POST /api/v1/users/login
 * 用户登录
 */
router.post('/login', async (req, res) => {
    try {
        const clientIP = req.ip || 'unknown';
        const rateLimitResult = await checkRateLimit(clientIP, 'login', 10, 300);
        if (!rateLimitResult.allowed) {
            res.status(429).json({ success: false, error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter });
            return;
        }

        const parseResult = LoginSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({ success: false, error: 'Invalid request', details: parseResult.error.errors });
            return;
        }

        const { email, password } = parseResult.data;

        const userResult = await pool.query(
            'SELECT id, email, username, password_hash, role, status, api_quota, api_used FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            res.status(401).json({ success: false, error: 'Invalid email or password' });
            return;
        }

        const user = userResult.rows[0];

        if (user.status !== 'active') {
            res.status(403).json({ success: false, error: 'Account is suspended or deleted' });
            return;
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            res.status(401).json({ success: false, error: 'Invalid email or password' });
            return;
        }

        await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

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
router.get('/me', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        const userResult = await pool.query(
            'SELECT id, email, username, role, status, api_quota, api_used, last_login_at, created_at FROM users WHERE id = $1',
            [user.userId]
        );

        if (userResult.rows.length === 0) {
            res.status(404).json({ success: false, error: 'User not found' });
            return;
        }

        const userData = userResult.rows[0];
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
router.put('/me', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        const parseResult = UpdateUserSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({ success: false, error: 'Invalid request', details: parseResult.error.errors });
            return;
        }

        const { username, currentPassword, newPassword } = parseResult.data;

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
            await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newPasswordHash, user.userId]);
        }

        if (username) {
            await pool.query('UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2', [username, user.userId]);
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
router.get('/', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = (page - 1) * limit;
        const search = req.query.search;
        const role = req.query.role;
        const status = req.query.status;

        let whereClause = 'WHERE 1=1';
        const params = [];

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

        const countResult = await pool.query(`SELECT COUNT(*) FROM users ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count);

        params.push(limit);
        params.push(offset);
        const usersResult = await pool.query(
            `SELECT id, email, username, role, status, api_quota, api_used, last_login_at, created_at FROM users ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json({
            success: true,
            users: usersResult.rows,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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
router.put('/:id/status', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['active', 'suspended', 'deleted'].includes(status)) {
            res.status(400).json({ success: false, error: 'Invalid status' });
            return;
        }

        if (id === req.user.userId) {
            res.status(403).json({ success: false, error: 'Cannot modify your own status' });
            return;
        }

        await pool.query('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);

        await pool.query(
            'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
            [req.user.userId, 'update_user_status', 'user', id, JSON.stringify({ newStatus: status }), req.ip]
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
router.put('/:id/quota', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { quota } = req.body;

        if (!quota || quota < 0) {
            res.status(400).json({ success: false, error: 'Invalid quota' });
            return;
        }

        await pool.query('UPDATE users SET api_quota = $1, updated_at = NOW() WHERE id = $2', [quota, id]);

        await pool.query(
            'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
            [req.user.userId, 'update_user_quota', 'user', id, JSON.stringify({ newQuota: quota }), req.ip]
        );

        res.json({ success: true, message: 'User quota updated successfully' });
    } catch (error) {
        console.error('Update user quota error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

export { router as usersRouter };