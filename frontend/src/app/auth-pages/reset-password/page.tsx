'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Eye, EyeOff, Lock, KeyRound, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, ApiError, getFriendlyMessage } from '@/lib/api';
import { toast } from 'sonner';

const schema = z.object({
  code: z.string().length(6, '验证码为6位数字').regex(/^\d+$/, '验证码只能包含数字'),
  newPassword: z.string()
    .min(8, '密码至少8位')
    .regex(/[a-zA-Z]/, '密码必须包含字母')
    .regex(/[0-9]/, '密码必须包含数字'),
  confirmPassword: z.string().min(1, '请确认密码'),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword'],
});

type Form = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { code: '', newPassword: '', confirmPassword: '' },
  });

  // 重发倒计时
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // 页面加载时启动 60 秒冷却
  useEffect(() => { setCooldown(60); }, []);

  async function handleResend() {
    if (!email || resending) return;
    setResending(true);
    try {
      await api.post('/auth/resend-reset-code', { email });
      toast.success('验证码已重新发送到你的邮箱');
      setCooldown(60);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(getFriendlyMessage(err.code, err.message));
      } else {
        toast.error('发送失败，请稍后再试');
      }
    } finally {
      setResending(false);
    }
  }

  async function onSubmit(data: Form) {
    if (!email) {
      toast.error('缺少邮箱参数，请从忘记密码页面重新操作');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/auth/reset-password', {
        email,
        code: data.code,
        newPassword: data.newPassword,
      });
      toast.success('密码重置成功，请重新登录');
      router.push('/auth-pages/login');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(getFriendlyMessage(err.code, err.message));
      } else if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error('重置失败，请重试');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!email) {
    return (
      <div className="space-y-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900">缺少邮箱信息</h1>
        <p className="text-sm text-slate-500">请从忘记密码页面重新操作</p>
        <Link href="/auth-pages/forgot-password" className="inline-block text-sm font-medium text-indigo-600 hover:underline">
          前往忘记密码
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">重置密码</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          验证码已发送至 <span className="font-medium text-slate-600">{email}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* 邮箱验证码 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="code" className="text-sm font-medium text-slate-700">邮箱验证码</label>
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
              className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-500 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {resending ? '发送中...' : cooldown > 0 ? `${cooldown} 秒后可重发` : '重新发送'}
            </button>
          </div>
          <div className="relative">
            <KeyRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="code"
              type="text"
              placeholder="输入6位验证码"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              aria-invalid={!!errors.code}
              className="h-11 pl-11 text-center text-lg tracking-[0.3em] font-mono transition-all duration-200 focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:ring-offset-0"
              disabled={isSubmitting}
              {...register('code')}
            />
          </div>
          {errors.code && <p className="animate-in fade-in text-xs text-red-500">{errors.code.message}</p>}
        </div>

        {/* 新密码 */}
        <div className="space-y-2">
          <label htmlFor="newPassword" className="text-sm font-medium text-slate-700">新密码</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="至少8位，含字母和数字"
              autoComplete="new-password"
              aria-invalid={!!errors.newPassword}
              className="h-11 pl-11 pr-11 text-base transition-all duration-200 focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:ring-offset-0"
              disabled={isSubmitting}
              {...register('newPassword')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors duration-150 hover:text-slate-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.newPassword && <p className="animate-in fade-in text-xs text-red-500">{errors.newPassword.message}</p>}
        </div>

        {/* 确认密码 */}
        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">确认密码</label>
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
          {errors.confirmPassword && <p className="animate-in fade-in text-xs text-red-500">{errors.confirmPassword.message}</p>}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full bg-indigo-600 text-base font-semibold text-white shadow-sm shadow-indigo-200/50 transition-all duration-200 hover:bg-indigo-700 hover:shadow-md active:scale-[0.98] disabled:scale-100"
        >
          {isSubmitting ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" />重置中...</>) : '重置密码'}
        </Button>
      </form>

      <div className="text-center">
        <Link
          href="/auth-pages/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-150 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          返回登录
        </Link>
      </div>
    </div>
  );
}
