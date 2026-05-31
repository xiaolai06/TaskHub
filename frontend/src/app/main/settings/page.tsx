'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Loader2, CheckCircle, AlertCircle, Bot, Link, Shield, Database,
  Eye, EyeOff, Wifi, Trash2, Download, LogOut, Smartphone,
} from 'lucide-react';

// ========== 类型 ==========

type TabKey = 'ai' | 'integration' | 'security' | 'data';

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

function AIConfig() {
  const [provider, setProvider] = useState('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [powerfulModel, setPowerfulModel] = useState('');
  const [models, setModels] = useState<AIModel[]>([]);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchMsg, setFetchMsg] = useState('');

  // 加载配置
  useEffect(() => {
    api.get<Record<string, string>>('/settings/ai')
      .then((res) => {
        if (res.provider) setProvider(res.provider);
        if (res.base_url) setBaseUrl(res.base_url);
        if (res.default_model) setDefaultModel(res.default_model);
        if (res.powerful_model) setPowerfulModel(res.powerful_model);
        if (res.api_key && res.api_key !== '***') setApiKey(res.api_key);
      })
      .catch(() => {});
  }, []);

  // 切换供应商时加载模型列表
  useEffect(() => {
    api.get<{ models: AIModel[]; baseUrl: string }>(`/settings/ai/models?provider=${provider}`)
      .then((res) => {
        setModels(res.models);
        if (!baseUrl || Object.values(res.baseUrl).length) setBaseUrl(res.baseUrl);
        if (res.models.length > 0 && !defaultModel) setDefaultModel(res.models[0].id);
        if (res.models.length > 1 && !powerfulModel) setPowerfulModel(res.models[1].id);
      })
      .catch(() => {});
  }, [provider]);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post<{ success: boolean; message: string }>('/settings/ai/test', { provider, apiKey, baseUrl });
      setTestResult(res);
    } catch {
      setTestResult({ success: false, message: '测试失败' });
    } finally {
      setTesting(false);
    }
  }

  /** 从官方 API 动态获取模型列表 */
  async function handleFetchModels() {
    setFetchingModels(true);
    setFetchMsg('');
    try {
      const res = await api.post<{ models: AIModel[]; error?: string }>(
        '/settings/ai/fetch-models', { provider, apiKey, baseUrl },
      );
      if (res.models && res.models.length > 0) {
        setModels(res.models);
        if (!defaultModel || !res.models.find(m => m.id === defaultModel)) setDefaultModel(res.models[0].id);
        if (!powerfulModel || !res.models.find(m => m.id === powerfulModel)) {
          const powerful = res.models.find(m => m.tier === 'powerful' || m.tier === 'balanced') || res.models[0];
          setPowerfulModel(powerful.id);
        }
        setFetchMsg(res.error ? `已获取 ${res.models.length} 个模型（含 fallback）` : `已从官方获取 ${res.models.length} 个模型`);
      } else {
        setFetchMsg(res.error || '未获取到模型');
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
          { category: 'AI', key: 'provider', value: provider },
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

  const inputCls = 'w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200';
  const selectCls = 'w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">AI 供应商</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className={selectCls}>
            {providers.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">API 地址</label>
          <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="自动填充" className={inputCls} />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">API Key</label>
        <div className="relative">
          <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-xxxx" className={cn(inputCls, 'pr-10')} />
          <button onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">默认模型</label>
          <div className="flex gap-2">
            <select value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} className={selectCls}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.tier})</option>)}
            </select>
            <button onClick={handleFetchModels} disabled={fetchingModels || !apiKey}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
              title="从官方 API 获取模型列表">
              {fetchingModels ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </button>
          </div>
          {fetchMsg && <p className={cn('mt-1 text-[11px]', fetchMsg.includes('已获取') ? 'text-emerald-500' : 'text-amber-500')}>{fetchMsg}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">复杂任务模型</label>
          <select value={powerfulModel} onChange={(e) => setPowerfulModel(e.target.value)} className={selectCls}>
            {models.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.tier})</option>)}
          </select>
        </div>
      </div>

      {/* 测试结果 */}
      {testResult && (
        <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
          testResult.success ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
          {testResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {testResult.message}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
          <CheckCircle className="h-4 w-4" />配置已保存
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={handleTest} disabled={testing || !apiKey}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-5 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-50">
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
          测试连接
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          保存配置
        </button>
      </div>
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
        {activeTab === 'integration' && <IntegrationConfig />}
        {activeTab === 'security' && <SecuritySettings />}
        {activeTab === 'data' && <DataManagement />}
      </div>
    </div>
  );
}
