import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import * as authService from '../services/auth.service';
import { success } from '../utils/response';

const router = Router();

// POST /register - 用户注册
const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少 6 位'),
  name: z.string().min(1, '姓名不能为空'),
});

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const result = await authService.register(req.body.email, req.body.password, req.body.name);
    // 设置 Cookie
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
    });
    success(res, result, '注册成功', 201);
  } catch (err) { next(err); }
});

// POST /login - 用户登录
const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空'),
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login(req.body.email, req.body.password);
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    success(res, result, '登录成功');
  } catch (err) { next(err); }
});

// POST /logout - 用户登出
router.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      await authService.logout(token);
    }
    res.clearCookie('token');
    success(res, null, '已登出');
  } catch (err) { next(err); }
});

// GET /me - 获取当前用户信息
import { auth } from '../middleware/auth';

router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await authService.getMe(req.userId!);
    success(res, user);
  } catch (err) { next(err); }
});

export default router;
