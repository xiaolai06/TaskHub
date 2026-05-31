import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from '../utils/hash';
import { generateToken } from '../utils/jwt';
import { ConflictError, UnauthorizedError, NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

/** 用户注册 */
export async function register(email: string, password: string, name: string) {
  // 检查邮箱是否已注册
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('该邮箱已注册');
  }

  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name },
  });

  // 创建会话
  const token = generateToken({ userId: user.id, email: user.email, role: user.role });
  await prisma.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 天
    },
  });

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token,
  };
}

/** 用户登录 */
export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError('邮箱或密码错误');
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    throw new UnauthorizedError('邮箱或密码错误');
  }

  const token = generateToken({ userId: user.id, email: user.email, role: user.role });
  await prisma.session.create({
    data: {
      userId: user.id,
      token,
      device: 'unknown',
      ip: 'unknown',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token,
  };
}

/** 登出 */
export async function logout(token: string) {
  await prisma.session.deleteMany({ where: { token } });
}

/** 获取当前用户信息 */
export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, avatar: true, createdAt: true },
  });

  if (!user) {
    throw new NotFoundError('用户');
  }

  return user;
}
