/**
 * AgentRecall Admin Panel - User Management API
 *
 * 用户管理功能：
 * - 用户注册
 * - 用户登录
 * - 用户信息获取/更新
 * - 用户列表（管理员）
 */
import { Request, Response } from 'express';
interface JWTPayload {
    userId: string;
    email: string;
    role: string;
    iat: number;
    exp: number;
}
/**
 * 验证用户 JWT
 */
export declare function verifyUserJWT(token: string): JWTPayload | null;
/**
 * 用户认证中间件
 */
export declare function authenticateUser(req: Request, res: Response, next: Function): void;
/**
 * 管理员权限中间件
 */
export declare function requireAdmin(req: Request, res: Response, next: Function): void;
declare const router: import("express-serve-static-core").Router;
export { router as usersRouter };
//# sourceMappingURL=users.d.ts.map