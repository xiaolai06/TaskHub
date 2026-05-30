import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import { auth } from '../middleware/auth';
import { registerSchema, loginSchema } from '../validators/auth.schema';
import * as authService from '../services/auth.service';
import { success, error } from '../utils/response';

const router = Router();

/** JWT 有效期：7 天（毫秒），与 Session 同步 */
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/**
 * 设置 httpOnly Cookie
 * - httpOnly: JS 无法读取，防 XSS
 * - secure: 仅 HTTPS（开发环境 localhost 用 false）
 * - sameSite: lax，防 CSRF
 * - path: /，全站可用
 */
function setTokenCookie(res: Response, token: string): void {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

/**
 * 从请求中提取 Token（Cookie 优先，fallback Authorization header）
 */
function extractToken(req: Request): string | undefined {
  return req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
}

// ============ 公开接口（不需要登录） ============

/** POST /register — 用户注册 */
router.post('/register', validate(registerSchema), async (req: Request, res: Response, next) => {
  try {
    const { email, password, name } = req.body;
    const result = await authService.register(email, password, name, req);
    setTokenCookie(res, result.token);
    success(res, { user: result.user }, '注册成功', 201);
  } catch (err) {
    next(err);
  }
});

/** POST /login — 用户登录 */
router.post('/login', validate(loginSchema), async (req: Request, res: Response, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password, req);
    setTokenCookie(res, result.token);
    success(res, { user: result.user }, '登录成功');
  } catch (err) {
    next(err);
  }
});

// ============ 需要登录的接口 ============

/** POST /logout — 用户登出 */
router.post('/logout', auth, async (req: Request, res: Response, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      await authService.logout(token);
    }
    // 清除 Cookie
    res.clearCookie('token', { path: '/' });
    success(res, null, '已退出登录');
  } catch (err) {
    next(err);
  }
});

/** GET /me — 获取当前登录用户信息 */
router.get('/me', auth, async (req: Request, res: Response, next) => {
  try {
    const user = await authService.getUserById(req.userId!);
    success(res, { user });
  } catch (err) {
    next(err);
  }
});

/** PUT /profile — 更新个人信息 */
router.put('/profile', auth, async (req: Request, res: Response, next) => {
  try {
    const { name, avatar } = req.body;
    const user = await authService.updateProfile(req.userId!, { name, avatar });
    success(res, { user });
  } catch (err) {
    next(err);
  }
});

/** PUT /password — 修改密码 */
router.put('/password', auth, async (req: Request, res: Response, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      error(res, 'VALIDATION_ERROR', '请输入原密码和新密码', 400);
      return;
    }
    if (newPassword.length < 6) {
      error(res, 'VALIDATION_ERROR', '新密码至少6位', 400);
      return;
    }
    await authService.changePassword(req.userId!, oldPassword, newPassword);
    success(res, null, '密码修改成功');
  } catch (err) {
    next(err);
  }
});

export default router;
