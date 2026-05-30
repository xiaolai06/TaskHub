import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// TODO: register(email, password, name) - 用户注册
// TODO: login(email, password) - 用户登录，返回 JWT
// TODO: logout(token) - 登出，删除 session
// TODO: getMe(userId) - 获取当前用户信息
// TODO: createSession(userId, device, ip) - 创建会话
// TODO: validateSession(token) - 验证会话有效性
