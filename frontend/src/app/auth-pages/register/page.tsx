'use client';

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff, Mail, Lock, User, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiError } from '@/lib/api';
import { toast } from 'sonner';

const registerSchema = z
  .object({
    name: z.string().min(2, '姓名至少2个字符').max(20, '姓名不超过20个字符'),
    email: z.string().min(1, '请输入邮箱').email('请输入正确的邮箱地址（如 name@example.com）'),
    password: z.string().min(6, '密码至少6位'),
    confirmPassword: z.string().min(1, '请确认密码'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 邮箱可用性检查状态：null=未检查, true=可用, false=已注册
  const [emailStatus, setEmailStatus] = useState<boolean | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  /** 邮箱失焦时检查是否已注册 */
  const checkEmail = useCallback(async (email: string) => {
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) { setEmailStatus(null); return; }
    setEmailChecking(true);
    try {
      await api.post('/auth/register', { email, password: '__check_only__', name: '__check__' });
      // 不应该走到这里（密码太短会被校验拦截），但以防万一
      setEmailStatus(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_EXISTS') {
        setEmailStatus(false);
      } else {
        // 其他错误（如密码校验）说明邮箱本身没问题
        setEmailStatus(true);
      }
    } finally {
      setEmailChecking(false);
    }
  }, []);

  async function onSubmit(data: RegisterForm) {
    if (emailStatus === false) {
      toast.error('该邮箱已被注册，请使用其他邮箱或直接登录');
      return;
    }
    setIsSubmitting(true);
    try {
      await registerUser(data.email, data.password, data.name);
      toast.success('注册成功');
      router.push('/main/dashboard');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message
        : err instanceof Error ? err.message
        : '注册失败，请重试';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* 品牌 */}
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          创建账号
        </h1>
        <p className="mt-1.5 text-base text-slate-400">
          开始你的智能项目管理之旅
        </p>
      </div>

      {/* 表单 */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* 姓名 */}
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-slate-700">
            姓名
          </label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="name"
              type="text"
              placeholder="你的名字"
              autoComplete="name"
              aria-invalid={!!errors.name}
              className="h-11 pl-11 text-base transition-all duration-200 focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:ring-offset-0"
              disabled={isSubmitting}
              {...register('name')}
            />
          </div>
          {errors.name && (
            <p className="animate-in fade-in text-xs text-red-500">{errors.name.message}</p>
          )}
        </div>

        {/* 邮箱 */}
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-slate-700">
            邮箱
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              autoComplete="email"
              aria-invalid={!!errors.email}
              className="h-11 pl-11 pr-10 text-base transition-all duration-200 focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:ring-offset-0"
              disabled={isSubmitting}
              {...register('email', {
                onBlur: (e) => checkEmail(e.target.value),
              })}
            />
            {/* 邮箱可用性状态指示 */}
            {emailChecking && (
              <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
            )}
            {!emailChecking && emailStatus === true && (
              <CheckCircle2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
            )}
            {!emailChecking && emailStatus === false && (
              <XCircle className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-red-500" />
            )}
          </div>
          {errors.email && (
            <p className="animate-in fade-in text-xs text-red-500">{errors.email.message}</p>
          )}
          {!errors.email && emailStatus === false && (
            <p className="animate-in fade-in text-xs text-red-500">该邮箱已被注册，直接登录或使用其他邮箱</p>
          )}
          {!errors.email && emailStatus === true && (
            <p className="animate-in fade-in text-xs text-green-600">邮箱可用</p>
          )}
        </div>

        {/* 密码 */}
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-slate-700">
            密码
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="至少6位"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              className="h-11 pl-11 pr-11 text-base transition-all duration-200 focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:ring-offset-0"
              disabled={isSubmitting}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors duration-150 hover:text-slate-600"
              tabIndex={-1}
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="animate-in fade-in text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        {/* 确认密码 */}
        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
            确认密码
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="再次输入密码"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              className="h-11 pl-11 text-base transition-all duration-200 focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:ring-offset-0"
              disabled={isSubmitting}
              {...register('confirmPassword')}
            />
          </div>
          {errors.confirmPassword && (
            <p className="animate-in fade-in text-xs text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* 按钮 */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 h-11 w-full bg-indigo-600 text-base font-semibold text-white shadow-sm shadow-indigo-200/50 transition-all duration-200 hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-200/60 active:scale-[0.98] active:shadow-none disabled:scale-100"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              注册中...
            </>
          ) : (
            '注 册'
          )}
        </Button>
      </form>

      {/* 底部链接 */}
      <div className="text-center">
        <p className="text-sm text-slate-400">
          已有账号？{' '}
          <Link
            href="/auth-pages/login"
            className="font-medium text-indigo-600 transition-colors duration-150 hover:text-indigo-500"
          >
            立即登录
          </Link>
        </p>
      </div>
    </div>
  );
}
