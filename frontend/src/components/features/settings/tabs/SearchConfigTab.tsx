'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff, Wifi, Search, Globe } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

interface SearchConfig {
  topic?: string;
  depth?: string;
  maxResults?: number;
  timeRange?: string;
  startDate?: string;
  endDate?: string;
  includeRaw?: string;
  chunksPerSource?: number;
  country?: string;
  includeDomains?: string;
  excludeDomains?: string;
}

export function SearchConfigTab() {
  const [provider, setProvider] = useState('none');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [phToken, setPhToken] = useState('');
  const [showPh, setShowPh] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [proxyUrl, setProxyUrl] = useState('');
  const [proxyTesting, setProxyTesting] = useState(false);
  const [proxyResult, setProxyResult] = useState<{ success: boolean; message: string; ip?: string } | null>(null);

  const [extTesting, setExtTesting] = useState(false);
  const [extResult, setExtResult] = useState<{ success: boolean; message: string } | null>(null);

  const [searxngUrl, setSearxngUrl] = useState('');
  const [searxngTesting, setSearxngTesting] = useState(false);
  const [searxngResult, setSearxngResult] = useState<{ success: boolean; message: string; latency?: number; resultCount?: number } | null>(null);

  const [cfg, setCfg] = useState<SearchConfig>({
    topic: 'general', depth: 'basic', maxResults: 5,
    timeRange: 'none', includeRaw: 'none', chunksPerSource: 3,
    country: 'none', includeDomains: '', excludeDomains: '',
  });

  useEffect(() => {
    api.get<Record<string, string>>('/settings/search')
      .then((res) => {
        if (res.provider) setProvider(res.provider);
        if (res.api_key && res.api_key !== '***') setApiKey(res.api_key);
        if (res.producthunt_token && res.producthunt_token !== '***') setPhToken(res.producthunt_token);
        if (res.config) {
          try { setCfg(prev => ({ ...prev, ...JSON.parse(res.config) })); } catch {}
        }
        if (res.searxng_url) setSearxngUrl(res.searxng_url);
      })
      .catch(() => {});
    api.get<Record<string, string>>('/settings/network')
      .then((res) => { if (res.proxy_url) setProxyUrl(res.proxy_url); })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.post('/settings/batch', {
        settings: [
          { category: 'SEARCH', key: 'provider', value: provider },
          { category: 'SEARCH', key: 'api_key', value: apiKey || '', encrypted: true },
          { category: 'SEARCH', key: 'config', value: JSON.stringify(cfg) },
          { category: 'SEARCH', key: 'producthunt_token', value: phToken || '', encrypted: true },
          { category: 'SEARCH', key: 'searxng_url', value: searxngUrl || '' },
          { category: 'NETWORK', key: 'proxy_url', value: proxyUrl || '' },
        ],
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  }

  async function handleProxyTest() {
    if (!proxyUrl.trim()) return;
    setProxyTesting(true);
    setProxyResult(null);
    try {
      const res = await api.post<{ success: boolean; message: string; ip?: string }>(
        '/settings/proxy/test', { url: proxyUrl.trim() },
      );
      setProxyResult(res);
      setTimeout(() => setProxyResult(null), 3000);
    } catch {
      setProxyResult({ success: false, message: '测试请求失败' });
      setTimeout(() => setProxyResult(null), 3000);
    } finally { setProxyTesting(false); }
  }

  async function handleExtTest() {
    setExtTesting(true);
    setExtResult(null);
    try {
      await fetch('https://connectivitycheck.platform.hicloud.com/generate_204', {
        signal: AbortSignal.timeout(5000), mode: 'no-cors',
      });
      setExtResult({ success: true, message: '外网连接正常' });
      setTimeout(() => setExtResult(null), 3000);
    } catch {
      setExtResult({ success: false, message: '直连失败，需要代理才能访问外部网络' });
      setTimeout(() => setExtResult(null), 3000);
    } finally { setExtTesting(false); }
  }

  async function handleSearXNGTest() {
    if (!searxngUrl.trim()) return;
    setSearxngTesting(true);
    setSearxngResult(null);
    try {
      const res = await api.post<{ success: boolean; message: string; latency?: number; resultCount?: number }>(
        '/settings/searxng/test', { url: searxngUrl.trim() },
      );
      setSearxngResult(res);
      setTimeout(() => setSearxngResult(null), 3000);
    } catch {
      setSearxngResult({ success: false, message: '测试请求失败' });
      setTimeout(() => setSearxngResult(null), 3000);
    } finally { setSearxngTesting(false); }
  }

  const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60';
  const selectCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60 bg-card';

  return (
    <div className="space-y-5">
      {/* 供应商 + Key */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground/70">搜索供应商</label>
          <Select value={provider} onValueChange={(v) => setProvider(v || 'none')}>
            <SelectTrigger className={cn(selectCls, "w-full")}><SelectValue placeholder="选择搜索供应商" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">不使用联网搜索</SelectItem>
              <SelectItem value="tavily">Tavily (推荐)</SelectItem>
              <SelectItem value="serpapi">SerpAPI (Google)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {provider !== 'none' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground/70">API Key</label>
            <div className="relative">
              <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider === 'tavily' ? 'tvly-xxxx' : 'serpapi key'} className={cn(inputCls, 'pr-8')} />
              <button onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {provider !== 'none' && (
        <>
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">搜索参数</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/70">搜索主题</label>
                <Select value={cfg.topic || 'general'} onValueChange={v => setCfg(p => ({ ...p, topic: v || 'general' }))}>
                  <SelectTrigger className={cn(selectCls, "w-full")}><SelectValue placeholder="选择主题" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">通用</SelectItem>
                    <SelectItem value="news">新闻</SelectItem>
                    <SelectItem value="finance">财经</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/70">搜索深度</label>
                <Select value={cfg.depth || 'basic'} onValueChange={v => setCfg(p => ({ ...p, depth: v || 'basic' }))}>
                  <SelectTrigger className={cn(selectCls, "w-full")}><SelectValue placeholder="选择深度" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">基础</SelectItem>
                    <SelectItem value="advanced">高级</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/70">最大结果数</label>
                <Select value={String(cfg.maxResults || 5)} onValueChange={v => setCfg(p => ({ ...p, maxResults: +(v || "5") || 5 }))}>
                  <SelectTrigger className={cn(selectCls, "w-full")}><SelectValue placeholder="选择数量" /></SelectTrigger>
                  <SelectContent>
                    {[3, 5, 8, 10, 14, 20].map(n => <SelectItem key={n} value={String(n)}>{n} 条</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/70">时间范围</label>
                <Select value={cfg.timeRange || 'none'} onValueChange={v => setCfg(p => ({ ...p, timeRange: v || 'none' }))}>
                  <SelectTrigger className={cn(selectCls, "w-full")}><SelectValue placeholder="选择时间范围" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不限</SelectItem>
                    <SelectItem value="day">24小时</SelectItem>
                    <SelectItem value="week">一周</SelectItem>
                    <SelectItem value="month">一月</SelectItem>
                    <SelectItem value="year">一年</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/70">国家/地区</label>
                <Select value={cfg.country || 'none'} onValueChange={v => setCfg(p => ({ ...p, country: v || 'none' }))}>
                  <SelectTrigger className={cn(selectCls, "w-full")}><SelectValue placeholder="选择地区" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不限</SelectItem>
                    <SelectItem value="cn">中国</SelectItem>
                    <SelectItem value="us">美国</SelectItem>
                    <SelectItem value="jp">日本</SelectItem>
                    <SelectItem value="sg">新加坡</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/70">原始内容</label>
                <Select value={cfg.includeRaw || 'none'} onValueChange={v => setCfg(p => ({ ...p, includeRaw: v || 'none' }))}>
                  <SelectTrigger className={cn(selectCls, "w-full")}><SelectValue placeholder="选择格式" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不包含</SelectItem>
                    <SelectItem value="text">纯文本</SelectItem>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/70">包含域名（每行一个）</label>
                <textarea rows={2} value={cfg.includeDomains || ''} onChange={e => setCfg(p => ({ ...p, includeDomains: e.target.value }))}
                  placeholder="github.com&#10;zhihu.com" className={cn(inputCls, 'text-2xs-plus')} />
                <p className="mt-0.5 text-2xs text-muted-foreground">搜索结果仅限于这些网站</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/70">排除域名（每行一个）</label>
                <textarea rows={2} value={cfg.excludeDomains || ''} onChange={e => setCfg(p => ({ ...p, excludeDomains: e.target.value }))}
                  placeholder="zhihu.com&#10;csdn.net" className={cn(inputCls, 'text-2xs-plus')} />
                <p className="mt-0.5 text-2xs text-muted-foreground">搜索结果中排除这些网站</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Product Hunt Token */}
      <div className="border-t border-border pt-4">
        <label className="mb-1 block text-xs font-medium text-foreground/70">
          Product Hunt Token
          <span className="ml-1 font-normal text-muted-foreground">（可选，免费申请）</span>
        </label>
        <div className="relative mt-1">
          <input type={showPh ? 'text' : 'password'} value={phToken} onChange={e => setPhToken(e.target.value)}
            placeholder="ph_xxxxxxxxxx" className={cn(inputCls, 'pr-8')} />
          <button onClick={() => setShowPh(!showPh)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showPh ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-0.5 text-2xs text-muted-foreground">
          在 producthunt.com → Settings → API 免费申请，每天 100 次请求
        </p>
      </div>

      {/* SearXNG */}
      <div className="border-t border-border pt-4">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">SearXNG 自托管搜索</h3>
        <p className="mb-3 text-2xs-plus text-muted-foreground">
          聚合 Google / Bing / DuckDuckGo / 百度等多个引擎，质量最高。
          <a href="https://docs.searxng.org/" target="_blank" rel="noopener" className="ml-1 text-indigo-500 hover:underline">部署文档</a>
        </p>

        <div className="flex gap-2">
          <input type="text" value={searxngUrl} onChange={e => { setSearxngUrl(e.target.value); setSearxngResult(null); }}
            placeholder="http://localhost:8080" className={cn(inputCls, 'flex-1')} />
          <button onClick={handleSearXNGTest} disabled={searxngTesting || !searxngUrl.trim()}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground/70 transition-all hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">
            {searxngTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            测试连接
          </button>
        </div>

        {searxngResult && (
          <div className={cn('mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
            searxngResult.success ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400')}>
            {searxngResult.success ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {searxngResult.message}
            {searxngResult.latency ? ` (${searxngResult.latency}ms)` : ''}
            {searxngResult.resultCount ? ` — ${searxngResult.resultCount} 条结果` : ''}
          </div>
        )}

        {!searxngUrl && (
          <p className="mt-2 text-2xs text-muted-foreground">
            快速部署: <code className="rounded bg-muted px-1 py-0.5">docker run -d --name searxng -p 8080:8080 searxng/searxng</code>
          </p>
        )}
      </div>

      {/* 网络代理 */}
      <div className="border-t border-border pt-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">网络代理（可选）</h3>
        <p className="mb-3 text-2xs-plus text-muted-foreground">
          配置代理后，DuckDuckGo 和 Google News 等被墙的搜索源会自动通过代理访问。
        </p>

        <div className="flex gap-2">
          <input type="text" value={proxyUrl} onChange={e => { setProxyUrl(e.target.value); setProxyResult(null); }}
            placeholder="http://127.0.0.1:7890" className={cn(inputCls, 'flex-1')} />
          <button onClick={handleProxyTest} disabled={proxyTesting || !proxyUrl.trim()}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground/70 transition-all hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">
            {proxyTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
            测试代理
          </button>
          <button onClick={handleExtTest} disabled={extTesting}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground/70 transition-all hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            title="测试本机是否能直连外部网络">
            {extTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
            测试外网
          </button>
        </div>

        {proxyResult && (
          <div className={cn('mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
            proxyResult.success ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400')}>
            {proxyResult.success ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {proxyResult.message}{proxyResult.ip ? ` (出口 IP: ${proxyResult.ip})` : ''}
          </div>
        )}
        {extResult && (
          <div className={cn('mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
            extResult.success ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400')}>
            {extResult.success ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {extResult.message}
          </div>
        )}
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
          <CheckCircle className="h-4 w-4" />配置已保存
        </div>
      )}

      <button onClick={handleSave} disabled={saving}
        className="flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
        保存配置
      </button>
    </div>
  );
}
