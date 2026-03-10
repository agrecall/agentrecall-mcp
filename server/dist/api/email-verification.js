/**
 * 邮箱验证码模块
 */
import { Resend } from 'resend';
import { pool } from '../db/index.js';
import { checkRateLimit } from '../utils/rate-limit.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const CODE_EXPIRY_MINUTES = 10;
const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 5;

function generateCode() {
  return Math.random().toString().slice(2, 2 + CODE_LENGTH);
}

export async function sendVerificationCode(email, ip, type = 'register') {
  const emailRateLimit = await checkRateLimit('email:' + email, 'send-code', 1, 60);
  if (!emailRateLimit.allowed) {
    return { success: false, message: '发送太频繁，请60秒后再试', retryAfter: emailRateLimit.retryAfter };
  }

  const ipRateLimit = await checkRateLimit('ip:' + ip, 'send-code', 10, 3600);
  if (!ipRateLimit.allowed) {
    return { success: false, message: '发送次数过多，请稍后再试', retryAfter: ipRateLimit.retryAfter };
  }

  if (type === 'register') {
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return { success: false, message: '该邮箱已被注册' };
    }
  }

  if (type === 'reset_password') {
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length === 0) {
      return { success: false, message: '该邮箱未注册' };
    }
  }

  await pool.query('DELETE FROM email_verifications WHERE email = $1 AND type = $2', [email, type]);

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  await pool.query(
    'INSERT INTO email_verifications (email, code, type, expires_at) VALUES ($1, $2, $3, $4)',
    [email, code, type, expiresAt]
  );

  const subjects = { register: '【AgentRecall】邮箱验证码', reset_password: '【AgentRecall】重置密码验证码' };
  const contents = { register: '您正在注册 AgentRecall 账号', reset_password: '您正在重置 AgentRecall 账号密码' };

  try {
    await resend.emails.send({
      from: 'AgentRecall <noreply@mail.agentrecall.io>',
      to: email,
      subject: subjects[type] || subjects.register,
      html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#333">邮箱验证</h2><p style="color:#666">您好！' + (contents[type] || contents.register) + '。</p><div style="background:#f5f5f5;padding:20px;text-align:center;margin:20px 0"><span style="font-size:32px;font-weight:bold;letter-spacing:5px;color:#333">' + code + '</span></div><p style="color:#999;font-size:14px">验证码有效期 ' + CODE_EXPIRY_MINUTES + ' 分钟，请勿泄露给他人。</p></div>'
    });
    return { success: true, message: '验证码已发送' };
  } catch (error) {
    console.error('Send email error:', error);
    return { success: false, message: '邮件发送失败，请稍后重试' };
  }
}

export async function verifyCode(email, code, type = 'register') {
  const result = await pool.query(
    'SELECT * FROM email_verifications WHERE email = $1 AND type = $2 AND verified = FALSE ORDER BY created_at DESC LIMIT 1',
    [email, type]
  );

  if (result.rows.length === 0) {
    return { success: false, message: '验证码不存在或已过期，请重新获取' };
  }

  const record = result.rows[0];

  if (new Date() > new Date(record.expires_at)) {
    await pool.query('DELETE FROM email_verifications WHERE id = $1', [record.id]);
    return { success: false, message: '验证码已过期，请重新获取' };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await pool.query('DELETE FROM email_verifications WHERE id = $1', [record.id]);
    return { success: false, message: '错误次数过多，请重新获取验证码' };
  }

  if (record.code !== code) {
    await pool.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1', [record.id]);
    const remaining = MAX_ATTEMPTS - record.attempts - 1;
    return { success: false, message: '验证码错误，还剩 ' + remaining + ' 次机会' };
  }

  await pool.query('UPDATE email_verifications SET verified = TRUE WHERE id = $1', [record.id]);
  return { success: true, message: '验证成功' };
}

export async function deleteVerifiedCode(email, type = 'register') {
  await pool.query('DELETE FROM email_verifications WHERE email = $1 AND type = $2 AND verified = TRUE', [email, type]);
}
