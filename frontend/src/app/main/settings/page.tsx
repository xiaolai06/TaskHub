'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Loader2, CheckCircle, AlertCircle, Bot, Link, Shield, Database,
  Eye, EyeOff, Wifi, Trash2, Download, LogOut, Smartphone, Search, Plus, Mail, Send, Bell, Clock,
} from 'lucide-react';

// ========== 类型 ==========

type TabKey = 'ai' | 'search' | 'integration' | 'email' | 'push' | 'security' | 'data';

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
  defaultModel: string;
  powerfulModel: string;
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
  const [toolPermission, setToolPermission] = useState<'auto' | 'confirm'>('auto');

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
        // 自动选中当前激活供应商
        api.get<Record<string, string>>('/settings/ai')
          .then((res) => {
            const active = res.provider || 'deepseek';
            setSelectedProvider(active);
            fillFromProvider(providers, active);
            if (res.tool_permission) setToolPermission(res.tool_permission as 'auto' | 'confirm');
          })
          .catch(() => {
            const configured = providers.find(p => p.apiKey);
            if (configured) { setSelectedProvider(configured.name); fillFromProvider(providers, configured.name); }
          });
      })
      .catch(() => {});
  }, []);

  // 从供应商列表中填充表单（切换时完全替换，不留旧数据）
  function fillFromProvider(list: ProviderInfo[], name: string) {
    const p = list.find(x => x.name === name);
    if (!p) {
      setApiKey(''); setBaseUrl(''); setDefaultModel(''); setPowerfulModel(''); setModels([]);
      return;
    }
    setApiKey(p.apiKey && p.apiKey !== '***' ? p.apiKey : '');
    setBaseUrl(p.baseUrl || '');
    setDefaultModel(p.defaultModel || '');
    setPowerfulModel(p.powerfulModel || '');
    setModels([]);
    setShowKey(false);
    setTestResult(null);
    setFetchMsg('');
  }

  // 切换供应商
  function switchProvider(target: string) {
    setSelectedProvider(target);
    fillFromProvider(providers, target);
  }

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
      // 1. 保存当前供应商的完整配置到 AI_PROVIDER 表
      await api.post('/settings/ai/providers', {
        name: selectedProvider,
        baseUrl,
        apiKey,
        defaultModel,
        powerfulModel,
      });
      // 2. 设置当前激活供应商 + 工具权限
      await api.post('/settings/batch', {
        settings: [
          { category: 'AI', key: 'provider', value: selectedProvider },
          { category: 'AI', key: 'tool_permission', value: toolPermission },
        ],
      });
      // 3. 刷新供应商列表
      const pList = await api.get<ProviderInfo[]>('/settings/ai/providers');
      setProviders(pList);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { toast.error('保存失败: ' + (e instanceof Error ? e.message : '未知错误')); } finally { setSaving(false); }
  }

  // 删除自定义供应商
  async function handleDeleteProvider(name: string) {
    if (!confirm(`确定删除供应商「${name}」？`)) return;
    try {
      await api.delete(`/settings/ai/providers/${name}`);
      const pList = await api.get<ProviderInfo[]>('/settings/ai/providers');
      setProviders(pList);
      if (selectedProvider === name && pList.length > 0) {
        setSelectedProvider(pList[0].name);
        fillFromProvider(pList, pList[0].name);
      }
    } catch (e) { toast.error('删除失败: ' + (e instanceof Error ? e.message : '未知错误')); }
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
    } catch (e) { toast.error('添加失败: ' + (e instanceof Error ? e.message : '未知错误')); }
  }

  const inputCls = 'w-full rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/80 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200';
  const selectCls = 'w-full rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/80 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 bg-card';

  const selectedP = providers.find(p => p.name === selectedProvider);

  return (
    <div className="space-y-5">
      {/* 供应商选择 + 自定义 */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-foreground/70">AI 供应商</label>
          <select value={selectedProvider} onChange={(e) => switchProvider(e.target.value)} className={selectCls}>
            {providers.map(p => (
              <option key={p.name} value={p.name}>{p.label}{p.apiKey ? ' ✓' : ''}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-1">
          <button onClick={() => setAddProviderOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-indigo-300 hover:text-indigo-500"
            title="添加自定义供应商">
            <Plus className="h-4 w-4" />
          </button>
          {!['deepseek', 'openai', 'ollama', 'anthropic', 'mistral', 'groq', 'together', 'zhipu', 'qwen', 'moonshot', 'minimax', 'stepfun', 'doubao', 'yi', 'siliconflow', 'fireworks', 'cerebras', 'cohere', 'deepinfra', 'novita', 'perplexity', 'xai', 'baidu'].includes(selectedProvider) && (
            <button onClick={() => handleDeleteProvider(selectedProvider)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-400 transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:border-red-800 dark:hover:bg-red-950/30"
              title="删除此供应商">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground/70">API 地址</label>
          <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={selectedP?.baseUrl || '自动填充'} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground/70">API Key</label>
          <div className="relative">
            <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-xxxx" className={cn(inputCls, 'pr-8')} />
            <button onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 模型选择 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground/70">默认模型</label>
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
              title="从官方 API 获取模型列表">
              {fetchingModels ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            </button>
          </div>
          {fetchMsg && <p className={cn('mt-1 text-[11px]', fetchMsg.startsWith('✅') ? 'text-emerald-500' : 'text-amber-500')}>{fetchMsg}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground/70">复杂任务模型</label>
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
          testResult.success ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400')}>
          {testResult.success ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          {testResult.message}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
          <CheckCircle className="h-3.5 w-3.5" />配置已保存
        </div>
      )}

      {/* 工具权限设置 */}
      <div className="rounded-lg border border-border bg-card p-3">
        <label className="mb-1.5 block text-xs font-medium text-foreground/70">写操作权限</label>
        <p className="mb-2 text-[11px] text-muted-foreground">控制 AI 执行创建、修改、删除等操作时的行为</p>
        <div className="flex gap-2">
          <button
            onClick={() => setToolPermission('auto')}
            className={cn(
              'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all',
              toolPermission === 'auto'
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            自动执行
            <span className="mt-0.5 block text-[10px] font-normal opacity-70">AI 直接执行写操作</span>
          </button>
          <button
            onClick={() => setToolPermission('confirm')}
            className={cn(
              'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all',
              toolPermission === 'confirm'
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            确认后执行
            <span className="mt-0.5 block text-[10px] font-normal opacity-70">写操作需点击确认</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleTest} disabled={testing || !apiKey}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-xs font-medium text-foreground/70 transition-all hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
          测试连接
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-xs font-medium text-white transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
          保存配置
        </button>
      </div>

      {/* 自定义供应商弹窗 */}
      {addProviderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setAddProviderOpen(false)}>
          <div className="mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold text-foreground">添加 AI 供应商</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">标识 (英文)</label>
                <input value={newPName} onChange={e => setNewPName(e.target.value)} placeholder="xiaomi / custom" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">显示名</label>
                <input value={newPLabel} onChange={e => setNewPLabel(e.target.value)} placeholder="小米 MiMo" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">API 地址</label>
                <input value={newPUrl} onChange={e => setNewPUrl(e.target.value)} placeholder="https://api.xxx.com/v1" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">API Key</label>
                <input type="password" value={newPKey} onChange={e => setNewPKey(e.target.value)} placeholder="sk-xxx" className={inputCls} />
              </div>
              <button onClick={handleAddProvider} disabled={!newPName || !newPUrl}
                className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
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

  const inputCls = 'w-full rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/80 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200';
  const selectCls = 'w-full rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/80 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 bg-card';

  return (
    <div className="space-y-5">
      {/* 供应商 + Key */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground/70">搜索供应商</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className={selectCls}>
            <option value="none">不使用联网搜索</option>
            <option value="tavily">Tavily (推荐)</option>
            <option value="serpapi">SerpAPI (Google)</option>
          </select>
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
          {/* 分隔 */}
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">搜索参数</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/70">搜索主题</label>
                <select value={cfg.topic || 'general'} onChange={e => setCfg(p => ({ ...p, topic: e.target.value }))} className={selectCls}>
                  <option value="general">通用</option>
                  <option value="news">新闻</option>
                  <option value="finance">财经</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/70">搜索深度</label>
                <select value={cfg.depth || 'basic'} onChange={e => setCfg(p => ({ ...p, depth: e.target.value }))} className={selectCls}>
                  <option value="basic">基础</option>
                  <option value="advanced">高级</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/70">最大结果数</label>
                <select value={cfg.maxResults || 5} onChange={e => setCfg(p => ({ ...p, maxResults: +e.target.value }))} className={selectCls}>
                  {[3, 5, 8, 10, 14, 20].map(n => <option key={n} value={n}>{n} 条</option>)}
                </select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/70">时间范围</label>
                <select value={cfg.timeRange || 'none'} onChange={e => setCfg(p => ({ ...p, timeRange: e.target.value }))} className={selectCls}>
                  <option value="none">不限</option>
                  <option value="day">24小时</option>
                  <option value="week">一周</option>
                  <option value="month">一月</option>
                  <option value="year">一年</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/70">国家/地区</label>
                <select value={cfg.country || 'none'} onChange={e => setCfg(p => ({ ...p, country: e.target.value }))} className={selectCls}>
                  <option value="none">不限</option>
                  <option value="cn">中国</option>
                  <option value="us">美国</option>
                  <option value="jp">日本</option>
                  <option value="sg">新加坡</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/70">原始内容</label>
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
                <label className="mb-1 block text-xs font-medium text-foreground/70">包含域名（每行一个）</label>
                <textarea rows={2} value={cfg.includeDomains || ''} onChange={e => setCfg(p => ({ ...p, includeDomains: e.target.value }))}
                  placeholder="github.com&#10;zhihu.com" className={cn(inputCls, 'text-[11px]')} />
                <p className="mt-0.5 text-[10px] text-muted-foreground">搜索结果仅限于这些网站</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/70">排除域名（每行一个）</label>
                <textarea rows={2} value={cfg.excludeDomains || ''} onChange={e => setCfg(p => ({ ...p, excludeDomains: e.target.value }))}
                  placeholder="zhihu.com&#10;csdn.net" className={cn(inputCls, 'text-[11px]')} />
                <p className="mt-0.5 text-[10px] text-muted-foreground">搜索结果中排除这些网站</p>
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
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          在 producthunt.com → Settings → API 免费申请，每天 100 次请求
        </p>
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

// ========== 推送管理 ==========

interface WebhookItem {
  name: string;     // 昵称，如"项目群""客户群"
  channel: string;  // wechat / feishu / dingtalk / slack
  url: string;
}

const CHANNEL_OPTIONS = [
  { value: 'wechat', label: '企业微信', icon: '💬' },
  { value: 'feishu', label: '飞书', icon: '🐦' },
  { value: 'dingtalk', label: '钉钉', icon: '📌' },
  { value: 'slack', label: 'Slack', icon: '🔔' },
];

function PushConfig() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [testing, setTesting] = useState('');
  const [testResult, setTestResult] = useState<{ name: string; success: boolean; message: string } | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addChannel, setAddChannel] = useState('wechat');
  const [addUrl, setAddUrl] = useState('');
  const [addErr, setAddErr] = useState('');

  // 加载
  useEffect(() => {
    api.get<Record<string, string>>('/settings/notify')
      .then((res) => {
        if (res.webhooks) {
          try { setWebhooks(JSON.parse(res.webhooks)); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 保存
  async function handleSave(list: WebhookItem[]) {
    setSaving(true);
    setSaveErr('');
    try {
      await api.post('/settings/batch', {
        settings: [
          { category: 'NOTIFY', key: 'webhooks', value: JSON.stringify(list) },
        ],
      });
      setWebhooks(list);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : '保存失败');
    } finally { setSaving(false); }
  }

  // 添加
  function handleAdd() {
    setAddErr('');
    const name = addName.trim();
    if (!name) { setAddErr('请填写昵称'); return; }
    if (!addUrl.trim()) { setAddErr('请填写 Webhook URL'); return; }
    if (webhooks.some(w => w.name === name)) { setAddErr(`昵称"${name}"已存在`); return; }
    const next = [...webhooks, { name, channel: addChannel, url: addUrl.trim() }];
    handleSave(next);
    setAddOpen(false);
    setAddName(''); setAddUrl(''); setAddChannel('wechat');
  }

  // 删除
  function handleRemove(name: string) {
    const next = webhooks.filter(w => w.name !== name);
    handleSave(next);
  }

  // 测试
  async function handleTest(item: WebhookItem) {
    setTesting(item.name);
    setTestResult(null);
    try {
      await api.post('/settings/webhook/test', { channel: item.channel, url: item.url });
      setTestResult({ name: item.name, success: true, message: '测试消息已发送，请检查群聊' });
    } catch (err) {
      setTestResult({ name: item.name, success: false, message: err instanceof Error ? err.message : '发送失败' });
    } finally { setTesting(''); }
  }

  const inputCls = 'w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200';
  const selectCls = 'w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground/80 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 bg-card';

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[12px] text-muted-foreground">配置群机器人 Webhook，定时任务和 AI 可自动推送消息到群聊。每个推送目标需要设置一个昵称，AI 通过昵称识别发送目标。</p>
        </div>
        <button onClick={() => setAddOpen(true)}
          className="flex h-9 items-center gap-1 rounded-lg bg-indigo-600 px-3.5 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95">
          <Plus className="h-4 w-4" />添加推送
        </button>
      </div>

      {webhooks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">暂未配置推送目标</p>
          <p className="mt-1 text-[11px] text-muted-foreground">点击"添加推送"配置企业微信/飞书/钉钉群机器人</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {webhooks.map((wh) => {
            const ch = CHANNEL_OPTIONS.find(c => c.value === wh.channel);
            return (
              <div key={wh.name} className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-3.5">
                {/* 渠道图标 */}
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-lg dark:bg-indigo-950/40">{ch?.icon || '🔗'}</span>
                {/* 昵称 + 渠道 */}
                <div className="w-28 shrink-0">
                  <p className="text-sm font-semibold text-foreground">{wh.name}</p>
                  <p className="text-[11px] text-muted-foreground">{ch?.label || wh.channel}</p>
                </div>
                {/* URL */}
                <p className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{wh.url}</p>
                {/* 操作按钮 */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <button onClick={() => handleTest(wh)} disabled={testing === wh.name}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12px] font-medium text-foreground/60 transition-all hover:bg-accent disabled:opacity-50">
                    {testing === wh.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '测试'}
                  </button>
                  <button onClick={() => handleRemove(wh.name)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          {testResult && (
            <p className={cn('text-xs', testResult.success ? 'text-emerald-500' : 'text-red-500')}>
              {testResult.message}
            </p>
          )}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
          <CheckCircle className="h-4 w-4" />推送配置已保存
        </div>
      )}
      {saveErr && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />{saveErr}
        </div>
      )}

      {/* 添加弹窗 */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => { setAddOpen(false); setAddErr(''); }}>
          <div className="mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-base font-semibold text-foreground">添加推送目标</h3>
            <div className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">昵称（AI 通过此名称识别目标）</label>
                <input value={addName} onChange={e => { setAddName(e.target.value); setAddErr(''); }}
                  placeholder="如：项目群、客户群、日报群" className={cn(inputCls, addErr && 'border-red-400')} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">渠道</label>
                <select value={addChannel} onChange={e => setAddChannel(e.target.value)} className={selectCls}>
                  {CHANNEL_OPTIONS.map(ch => <option key={ch.value} value={ch.value}>{ch.icon} {ch.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Webhook URL</label>
                <input value={addUrl} onChange={e => { setAddUrl(e.target.value); setAddErr(''); }}
                  placeholder={CHANNEL_OPTIONS.find(c => c.value === addChannel)?.value === 'wechat' ? 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx' : 'https://...'}
                  className={cn(inputCls, addErr && 'border-red-400')} />
                {addErr && <p className="mt-1 text-xs text-red-500">{addErr}</p>}
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setAddOpen(false); setAddErr(''); }}
                  className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground/70 transition-all hover:bg-accent">取消</button>
                <button onClick={handleAdd} disabled={!addName.trim() || !addUrl.trim()}
                  className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">添加</button>
              </div>
            </div>
          </div>
        </div>
      )}
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

  const inputCls = 'w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200';

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground/80">n8n Webhook 地址</label>
        <input type="url" value={n8nWebhook} onChange={(e) => setN8nWebhook(e.target.value)}
          placeholder="https://n8n.example.com/webhook/xxx" className={inputCls} />
        <p className="mt-1 text-[11px] text-muted-foreground">n8n 自动化工作流的回调地址</p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground/80">Webhook 密钥</label>
        <input type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)}
          placeholder="用于验证 Webhook 来源" className={inputCls} />
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
        <h3 className="mb-3 text-sm font-semibold text-foreground/80">登录设备</h3>
        {sessions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">暂无登录设备</p>
        ) : (
          <div className="divide-y rounded-lg border border-border">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <Smartphone className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground/80">{s.device}</p>
                  <p className="text-[11px] text-muted-foreground">IP: {s.ip} · {new Date(s.createdAt).toLocaleDateString('zh-CN')}</p>
                </div>
                <button onClick={() => handleKick(s.id)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30">
                  <LogOut className="h-3.5 w-3.5" />踢出
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">两步验证 / API Token 管理开发中...</p>
      </div>
    </div>
  );
}

// ========== 数据管理 ==========

function DataManagement() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <button className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card transition-all hover:border-indigo-300 hover:shadow-sm">
          <Download className="h-6 w-6 text-indigo-500" />
          <span className="text-sm font-medium text-foreground/80">导出项目数据</span>
          <span className="text-[11px] text-muted-foreground">CSV 格式</span>
        </button>
        <button className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card transition-all hover:border-indigo-300 hover:shadow-sm">
          <Download className="h-6 w-6 text-emerald-500" />
          <span className="text-sm font-medium text-foreground/80">导出客户数据</span>
          <span className="text-[11px] text-muted-foreground">CSV 格式</span>
        </button>
      </div>

      <button className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground/70 transition-colors hover:bg-accent">
        <Database className="h-4 w-4 text-muted-foreground" />
        清除本地缓存
      </button>

      <div className="rounded-lg border border-red-200 bg-red-50/30 px-4 py-4 dark:border-red-800/50 dark:bg-red-950/30">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">危险操作</h3>
        <p className="mt-1 text-[12px] text-red-400">账号注销将删除所有数据，此操作不可恢复</p>
        <button className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-700 active:scale-95">
          <Trash2 className="h-4 w-4" />注销账号
        </button>
      </div>
    </div>
  );
}

// ========== 邮件设置 ==========

function EmailConfig() {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('465');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [from, setFrom] = useState('');
  const [secure, setSecure] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // 测试发送
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
        setConfigLoaded(true);
      })
      .catch(() => setConfigLoaded(true));
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

  const inputCls = 'w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground/80 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200';
  const selectCls = 'w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground/80 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 bg-card';

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
          <select value={port} onChange={(e) => {
            const p = e.target.value;
            setPort(p);
            setSecure(p === '465');
          }} className={selectCls}>
            {portPresets.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
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

      {/* 保存按钮 */}
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

// ========== 主页面 ==========

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('ai');

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'ai', label: 'AI 配置', icon: Bot },
    { key: 'search', label: '搜索配置', icon: Search },
    { key: 'integration', label: '集成管理', icon: Link },
    { key: 'email', label: '邮件设置', icon: Mail },
    { key: 'push', label: '推送管理', icon: Bell },
    { key: 'security', label: '安全设置', icon: Shield },
    { key: 'data', label: '数据管理', icon: Database },
  ];

  return (
    <div className="mx-auto max-w-4xl page-enter">
      <h1 className="mb-5 text-lg font-bold text-foreground">系统设置</h1>

      {/* 分类标签 */}
      <div className="mb-5 flex gap-1 rounded-lg border border-border bg-card p-1">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn('flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-all',
              activeTab === tab.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
            <tab.icon className="h-4 w-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
        {activeTab === 'ai' && <AIConfig />}
        {activeTab === 'search' && <SearchConfig />}
        {activeTab === 'integration' && <IntegrationConfig />}
        {activeTab === 'email' && <EmailConfig />}
        {activeTab === 'push' && <PushConfig />}
        {activeTab === 'security' && <SecuritySettings />}
        {activeTab === 'data' && <DataManagement />}
      </div>
    </div>
  );
}
