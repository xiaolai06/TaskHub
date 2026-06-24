'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff, Send } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

export function EmailTab() {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('465');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [from, setFrom] = useState('');
  const [secure, setSecure] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    api.get<Record<string, string>>('/settings/email')
      .then((res) => {
        if (res.smtp_host) setHost(res.smtp_host);
        if (res.smtp_port) setPort(res.smtp_port);
        if (res.smtp_user) setUser(res.smtp_user);
        if (res.smtp_pass && res.smtp_pass !== '***') setPass(res.smtp_pass);
        if (res.smtp_from) setFrom(res.smtp_from);
        if (res.smtp_secure !== undefined) setSecure(res.smtp_secure === 'true' || res.smtp_secure === '1');
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.post('/settings/batch', {
        settings: [
          { category: 'EMAIL', key: 'smtp_host', value: host },
          { category: 'EMAIL', key: 'smtp_port', value: port },
          { category: 'EMAIL', key: 'smtp_user', value: user },
          { category: 'EMAIL', key: 'smtp_pass', value: pass, encrypted: true },
          { category: 'EMAIL', key: 'smtp_from', value: from || user },
          { category: 'EMAIL', key: 'smtp_secure', value: String(secure) },
        ],
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  }

  async function handleTestSend() {
    if (!testTo.trim() || !testTo.includes('@')) return;
    setTesting(true);
    setTestResult(null);
    try {
      await api.post('/settings/email/test', { to: testTo.trim() });
      setTestResult({ success: true, message: `发送成功！请检查收件箱 ${testTo}` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '发送失败，请检查 SMTP 配置';
      setTestResult({ success: false, message: msg });
    } finally { setTesting(false); }
  }

  const canSave = host && user && pass;
  const canTest = canSave && testTo.trim().includes('@');

  const portPresets = [
    { value: '465', label: '465 (SSL)' },
    { value: '587', label: '587 (STARTTLS)' },
    { value: '25', label: '25 (不加密)' },
  ];

  const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60';
  const selectCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60 bg-card';

  return (
    <div className="space-y-5">
      {/* 配置指南（折叠） */}
      <button onClick={() => setShowGuide(!showGuide)}
        className="flex w-full items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-left text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:border-indigo-800/50 dark:bg-indigo-950/20 dark:text-indigo-400 dark:hover:bg-indigo-950/30">
        <span>📧</span>
        <span className="flex-1">如何获取 SMTP 授权码？（QQ / 163 / Gmail）</span>
        <span className="text-indigo-400">{showGuide ? '▲' : '▼'}</span>
      </button>
      {showGuide && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 px-4 py-3 dark:border-indigo-800/50 dark:bg-indigo-950/20">
          <div className="space-y-1.5 text-xs leading-relaxed text-indigo-600/80 dark:text-indigo-400/70">
            <p><b>QQ 邮箱：</b>登录 mail.qq.com → 设置 → 账户 → POP3/SMTP 服务 → 开启 → 生成授权码</p>
            <p><b>163 邮箱：</b>登录 mail.163.com → 设置 → POP3/SMTP/IMAP → 开启 SMTP → 设置授权码</p>
            <p><b>Gmail：</b>需开启两步验证 → Google 账号 → 应用专用密码 → 生成密码</p>
            <p className="pt-1 text-indigo-500">⚠️ 密码栏填写的是<b>授权码</b>，不是邮箱登录密码。配置保存后可发送到<b>任意邮箱</b>。</p>
          </div>
        </div>
      )}

      {/* SMTP 服务器 + 端口 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground/70">SMTP 服务器</label>
          <input type="text" value={host} onChange={(e) => setHost(e.target.value)}
            placeholder="smtp.qq.com" className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground/70">端口</label>
          <Select value={port} onValueChange={(v) => {
            setPort(v || '465');
            setSecure((v || '465') === '465');
          }}>
            <SelectTrigger className={cn(selectCls, "w-full")}><SelectValue placeholder="选择端口" /></SelectTrigger>
            <SelectContent>
              {portPresets.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 用户名 + 密码 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground/70">邮箱账号</label>
          <input type="text" value={user} onChange={(e) => setUser(e.target.value)}
            placeholder="your@qq.com" className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground/70">授权码</label>
          <div className="relative">
            <input type={showPass ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)}
              placeholder="在邮箱设置中获取" className={cn(inputCls, 'pr-9')} />
            <button onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* 发件人 + SSL */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground/70">
            发件人地址
            <span className="ml-1 font-normal text-muted-foreground">（留空则用邮箱账号）</span>
          </label>
          <input type="email" value={from} onChange={(e) => setFrom(e.target.value)}
            placeholder="noreply@your.com" className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground/70">加密方式</label>
          <div className="flex h-10 items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-foreground/70">
              <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)}
                className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500" />
              SSL/TLS
            </label>
            <span className="text-xs text-muted-foreground">
              {secure ? '端口 465' : '端口 587/25'}
            </span>
          </div>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
          <CheckCircle className="h-4 w-4" />配置已保存到数据库
        </div>
      )}

      <button onClick={handleSave} disabled={saving || !canSave}
        className="flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
        保存配置
      </button>

      {/* 测试发送 */}
      <div className="border-t border-border pt-5">
        <h3 className="mb-1 text-sm font-semibold text-foreground/80">测试发送</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          填写上方配置并保存后，在此输入<b>任意收件邮箱</b>（QQ、163、Gmail 等均可），验证能否正常发送。
        </p>
        <div className="flex gap-2">
          <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canTest) handleTestSend(); }}
            placeholder="收件邮箱地址（可以发给任何人）" className={cn(inputCls, 'flex-1')} />
          <button onClick={handleTestSend} disabled={testing || !canTest}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            发送测试
          </button>
        </div>
        {!canSave && (
          <p className="mt-2 text-xs text-amber-500">请先填写 SMTP 服务器、邮箱账号和授权码</p>
        )}
        {canSave && !testTo.trim() && (
          <p className="mt-2 text-xs text-muted-foreground">↑ 输入收件邮箱地址后，按钮即可点击</p>
        )}
        {testResult && (
          <div className={cn('mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
            testResult.success ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400')}>
            {testResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
