'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff, Mail, Lock, ShieldCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiError, getFriendlyMessage } from '@/lib/api';
import { getCachedCaptcha, setCachedCaptcha, clearCachedCaptcha } from '@/lib/captcha-cache';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().min(1, '请输入邮箱').email('请输入正确的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
  captcha: z.string().min(1, '请输入验证码'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 验证码状态（优先从跨页面缓存读取，避免切换页面时重新加载）
  const cached = getCachedCaptcha();
  const [captchaId, setCaptchaId] = useState(cached?.captchaId ?? '');
  const [captchaSvg, setCaptchaSvg] = useState(cached?.svg ?? '');
  const [captchaLoading, setCaptchaLoading] = useState(!cached);
  const captchaAbort = useRef<AbortController | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', captcha: '' },
  });

  /** 获取验证码（快速点击时取消旧请求） */
  const fetchCaptcha = useCallback(async () => {
    captchaAbort.current?.abort();
    const ctrl = new AbortController();
    captchaAbort.current = ctrl;
    setCaptchaLoading(true);
    try {
      const data = await api.get<{ captchaId: string; svg: string }>('/auth/captcha', { signal: ctrl.signal });
      // 只有当前控制器还是最新时才更新——防止旧请求的结果覆盖新验证码
      if (captchaAbort.current === ctrl) {
        setCaptchaId(data.captchaId);
        setCaptchaSvg(data.svg);
        setValue('captcha', '');
        setCachedCaptcha(data.captchaId, data.svg);
      }
    } catch (err: unknown) {
      // AbortError 是用户主动取消，静默忽略
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        toast.error('验证码加载失败，请点击图片刷新');
      }
    } finally {
      // 必须无条件重置，否则快速连续 abort 会导致 loading 永远卡在 true
      if (captchaAbort.current === ctrl) setCaptchaLoading(false);
    }
  }, [setValue]);

  // 页面加载时获取验证码（缓存命中则跳过）
  useEffect(() => {
    if (!getCachedCaptcha()) fetchCaptcha();
    return () => captchaAbort.current?.abort();
  }, [fetchCaptcha]);

  async function onSubmit(data: LoginForm) {
    setIsSubmitting(true);
    try {
      await login(data.email, data.password, data.captcha, captchaId);
      toast.success('欢迎回来');
      router.push('/main/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        const message = getFriendlyMessage(err.code, err.message);
        toast.error(message);
        // 验证码相关错误 → 自动刷新验证码
        if (err.code === 'CAPTCHA_INVALID') {
          clearCachedCaptcha();
          fetchCaptcha();
        }
      } else if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error('登录失败，请重试');
      }
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

        {/* 验证码 */}
        <div className="space-y-2">
          <label htmlFor="captcha" className="text-sm font-medium text-slate-700">
            验证码
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <ShieldCheck className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                id="captcha"
                type="text"
                placeholder="输入验证码"
                autoComplete="off"
                aria-invalid={!!errors.captcha}
                className="h-11 pl-11 text-base transition-all duration-200 focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:ring-offset-0"
                disabled={isSubmitting}
                maxLength={4}
                {...register('captcha')}
              />
            </div>
            <button
              type="button"
              onClick={fetchCaptcha}
              disabled={captchaLoading || isSubmitting}
              className="group relative h-11 w-[130px] flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition-all duration-200 hover:border-indigo-300 hover:shadow-sm disabled:opacity-50"
              aria-label="点击刷新验证码"
            >
              {captchaSvg ? (
                <div
                  className="flex h-full w-full items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: captchaSvg }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <RefreshCw className="h-4 w-4 text-indigo-600" />
              </div>
            </button>
          </div>
          {errors.captcha && (
            <p className="animate-in fade-in text-xs text-red-500">{errors.captcha.message}</p>
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
      <div className="space-y-3 text-center">
        <Link
          href="/auth-pages/forgot-password"
          className="block text-sm font-medium text-slate-500 transition-colors duration-150 hover:text-indigo-600"
        >
          忘记密码？
        </Link>
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
