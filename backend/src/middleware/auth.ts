import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
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

export function auth(req: Request, res: Response, next: NextFunction): void {
  // 从 Cookie 或 Authorization header 获取 token
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
    next();
  } catch {
    error(res, 'UNAUTHORIZED', 'Token 无效或已过期', 401);
  }
}
