import { Request } from 'express';
import { prisma } from '../server';
import { hashPassword, comparePassword, hashToken } from '../utils/hash';
import { generateToken } from '../utils/jwt';
import { AppError } from '../utils/errors';
import { verifyCaptcha } from '../utils/captcha-store';
import { createResetCode, verifyResetCode } from '../utils/reset-store';
import { sendResetCode as sendResetEmail } from '../utils/email';

/** JWT 有效期：7 天（毫秒） */
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 内部工具：签发 JWT + 写入 Session 记录
 * Session 表只存 Token 的 SHA-256 哈希，不存明文 JWT
 */
async function createSession(userId: string, email: string, role: string, req: Request): Promise<string> {
  const token = generateToken({ userId, email, role });

  await prisma.session.create({
    data: {
      userId,
      token: hashToken(token), // 只存哈希，数据库泄露也无法伪造 Token
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
      device: req.headers['user-agent']?.slice(0, 255) || 'unknown',
      ip: req.ip || req.socket.remoteAddress || 'unknown',
    },
  });

  // 清理过期 Session（每次新登录时触发，避免独立 cron）
  prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  }).catch((e) => {
    console.warn('[Session] 过期会话清理失败:', (e as Error).message);
  });

  return token;
}

/**
 * 用户注册
 * 1. 检查邮箱唯一性
 * 2. bcrypt 加密密码
 * 3. 创建用户 + 自动签发 Token（注册后免登录）
 */
export async function register(email: string, password: string, name: string, captcha: string, captchaId: string, req: Request) {
  // 先校验验证码
  if (!verifyCaptcha(captchaId, captcha)) {
    throw new AppError('验证码错误或已失效', 400, 'CAPTCHA_INVALID');
  }

  // 检查邮箱是否已注册
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError('该邮箱已被注册', 400, 'EMAIL_EXISTS');
  }

  // 加密密码并创建用户
  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name },
    select: { id: true, email: true, name: true, role: true, avatar: true },
  });

  // 签发 Token + 创建 Session
  const token = await createSession(user.id, user.email, user.role, req);

  return { user, token };
}

/**
 * 用户登录
 * 1. 校验验证码
 * 2. 根据邮箱查找用户
 * 3. bcrypt 比对密码
 * 4. 签发 JWT + 创建 Session 记录
 */
export async function login(email: string, password: string, captcha: string, captchaId: string, req: Request) {
  // 先校验验证码（一次性，失败后需要前端重新获取）
  if (!verifyCaptcha(captchaId, captcha)) {
    throw new AppError('验证码错误或已失效', 400, 'CAPTCHA_INVALID');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError('邮箱或密码错误', 401, 'INVALID_CREDENTIALS');
  }

  const isValidPassword = await comparePassword(password, user.password);
  if (!isValidPassword) {
    throw new AppError('邮箱或密码错误', 401, 'INVALID_CREDENTIALS');
  }

  const token = await createSession(user.id, user.email, user.role, req);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
    },
    token,
  };
}

/**
 * 用户登出
 * 根据 Token 的 SHA-256 哈希删除 Session 记录
 */
export async function logout(token: string): Promise<void> {
  if (!token) return;

  await prisma.session.deleteMany({
    where: { token: hashToken(token) },
  });
}

/**
 * 获取当前登录用户信息
 * 不返回密码等敏感字段
 */
export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, avatar: true },
  });

  if (!user) {
    throw new AppError('用户不存在', 404, 'NOT_FOUND');
  }

  return user;
}

/**
 * 更新个人信息
 */
export async function updateProfile(userId: string, data: { name?: string; avatar?: string }) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.avatar !== undefined) updateData.avatar = data.avatar;

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: { id: true, email: true, name: true, role: true, avatar: true },
  });

  return user;
}

/**
 * 修改密码
 */
export async function changePassword(userId: string, oldPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('用户不存在', 404, 'NOT_FOUND');

  const isValid = await comparePassword(oldPassword, user.password);
  if (!isValid) throw new AppError('原密码错误', 400, 'INVALID_PASSWORD');

  // 防止密码重用
  const isSame = await comparePassword(newPassword, user.password);
  if (isSame) throw new AppError('新密码不能与原密码相同', 400, 'PASSWORD_REUSE');

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return { success: true };
}

/**
 * 忘记密码 — 发送重置码到邮箱
 */
export async function forgotPassword(email: string, captcha: string, captchaId: string): Promise<{ emailSent: boolean }> {
  // 先校验图形验证码
  if (!verifyCaptcha(captchaId, captcha)) {
    throw new AppError('验证码错误或已失效', 400, 'CAPTCHA_INVALID');
  }

  // 检查邮箱是否存在（不暴露结果：不存在也返回成功，防止枚举攻击）
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { emailSent: false }; // 静默处理
  }

  const { code, ok } = createResetCode(email);
  if (!ok) {
    // 冷却期内，返回成功但不重发
    return { emailSent: true };
  }

  await sendResetEmail(email, code);
  return { emailSent: true };
}

/**
 * 重置密码 — 用验证码设置新密码
 */
export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  const result = verifyResetCode(email, code);

  if (result === 'expired') {
    throw new AppError('验证码已过期，请重新获取', 400, 'CODE_EXPIRED');
  }
  if (result === 'max_attempts') {
    throw new AppError('验证码错误次数过多，请重新获取', 400, 'CODE_MAX_ATTEMPTS');
  }
  if (result === 'invalid') {
    throw new AppError('验证码错误', 400, 'CODE_INVALID');
  }

  // 验证码正确，更新密码
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError('用户不存在', 404, 'NOT_FOUND');

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  // 清除该用户所有 Session（强制重新登录）
  await prisma.session.deleteMany({ where: { userId: user.id } });
}
