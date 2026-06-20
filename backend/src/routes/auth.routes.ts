import { Router, Request, Response } from 'express';
import svgCaptcha from 'svg-captcha';
import { validate } from '../middleware/validate';
import { auth } from '../middleware/auth';
import { loginLimit, registerLimit, rateLimit } from '../middleware/rateLimit';
import { createCaptcha } from '../utils/captcha-store';

const passwordLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: '密码修改尝试过于频繁，请 1 分钟后再试',
});
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema } from '../validators/auth.schema';
import * as authService from '../services/auth.service';
import { prisma } from '../server';
import { success, error } from '../utils/response';

const router = Router();

/** JWT 有效期：7 天（毫秒），与 Session 同步 */
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/**
 * 设置 httpOnly Cookie
 * - httpOnly: JS 无法读取，防 XSS
 * - secure: COOKIE_SECURE 环境变量控制（HTTP=false, HTTPS=true）
 * - sameSite: lax，防 CSRF
 * - path: /，全站可用
 */
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

function setTokenCookie(res: Response, token: string): void {
  res.cookie('token', token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SECURE ? 'strict' : 'lax', // HTTPS 时用 strict 防 CSRF
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

/** GET /check-email — 检查邮箱是否已注册 */
router.get('/check-email', async (req: Request, res: Response, next) => {
  try {
    const email = (req.query.email as string || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      res.json({ success: true, data: { available: true } });
      return;
    }
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    res.json({ success: true, data: { available: !existing } });
  } catch (err) {
    next(err);
  }
});

/** GET /captcha — 获取图形验证码 */
router.get('/captcha', (_req: Request, res: Response) => {
  const captcha = svgCaptcha.create({
    size: 4,
    ignoreChars: '0OolI1',
    noise: 1,          // 干扰线从 3 条减到 1 条，SVG 体积小 60%
    color: true,
    background: '#f0f0f0',
    width: 120,
    height: 40,
  });

  const { captchaId } = createCaptcha(captcha.text);

  // 告诉浏览器不缓存（验证码必须每次新生成）
  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    data: { captchaId, svg: captcha.data },
  });
});

/** POST /register — 用户注册（限频：3次/分钟） */
router.post('/register', registerLimit, validate(registerSchema), async (req: Request, res: Response, next) => {
  try {
    const { email, password, name, captcha, captchaId } = req.body;
    const result = await authService.register(email, password, name, captcha, captchaId, req);
    setTokenCookie(res, result.token);
    success(res, { user: result.user }, '注册成功', 201);
  } catch (err) {
    next(err);
  }
});

/** POST /login — 用户登录（限频：5次/分钟） */
router.post('/login', loginLimit, validate(loginSchema), async (req: Request, res: Response, next) => {
  try {
    const { email, password, captcha, captchaId } = req.body;
    const result = await authService.login(email, password, captcha, captchaId, req);
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

/** PUT /password — 修改密码（限频：5次/分钟） */
router.put('/password', auth, passwordLimit, validate(changePasswordSchema), async (req: Request, res: Response, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    await authService.changePassword(req.userId!, oldPassword, newPassword);
    success(res, null, '密码修改成功');
  } catch (err) {
    next(err);
  }
});

/** POST /forgot-password — 发送密码重置码（限频：3次/分钟） */
router.post('/forgot-password', registerLimit, validate(forgotPasswordSchema), async (req: Request, res: Response, next) => {
  try {
    const { email, captcha, captchaId } = req.body;
    const result = await authService.forgotPassword(email, captcha, captchaId);
    success(res, { emailSent: result.emailSent }, '如果该邮箱已注册，重置码将发送到你的邮箱');
  } catch (err) {
    next(err);
  }
});

/** POST /reset-password — 用验证码重置密码（限频：5次/分钟） */
router.post('/reset-password', loginLimit, validate(resetPasswordSchema), async (req: Request, res: Response, next) => {
  try {
    const { email, code, newPassword } = req.body;
    await authService.resetPassword(email, code, newPassword);
    success(res, null, '密码重置成功，请重新登录');
  } catch (err) {
    next(err);
  }
});

export default router;
