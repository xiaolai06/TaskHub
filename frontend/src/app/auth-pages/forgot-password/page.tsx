'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, ShieldCheck, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, ApiError, getFriendlyMessage } from '@/lib/api';
import { getCachedCaptcha, setCachedCaptcha, clearCachedCaptcha } from '@/lib/captcha-cache';
import { toast } from 'sonner';

const schema = z.object({
  email: z.string().min(1, '请输入邮箱').email('请输入正确的邮箱地址'),
  captcha: z.string().min(1, '请输入验证码'),
});

type Form = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 验证码状态（优先从跨页面缓存读取）
  const cached = getCachedCaptcha();
  const [captchaId, setCaptchaId] = useState(cached?.captchaId ?? '');
  const [captchaSvg, setCaptchaSvg] = useState(cached?.svg ?? '');
  const [captchaLoading, setCaptchaLoading] = useState(!cached);
  const captchaAbort = useRef<AbortController | null>(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', captcha: '' },
  });

  /** 获取验证码（快速点击时取消旧请求） */
  const fetchCaptcha = useCallback(async () => {
    captchaAbort.current?.abort();
    const ctrl = new AbortController();
    captchaAbort.current = ctrl;
    setCaptchaLoading(true);
    try {
      const data = await api.get<{ captchaId: string; svg: string }>('/auth/captcha', { signal: ctrl.signal });
      if (captchaAbort.current === ctrl) {
        setCaptchaId(data.captchaId);
        setCaptchaSvg(data.svg);
        setValue('captcha', '');
        setCachedCaptcha(data.captchaId, data.svg);
      }
    } catch (err: unknown) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        toast.error('验证码加载失败，请点击图片刷新');
      }
    } finally {
      if (captchaAbort.current === ctrl) setCaptchaLoading(false);
    }
  }, [setValue]);

  useEffect(() => {
    if (!getCachedCaptcha()) fetchCaptcha();
    return () => captchaAbort.current?.abort();
  }, [fetchCaptcha]);

  async function onSubmit(data: Form) {
    setIsSubmitting(true);
    try {
      await api.post('/auth/forgot-password', {
        email: data.email,
        captcha: data.captcha,
        captchaId,
      });
      toast.success('验证码已发送到你的邮箱');
      router.push(`/auth-pages/reset-password?email=${encodeURIComponent(data.email)}`);
    } catch (err) {
      if (err instanceof ApiError) {
        const message = getFriendlyMessage(err.code, err.message);
        toast.error(message);
        if (err.code === 'CAPTCHA_INVALID') {
          clearCachedCaptcha();
          fetchCaptcha();
        }
      } else if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error('发送失败，请重试');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">忘记密码</h1>
        <p className="mt-1.5 text-base text-slate-400">
          输入注册邮箱，我们将发送重置验证码
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-slate-700">邮箱</label>
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
          {errors.email && <p className="animate-in fade-in text-xs text-red-500">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="captcha" className="text-sm font-medium text-slate-700">验证码</label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <ShieldCheck className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                id="captcha"
                type="text"
                placeholder="输入图形验证码"
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
            >
              {captchaSvg ? (
                <div className="flex h-full w-full items-center justify-center" dangerouslySetInnerHTML={{ __html: captchaSvg }} />
              ) : (
                <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <RefreshCw className="h-4 w-4 text-indigo-600" />
              </div>
            </button>
          </div>
          {errors.captcha && <p className="animate-in fade-in text-xs text-red-500">{errors.captcha.message}</p>}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full bg-indigo-600 text-base font-semibold text-white shadow-sm shadow-indigo-200/50 transition-all duration-200 hover:bg-indigo-700 hover:shadow-md active:scale-[0.98] disabled:scale-100"
        >
          {isSubmitting ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" />发送中...</>) : '发送重置验证码'}
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
