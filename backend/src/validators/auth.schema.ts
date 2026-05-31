import { z } from 'zod';

/**
 * 注册校验 Schema
 * - email: 合法邮箱格式
 * - password: 至少 6 位
 * - name: 非空，2-20 个字符
 */
export const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少6位'),
  name: z.string().min(2, '姓名至少2个字符').max(20, '姓名不超过20个字符'),
});

/**
 * 登录校验 Schema
 * - email: 合法邮箱格式
 * - password: 非空
 */
export const loginSchema = z.object({
  email: z.string().email('请输入邮箱地址'),
  password: z.string().min(1, '请输入密码'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
