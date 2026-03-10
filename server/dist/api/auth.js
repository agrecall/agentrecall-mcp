/**
 * AgentRecall MCP Server - Authentication Module
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import nacl from 'tweetnacl';
import { z } from 'zod';
import { pool } from '../db/index.js';
import { checkRateLimit } from '../utils/rate-limit.js';

const JWT_SECRET = process.env.JWT_SECRET || 'agentrecall-secret-key';

function generateOTP() {
    const randomBytes = nacl.randomBytes(20);
    const base64url = Buffer.from(randomBytes).toString('base64url').replace(/=/g, '');
    return `AR_${base64url}`;
}

async function hashOTP(otp) {
    const encoder = new TextEncoder();
    const data = encoder.encode(otp + (process.env.OTP_MASTER_KEY || ''));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getOTPPrefix(otp) {
    return otp.substring(0, 10) + '...';
}

export function verifySignature(message, signatureBase64, publicKeyBase64) {
    try {
        const publicKey = Buffer.from(publicKeyBase64, 'base64');
        if (publicKey.length !== 32) return false;
        const signature = Buffer.from(signatureBase64, 'base64');
        return nacl.sign.detached.verify(
            new TextEncoder().encode(message),
            signature,
            publicKey
        );
    } catch {
        return false;
    }
}

function verifyJWT(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

export function authenticateJWT(req, res, next) {
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
    const payload = verifyJWT(token);
    if (!payload) {
        res.status(401).json({ success: false, error: 'Invalid or expired token' });
        return;
    }
    req.user = payload;
    next();
}

// New: API Key authentication
export async function authenticateByAPIKey(req, res, next) {
    const authHeader = req.headers.authorization;
    const clientIP = req.ip || 'unknown';
    
    if (!authHeader) {
        res.status(401).json({ success: false, error: 'Authorization header is required' });
        return;
    }
    
    // JWT or API Key
    if (authHeader.startsWith('Bearer ')) {
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
        // API Key
        const apiKey = authHeader.trim();
        if (!apiKey.startsWith('ak_')) {
            res.status(401).json({ success: false, error: 'Invalid API key format' });
            return;
        }
        try {
            const keyResult = await pool.query(
                `SELECT ak.id, ak.user_id, ak.is_active, u.email, u.role
                 FROM api_keys ak JOIN users u ON ak.user_id = u.id
                 WHERE ak.key = $1 AND ak.is_active = true`,
                [apiKey]
            );
            if (keyResult.rows.length === 0) {
                res.status(401).json({ success: false, error: 'Invalid API key' });
                return;
            }
            const keyData = keyResult.rows[0];
            const instanceResult = await pool.query(
                `SELECT id FROM instances WHERE user_id = $1 AND is_active = true LIMIT 1`,
                [keyData.user_id]
            );
            const instanceId = instanceResult.rows.length > 0 ? instanceResult.rows[0].id : null;
            const rateLimitResult = await checkRateLimit(instanceId || clientIP, 'submit', 10, 3600);
            if (!rateLimitResult.allowed) {
                res.status(429).json({ success: false, error: 'Rate limit exceeded' });
                return;
            }
            req.user = { userId: keyData.user_id, email: keyData.email, role: keyData.role, instanceId, apiKeyId: keyData.id };
            next();
        } catch (error) {
            console.error('API Key auth error:', error);
            res.status(500).json({ success: false, error: 'Authentication failed' });
        }
    }
}

const router = Router();

router.post('/register', async (req, res) => {
    try {
        const rateLimitResult = await checkRateLimit(req.ip, 'register', 5, 3600);
        if (!rateLimitResult.allowed) {
            res.status(429).json({ success: false, error: 'Rate limit exceeded' });
            return;
        }
        const otp = generateOTP();
        const otpHash = await hashOTP(otp);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        await pool.query(`INSERT INTO activation_keys (otp_hash, otp_prefix, status, expires_at) VALUES ($1, $2, 'pending', $3)`, [otpHash, getOTPPrefix(otp), expiresAt]);
        res.json({ success: true, otp, expiresAt: expiresAt.toISOString() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/activate', async (req, res) => {
    try {
        const { otp, deviceFingerprint, publicKey, signature } = req.body;
        const otpHash = await hashOTP(otp);
        const keyResult = await pool.query(`SELECT * FROM activation_keys WHERE otp_hash = $1 AND status = 'pending'`, [otpHash]);
        if (keyResult.rows.length === 0) {
            res.status(400).json({ success: false, error: 'Invalid OTP' });
            return;
        }
        const valid = verifySignature(otp, signature, publicKey);
        if (!valid) {
            res.status(400).json({ success: false, error: 'Invalid signature' });
            return;
        }
        await pool.query(`UPDATE activation_keys SET status = 'activated' WHERE otp_hash = $1`, [otpHash]);
        const instanceResult = await pool.query(`INSERT INTO instances (device_fingerprint, public_key, name, is_active, activated_at) VALUES ($1, $2, $3, true, NOW()) RETURNING id`, [deviceFingerprint, publicKey, deviceFingerprint]);
        const instanceId = instanceResult.rows[0].id;
        const token = jwt.sign({ instanceId, fingerprint: deviceFingerprint }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, instanceId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/refresh', authenticateJWT, async (req, res) => {
    try {
        const newToken = jwt.sign({ userId: req.user.userId, instanceId: req.user.instanceId, fingerprint: req.user.fingerprint }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token: newToken, expiresIn: '7d' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/me', authenticateJWT, async (req, res) => {
    res.json({ success: true, user: req.user });
});

export const authRouter = router;
