import { Request, Response, NextFunction } from 'express';
import { verifyToken, generateToken, JwtPayload } from '../utils/jwt';
import { error } from '../utils/response';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: JwtPayload;
    }
  }
}

/** 剩余有效期不足 1 天时自动续期 */
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** Cookie 有效期：7 天 */
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/** Cookie 安全标志：与 auth.routes.ts 保持一致 */
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

export function auth(req: Request, res: Response, next: NextFunction): void {
  // 从 Cookie 或 Authorization header 获取 token（Cookie 优先）
  const cookieToken = req.cookies?.token;
  const headerToken = req.headers.authorization?.replace('Bearer ', '');
  const token = cookieToken || headerToken;

  if (!token) {
    error(res, 'UNAUTHORIZED', '未登录或登录已过期', 401);
    return;
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.user = payload;

    // 无感续期：剩余有效期不足 1 天时，自动签发新 Token
    const expiresAt = (payload as JwtPayload & { exp?: number }).exp;
    if (expiresAt) {
      const remainingMs = expiresAt * 1000 - Date.now();
      if (remainingMs < REFRESH_THRESHOLD_MS) {
        const newToken = generateToken({
          userId: payload.userId,
          email: payload.email,
          role: payload.role,
        });
        res.cookie('token', newToken, {
          httpOnly: true,
          secure: COOKIE_SECURE,
          sameSite: COOKIE_SECURE ? 'strict' : 'lax',
          maxAge: COOKIE_MAX_AGE,
          path: '/',
        });
      }
    }

    next();
  } catch {
    error(res, 'UNAUTHORIZED', 'Token 无效或已过期', 401);
  }
}
