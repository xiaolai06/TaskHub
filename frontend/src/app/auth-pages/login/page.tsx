'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('请输入正确的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(data: LoginForm) {
    setIsSubmitting(true);
    setServerError(null);
    try {
      await login(data.email, data.password);
      toast.success('欢迎回来');
      router.push('/main/dashboard');
    } catch (err) {
      setServerError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : '登录失败，请重试',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* 品牌 */}
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          智汇轻营
        </h1>
        <p className="mt-1.5 text-base text-slate-400">
          TaskHub — 让订单流转更高效
        </p>
      </div>

      {/* 表单 */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {serverError && (
          <div className="animate-in fade-in slide-in-from-top-2 whitespace-pre-line rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 duration-200">
            {serverError}
          </div>
        )}

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
              className="h-11 pl-11 text-base transition-all duration-200 focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:ring-offset-0"
              disabled={isSubmitting}
              {...register('email')}
            />
          </div>
          {errors.email && (
            <p className="animate-in fade-in text-xs text-red-500">{errors.email.message}</p>
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
              placeholder="输入密码"
              autoComplete="current-password"
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

        {/* 按钮 */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full bg-indigo-600 text-base font-semibold text-white shadow-sm shadow-indigo-200/50 transition-all duration-200 hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-200/60 active:scale-[0.98] active:shadow-none disabled:scale-100"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              登录中...
            </>
          ) : (
            '登 录'
          )}
        </Button>
      </form>

      {/* 底部链接 */}
      <div className="text-center">
        <p className="text-sm text-slate-400">
          还没有账号？{' '}
          <Link
            href="/auth-pages/register"
            className="font-medium text-indigo-600 transition-colors duration-150 hover:text-indigo-500"
          >
            立即注册
          </Link>
        </p>
      </div>
    </div>
  );
}
