'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Loader2, CheckCircle, AlertCircle, Bot, Link, Shield, Database,
  Eye, EyeOff, Wifi, Trash2, Download, LogOut, Smartphone, Search, Plus,
} from 'lucide-react';

// ========== 类型 ==========

type TabKey = 'ai' | 'search' | 'integration' | 'security' | 'data';

interface Session {
  id: string;
  device: string;
  ip: string;
  createdAt: string;
  expiresAt: string;
}

interface AIModel {
  id: string;
  name: string;
  tier: string;
}

// ========== 常量 ==========

const providers = [
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'ollama', label: 'Ollama (本地)' },
];

// ========== AI 配置 ==========

// ========== 常量 ==========

interface ProviderInfo {
  name: string;
  label: string;
  baseUrl: string;
  apiKey: string;
}

// ========== AI 配置 ==========

function AIConfig() {
  // 供应商管理
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [powerfulModel, setPowerfulModel] = useState('');
  const [models, setModels] = useState<AIModel[]>([]);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; modelCount?: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchMsg, setFetchMsg] = useState('');

  // 自定义供应商弹窗
  const [addProviderOpen, setAddProviderOpen] = useState(false);
  const [newPName, setNewPName] = useState('');
  const [newPLabel, setNewPLabel] = useState('');
  const [newPUrl, setNewPUrl] = useState('');
  const [newPKey, setNewPKey] = useState('');

  // 加载供应商列表
  useEffect(() => {
    api.get<ProviderInfo[]>('/settings/ai/providers')
      .then(providers => {
        setProviders(providers);
        // 自动选中第一个已配置的
        const configured = providers.find(p => p.apiKey);
        if (configured) setSelectedProvider(configured.name);
      })
      .catch(() => {});
  }, []);

  // 加载当前配置
  useEffect(() => {
    api.get<Record<string, string>>('/settings/ai')
      .then((res) => {
        if (res.provider) setSelectedProvider(res.provider);
        if (res.base_url) setBaseUrl(res.base_url);
        if (res.default_model) setDefaultModel(res.default_model);
        if (res.powerful_model) setPowerfulModel(res.powerful_model);
        if (res.api_key && res.api_key !== '***') setApiKey(res.api_key);
      })
      .catch(() => {});
  }, []);

  // 切换供应商时自动填充 baseUrl
  useEffect(() => {
    const p = providers.find(p => p.name === selectedProvider);
    if (p) {
      if (!baseUrl) setBaseUrl(p.baseUrl);
      if (p.apiKey && p.apiKey !== '***' && !apiKey) setApiKey(p.apiKey);
    }
  }, [selectedProvider, providers]);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post<{ success: boolean; message: string; modelCount?: number; url?: string }>(
        '/settings/ai/test', { provider: selectedProvider, apiKey, baseUrl },
      );
      setTestResult(res);
    } catch {
      setTestResult({ success: false, message: '测试失败' });
    } finally { setTesting(false); }
  }

  async function handleFetchModels() {
    setFetchingModels(true);
    setFetchMsg('');
    try {
      const res = await api.post<{ models: AIModel[]; error?: string; note?: string }>(
        '/settings/ai/fetch-models', { provider: selectedProvider, apiKey, baseUrl },
      );
      if (res.models && res.models.length > 0) {
        setModels(res.models);
        if (!defaultModel || !res.models.find(m => m.id === defaultModel)) setDefaultModel(res.models[0].id);
        if (!powerfulModel || !res.models.find(m => m.id === powerfulModel)) {
          const powerful = res.models.find(m => m.tier === 'powerful' || m.tier === 'balanced') || res.models[0];
          setPowerfulModel(powerful.id);
        }
        setFetchMsg(`✅ 已获取 ${res.models.length} 个模型`);
      } else {
        setFetchMsg(res.note || res.error || '该供应商不支持模型列表API');
      }
    } catch {
      setFetchMsg('获取失败');
    } finally { setFetchingModels(false); }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await api.post('/settings/batch', {
        settings: [
          { category: 'AI', key: 'provider', value: selectedProvider },
          { category: 'AI', key: 'api_key', value: apiKey, encrypted: true },
          { category: 'AI', key: 'base_url', value: baseUrl },
          { category: 'AI', key: 'default_model', value: defaultModel },
          { category: 'AI', key: 'powerful_model', value: powerfulModel },
        ],
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  }

  async function handleAddProvider() {
    try {
      await api.post('/settings/ai/providers', {
        name: newPName, label: newPLabel, baseUrl: newPUrl, apiKey: newPKey,
      });
      // 刷新供应商列表
      const pList = await api.get<ProviderInfo[]>('/settings/ai/providers');
      setProviders(pList);
      setAddProviderOpen(false);
      setNewPName(''); setNewPLabel(''); setNewPUrl(''); setNewPKey('');
      setSelectedProvider(newPName);
    } catch {}
  }

  const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200';
  const selectCls = 'w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 bg-white';

  const selectedP = providers.find(p => p.name === selectedProvider);

  return (
    <div className="space-y-5">
      {/* 供应商选择 + 自定义 */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">AI 供应商</label>
          <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)} className={selectCls}>
            {providers.map(p => (
              <option key={p.name} value={p.name}>{p.label}{p.apiKey ? ' ✓' : ''}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={() => setAddProviderOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 transition-colors hover:border-indigo-300 hover:text-indigo-500"
            title="添加自定义供应商">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">API 地址</label>
          <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={selectedP?.baseUrl || '自动填充'} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">API Key</label>
          <div className="relative">
            <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-xxxx" className={cn(inputCls, 'pr-8')} />
            <button onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 模型选择 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">默认模型</label>
          <div className="flex gap-2">
            {models.length > 0 ? (
              <select value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} className={selectCls}>
                {models.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.tier})</option>)}
              </select>
            ) : (
              <input type="text" value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)}
                placeholder="手动输入模型名" className={inputCls} />
            )}
            <button onClick={handleFetchModels} disabled={fetchingModels || !apiKey}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
              title="从官方 API 获取模型列表">
              {fetchingModels ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            </button>
          </div>
          {fetchMsg && <p className={cn('mt-1 text-[11px]', fetchMsg.startsWith('✅') ? 'text-emerald-500' : 'text-amber-500')}>{fetchMsg}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">复杂任务模型</label>
          {models.length > 0 ? (
            <select value={powerfulModel} onChange={(e) => setPowerfulModel(e.target.value)} className={selectCls}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.tier})</option>)}
            </select>
          ) : (
            <input type="text" value={powerfulModel} onChange={(e) => setPowerfulModel(e.target.value)}
              placeholder="手动输入" className={inputCls} />
          )}
        </div>
      </div>

      {/* 测试结果 */}
      {testResult && (
        <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
          testResult.success ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
          {testResult.success ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          {testResult.message}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-600">
          <CheckCircle className="h-3.5 w-3.5" />配置已保存
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={handleTest} disabled={testing || !apiKey}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-50">
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
          测试连接
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-xs font-medium text-white transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
          保存配置
        </button>
      </div>

      {/* 自定义供应商弹窗 */}
      {addProviderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setAddProviderOpen(false)}>
          <div className="mx-4 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">添加 AI 供应商</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">标识 (英文)</label>
                <input value={newPName} onChange={e => setNewPName(e.target.value)} placeholder="xiaomi / custom" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">显示名</label>
                <input value={newPLabel} onChange={e => setNewPLabel(e.target.value)} placeholder="小米 MiMo" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">API 地址</label>
                <input value={newPUrl} onChange={e => setNewPUrl(e.target.value)} placeholder="https://api.xxx.com/v1" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">API Key</label>
                <input type="password" value={newPKey} onChange={e => setNewPKey(e.target.value)} placeholder="sk-xxx" className={inputCls} />
              </div>
              <button onClick={handleAddProvider} disabled={!newPName || !newPUrl}
                className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-medium text-white transition-all hover:bg-indigo-700 disabled:opacity-50">
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== 搜索配置 ==========

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

function SearchConfig() {
  const [provider, setProvider] = useState('none');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [phToken, setPhToken] = useState('');
  const [showPh, setShowPh] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 搜索高级参数
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
      })
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
        ],
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  }

  const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200';
  const selectCls = 'w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 bg-white';

  return (
    <div className="space-y-5">
      {/* 供应商 + Key */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">搜索供应商</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className={selectCls}>
            <option value="none">不使用联网搜索</option>
            <option value="tavily">Tavily (推荐)</option>
            <option value="serpapi">SerpAPI (Google)</option>
          </select>
        </div>
        {provider !== 'none' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">API Key</label>
            <div className="relative">
              <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider === 'tavily' ? 'tvly-xxxx' : 'serpapi key'} className={cn(inputCls, 'pr-8')} />
              <button onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {provider !== 'none' && (
        <>
          {/* 分隔 */}
          <div className="border-t border-slate-100 pt-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">搜索参数</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">搜索主题</label>
                <select value={cfg.topic || 'general'} onChange={e => setCfg(p => ({ ...p, topic: e.target.value }))} className={selectCls}>
                  <option value="general">通用</option>
                  <option value="news">新闻</option>
                  <option value="finance">财经</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">搜索深度</label>
                <select value={cfg.depth || 'basic'} onChange={e => setCfg(p => ({ ...p, depth: e.target.value }))} className={selectCls}>
                  <option value="basic">基础</option>
                  <option value="advanced">高级</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">最大结果数</label>
                <select value={cfg.maxResults || 5} onChange={e => setCfg(p => ({ ...p, maxResults: +e.target.value }))} className={selectCls}>
                  {[3, 5, 8, 10, 14, 20].map(n => <option key={n} value={n}>{n} 条</option>)}
                </select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">时间范围</label>
                <select value={cfg.timeRange || 'none'} onChange={e => setCfg(p => ({ ...p, timeRange: e.target.value }))} className={selectCls}>
                  <option value="none">不限</option>
                  <option value="day">24小时</option>
                  <option value="week">一周</option>
                  <option value="month">一月</option>
                  <option value="year">一年</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">国家/地区</label>
                <select value={cfg.country || 'none'} onChange={e => setCfg(p => ({ ...p, country: e.target.value }))} className={selectCls}>
                  <option value="none">不限</option>
                  <option value="cn">中国</option>
                  <option value="us">美国</option>
                  <option value="jp">日本</option>
                  <option value="sg">新加坡</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">原始内容</label>
                <select value={cfg.includeRaw || 'none'} onChange={e => setCfg(p => ({ ...p, includeRaw: e.target.value }))} className={selectCls}>
                  <option value="none">不包含</option>
                  <option value="text">纯文本</option>
                  <option value="markdown">Markdown</option>
                  <option value="html">HTML</option>
                </select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">包含域名（每行一个）</label>
                <textarea rows={2} value={cfg.includeDomains || ''} onChange={e => setCfg(p => ({ ...p, includeDomains: e.target.value }))}
                  placeholder="github.com&#10;zhihu.com" className={cn(inputCls, 'text-[11px]')} />
                <p className="mt-0.5 text-[10px] text-slate-400">搜索结果仅限于这些网站</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">排除域名（每行一个）</label>
                <textarea rows={2} value={cfg.excludeDomains || ''} onChange={e => setCfg(p => ({ ...p, excludeDomains: e.target.value }))}
                  placeholder="zhihu.com&#10;csdn.net" className={cn(inputCls, 'text-[11px]')} />
                <p className="mt-0.5 text-[10px] text-slate-400">搜索结果中排除这些网站</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Product Hunt Token */}
      <div className="border-t border-slate-100 pt-4">
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Product Hunt Token
          <span className="ml-1 font-normal text-slate-400">（可选，免费申请）</span>
        </label>
        <div className="relative mt-1">
          <input type={showPh ? 'text' : 'password'} value={phToken} onChange={e => setPhToken(e.target.value)}
            placeholder="ph_xxxxxxxxxx" className={cn(inputCls, 'pr-8')} />
          <button onClick={() => setShowPh(!showPh)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showPh ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-0.5 text-[10px] text-slate-400">
          在 producthunt.com → Settings → API 免费申请，每天 100 次请求
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
          <CheckCircle className="h-4 w-4" />配置已保存
        </div>
      )}

      <button onClick={handleSave} disabled={saving}
        className="flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
        保存配置
      </button>
    </div>
  );
}

// ========== 集成管理 ==========

function IntegrationConfig() {
  const [n8nWebhook, setN8nWebhook] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<Record<string, string>>('/settings/integration')
      .then((res) => {
        if (res.n8n_webhook) setN8nWebhook(res.n8n_webhook);
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.post('/settings/batch', {
        settings: [
          { category: 'INTEGRATION', key: 'n8n_webhook', value: n8nWebhook },
          { category: 'INTEGRATION', key: 'webhook_secret', value: webhookSecret, encrypted: true },
        ],
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  }

  const inputCls = 'w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200';

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">n8n Webhook 地址</label>
        <input type="url" value={n8nWebhook} onChange={(e) => setN8nWebhook(e.target.value)}
          placeholder="https://n8n.example.com/webhook/xxx" className={inputCls} />
        <p className="mt-1 text-[11px] text-slate-400">n8n 自动化工作流的回调地址</p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Webhook 密钥</label>
        <input type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)}
          placeholder="用于验证 Webhook 来源" className={inputCls} />
      </div>

      <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">
        <p className="text-sm text-slate-400">微信 / 钉钉集成开发中...</p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
          <CheckCircle className="h-4 w-4" />配置已保存
        </div>
      )}

      <button onClick={handleSave} disabled={saving}
        className="flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
        保存配置
      </button>
    </div>
  );
}

// ========== 安全设置 ==========

function SecuritySettings() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Session[]>('/settings/sessions')
      .then((res) => setSessions(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleKick(id: string) {
    try {
      await api.delete(`/settings/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {}
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">登录设备</h3>
        {sessions.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">暂无登录设备</p>
        ) : (
          <div className="divide-y rounded-lg border border-slate-200">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <Smartphone className="h-5 w-5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">{s.device}</p>
                  <p className="text-[11px] text-slate-400">IP: {s.ip} · {new Date(s.createdAt).toLocaleDateString('zh-CN')}</p>
                </div>
                <button onClick={() => handleKick(s.id)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50">
                  <LogOut className="h-3.5 w-3.5" />踢出
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">
        <p className="text-sm text-slate-400">两步验证 / API Token 管理开发中...</p>
      </div>
    </div>
  );
}

// ========== 数据管理 ==========

function DataManagement() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <button className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white transition-all hover:border-indigo-300 hover:shadow-sm">
          <Download className="h-6 w-6 text-indigo-500" />
          <span className="text-sm font-medium text-slate-700">导出项目数据</span>
          <span className="text-[11px] text-slate-400">CSV 格式</span>
        </button>
        <button className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white transition-all hover:border-indigo-300 hover:shadow-sm">
          <Download className="h-6 w-6 text-emerald-500" />
          <span className="text-sm font-medium text-slate-700">导出客户数据</span>
          <span className="text-[11px] text-slate-400">CSV 格式</span>
        </button>
      </div>

      <button className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 transition-colors hover:bg-slate-50">
        <Database className="h-4 w-4 text-slate-400" />
        清除本地缓存
      </button>

      <div className="rounded-lg border border-red-200 bg-red-50/30 px-4 py-4">
        <h3 className="text-sm font-semibold text-red-600">危险操作</h3>
        <p className="mt-1 text-[12px] text-red-400">账号注销将删除所有数据，此操作不可恢复</p>
        <button className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-700 active:scale-95">
          <Trash2 className="h-4 w-4" />注销账号
        </button>
      </div>
    </div>
  );
}

// ========== 主页面 ==========

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('ai');

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'ai', label: 'AI 配置', icon: Bot },
    { key: 'search', label: '搜索配置', icon: Search },
    { key: 'integration', label: '集成管理', icon: Link },
    { key: 'security', label: '安全设置', icon: Shield },
    { key: 'data', label: '数据管理', icon: Database },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-lg font-bold text-slate-800">系统设置</h1>

      {/* 分类标签 */}
      <div className="mb-5 flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn('flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-all',
              activeTab === tab.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50')}>
            <tab.icon className="h-4 w-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm">
        {activeTab === 'ai' && <AIConfig />}
        {activeTab === 'search' && <SearchConfig />}
        {activeTab === 'integration' && <IntegrationConfig />}
        {activeTab === 'security' && <SecuritySettings />}
        {activeTab === 'data' && <DataManagement />}
      </div>
    </div>
  );
}
