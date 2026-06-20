import { z } from 'zod';

/**
 * 共享密码校验规则
 * - 至少 8 位
 * - 包含字母和数字
 */
const passwordSchema = z.string()
  .min(8, '密码至少8位')
  .regex(/[a-zA-Z]/, '密码必须包含字母')
  .regex(/[0-9]/, '密码必须包含数字');

/**
 * 注册校验 Schema
 */
export const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: passwordSchema,
  name: z.string().min(2, '姓名至少2个字符').max(20, '姓名不超过20个字符'),
  captcha: z.string().min(1, '请输入验证码'),
  captchaId: z.string().min(1, '验证码已失效，请刷新'),
});

/**
 * 登录校验 Schema
 */
export const loginSchema = z.object({
  email: z.string().email('请输入邮箱地址'),
  password: z.string().min(1, '请输入密码'),
  captcha: z.string().min(1, '请输入验证码'),
  captchaId: z.string().min(1, '验证码已失效，请刷新'),
});

/**
 * 忘记密码校验 Schema（发送重置码）
 */
export const forgotPasswordSchema = z.object({
  email: z.string().email('请输入正确的邮箱地址'),
  captcha: z.string().min(1, '请输入验证码'),
  captchaId: z.string().min(1, '验证码已失效'),
});

/**
 * 重置密码校验 Schema
 */
export const resetPasswordSchema = z.object({
  email: z.string().email('请输入正确的邮箱地址'),
  code: z.string().length(6, '验证码为6位数字'),
  newPassword: passwordSchema,
});

/**
 * 修改密码校验 Schema
 */
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, '请输入原密码'),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
