import { Request } from 'express';
import { prisma } from '../server';
import { hashPassword, comparePassword } from '../utils/hash';
import { generateToken } from '../utils/jwt';
import { AppError } from '../utils/errors';

/** JWT 有效期：7 天（毫秒） */
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 内部工具：签发 JWT + 写入 Session 记录
 * 每个设备独立签发 Token，Session 表记录登录设备信息
 */
async function createSession(userId: string, email: string, role: string, req: Request): Promise<string> {
  const token = generateToken({ userId, email, role });

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
      device: req.headers['user-agent']?.slice(0, 255) || 'unknown',
      ip: req.ip || req.socket.remoteAddress || 'unknown',
    },
  });

  return token;
}

/**
 * 用户注册
 * 1. 检查邮箱唯一性
 * 2. bcrypt 加密密码
 * 3. 创建用户 + 自动签发 Token（注册后免登录）
 */
export async function register(email: string, password: string, name: string, req: Request) {
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
 * 1. 根据邮箱查找用户
 * 2. bcrypt 比对密码
 * 3. 签发 JWT + 创建 Session 记录
 */
export async function login(email: string, password: string, req: Request) {
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
 * 根据 Token 删除 Session 记录
 */
export async function logout(token: string): Promise<void> {
  if (!token) return;

  await prisma.session.deleteMany({
    where: { token },
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

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return { success: true };
}
