/**
 * API Key Authentication Middleware
 * Allows direct API Key authentication
 */
import { pool } from '../db/index.js';
import { checkRateLimit } from '../utils/rate-limit.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'agentrecall-secret-key';

function verifyJWT(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

export async function authenticateByAPIKey(req, res, next) {
    const authHeader = req.headers.authorization;
    const clientIP = req.ip || 'unknown';
    
    if (!authHeader) {
        res.status(401).json({
            success: false,
            error: 'Authorization header is required',
        });
        return;
    }
    
    // Check if JWT or API Key
    if (authHeader.startsWith('Bearer ')) {
        // JWT auth
        const token = authHeader.split(' ')[1];
        if (!token) {
            res.status(401).json({ success: false, error: 'Token is required' });
            return;
        }
        const payload = verifyJWT(token);
        if (!payload) {
            res.status(401).json({ success: false, error: 'Invalid or expired token' });
            return;
        }
        req.user = payload;
        next();
    } else {
        // API Key auth
        const apiKey = authHeader.trim();
        
        if (!apiKey.startsWith('ak_')) {
            res.status(401).json({ success: false, error: 'Invalid API key format' });
            return;
        }
        
        try {
            // Find API Key
            const keyResult = await pool.query(
                `SELECT ak.id, ak.user_id, ak.is_active, u.email, u.role
                 FROM api_keys ak
                 JOIN users u ON ak.user_id = u.id
                 WHERE ak.key = $1 AND ak.is_active = true`,
                [apiKey]
            );
            
            if (keyResult.rows.length === 0) {
                res.status(401).json({ success: false, error: 'Invalid API key' });
                return;
            }
            
            const keyData = keyResult.rows[0];
            
            // Get user instance
            const instanceResult = await pool.query(
                `SELECT id FROM instances WHERE user_id = $1 AND is_active = true LIMIT 1`,
                [keyData.user_id]
            );
            
            const instanceId = instanceResult.rows.length > 0 ? instanceResult.rows[0].id : null;
            
            // Rate limit check
            const rateLimitResult = await checkRateLimit(instanceId || clientIP, 'submit', 10, 3600);
            if (!rateLimitResult.allowed) {
                res.status(429).json({ success: false, error: 'Rate limit exceeded' });
                return;
            }
            
            req.user = {
                userId: keyData.user_id,
                email: keyData.email,
                role: keyData.role,
                instanceId: instanceId,
                apiKeyId: keyData.id,
            };
            next();
        } catch (error) {
            console.error('API Key auth error:', error);
            res.status(500).json({ success: false, error: 'Authentication failed' });
        }
    }
}
