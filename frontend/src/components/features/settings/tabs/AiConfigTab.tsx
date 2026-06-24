'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Loader2, CheckCircle, AlertCircle, Eye, EyeOff, Wifi, Trash2, Download, Plus,
} from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

interface AIModel {
  id: string;
  name: string;
  tier: string;
}

interface ProviderInfo {
  name: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  powerfulModel: string;
}

const BUILTIN_PROVIDERS = [
  'deepseek', 'openai', 'ollama', 'anthropic', 'mistral', 'groq', 'together',
  'zhipu', 'qwen', 'moonshot', 'minimax', 'stepfun', 'doubao', 'yi',
  'siliconflow', 'fireworks', 'cerebras', 'cohere', 'deepinfra', 'novita',
  'perplexity', 'xai', 'baidu',
];

export function AiConfigTab() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [hasExistingKey, setHasExistingKey] = useState(false);
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

  const [addProviderOpen, setAddProviderOpen] = useState(false);
  const [newPName, setNewPName] = useState('');
  const [newPLabel, setNewPLabel] = useState('');
  const [newPUrl, setNewPUrl] = useState('');
  const [newPKey, setNewPKey] = useState('');

  useEffect(() => {
    api.get<ProviderInfo[]>('/settings/ai/providers')
      .then(p => {
        setProviders(p);
        api.get<Record<string, string>>('/settings/ai')
          .then((res) => {
            const active = res.provider || 'deepseek';
            setSelectedProvider(active);
            fillFromProvider(p, active);
            if (res.tool_permission) setToolPermission(res.tool_permission as 'auto' | 'confirm');
          })
          .catch(() => {
            const configured = p.find(x => x.apiKey);
            if (configured) { setSelectedProvider(configured.name); fillFromProvider(p, configured.name); }
          });
      })
      .catch(() => {});
  }, []);

  function fillFromProvider(list: ProviderInfo[], name: string) {
    const p = list.find(x => x.name === name);
    if (!p) {
      setApiKey(''); setHasExistingKey(false); setBaseUrl(''); setDefaultModel(''); setPowerfulModel(''); setModels([]);
      return;
    }
    const keyExists = !!(p.apiKey && p.apiKey === '***');
    setApiKey(keyExists ? '' : (p.apiKey || ''));
    setHasExistingKey(keyExists);
    setBaseUrl(p.baseUrl || '');
    setDefaultModel(p.defaultModel || '');
    setPowerfulModel(p.powerfulModel || '');
    setModels([]);
    setShowKey(false);
    setTestResult(null);
    setFetchMsg('');
  }

  function switchProvider(target: string) {
    setSelectedProvider(target);
    fillFromProvider(providers, target);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const keyToSend = apiKey || (hasExistingKey ? '***' : '');
      const res = await api.post<{ success: boolean; message: string; modelCount?: number; url?: string }>(
        '/settings/ai/test', { provider: selectedProvider, apiKey: keyToSend, baseUrl },
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
      const keyToSend = apiKey || (hasExistingKey ? '***' : '');
      const res = await api.post<{ models: AIModel[]; error?: string; note?: string }>(
        '/settings/ai/fetch-models', { provider: selectedProvider, apiKey: keyToSend, baseUrl },
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
      await api.post('/settings/ai/providers', {
        name: selectedProvider,
        baseUrl,
        ...(apiKey ? { apiKey } : {}),
        defaultModel,
        powerfulModel,
      });
      await api.post('/settings/batch', {
        settings: [
          { category: 'AI', key: 'provider', value: selectedProvider },
          { category: 'AI', key: 'tool_permission', value: toolPermission },
        ],
      });
      const pList = await api.get<ProviderInfo[]>('/settings/ai/providers');
      setProviders(pList);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { toast.error('保存失败: ' + (e instanceof Error ? e.message : '未知错误')); } finally { setSaving(false); }
  }

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
      const pList = await api.get<ProviderInfo[]>('/settings/ai/providers');
      setProviders(pList);
      setAddProviderOpen(false);
      setNewPName(''); setNewPLabel(''); setNewPUrl(''); setNewPKey('');
      setSelectedProvider(newPName);
    } catch (e) { toast.error('添加失败: ' + (e instanceof Error ? e.message : '未知错误')); }
  }

  const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60';
  const selectCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60 bg-card';

  const selectedP = providers.find(p => p.name === selectedProvider);

  return (
    <div className="space-y-5">
      {/* 供应商选择 + 自定义 */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-foreground/70">AI 供应商</label>
          <Select value={selectedProvider} onValueChange={(v) => switchProvider(v || 'deepseek')}>
            <SelectTrigger className={cn(selectCls, "w-full")}><SelectValue placeholder="选择供应商" /></SelectTrigger>
            <SelectContent>
              {providers.map(p => (
                <SelectItem key={p.name} value={p.name}>{p.label}{p.apiKey ? ' ✓' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-1">
          <button onClick={() => setAddProviderOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-indigo-300 hover:text-indigo-500"
            title="添加自定义供应商">
            <Plus className="h-4 w-4" />
          </button>
          {!BUILTIN_PROVIDERS.includes(selectedProvider) && (
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
          <label className="mb-1 block text-xs font-medium text-foreground/70">
            API Key
            {hasExistingKey && !apiKey && (
              <span className="ml-2 text-2xs text-emerald-500 font-normal">已保存，留空则保留</span>
            )}
          </label>
          <div className="relative">
            <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasExistingKey && !apiKey ? '••••••••（已保存，无需重新输入）' : 'sk-xxxx'}
              className={cn(inputCls, 'pr-8', hasExistingKey && !apiKey && 'text-muted-foreground/60')} />
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
              <Select value={defaultModel} onValueChange={(v) => setDefaultModel(v || "")}>
                <SelectTrigger className={cn(selectCls, "w-full")}><SelectValue placeholder="选择模型" /></SelectTrigger>
                <SelectContent>
                  {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} ({m.tier})</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <input type="text" value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)}
                placeholder="手动输入模型名" className={inputCls} />
            )}
            <button onClick={handleFetchModels} disabled={fetchingModels || (!apiKey && !hasExistingKey)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
              title="从官方 API 获取模型列表">
              {fetchingModels ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            </button>
          </div>
          {fetchMsg && <p className={cn('mt-1 text-2xs-plus', fetchMsg.startsWith('✅') ? 'text-emerald-500' : 'text-amber-500')}>{fetchMsg}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground/70">复杂任务模型</label>
          {models.length > 0 ? (
            <Select value={powerfulModel} onValueChange={(v) => setPowerfulModel(v || "")}>
              <SelectTrigger className={cn(selectCls, "w-full")}><SelectValue placeholder="选择模型" /></SelectTrigger>
              <SelectContent>
                {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} ({m.tier})</SelectItem>)}
              </SelectContent>
            </Select>
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
        <p className="mb-2 text-2xs-plus text-muted-foreground">控制 AI 执行创建、修改、删除等操作时的行为</p>
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
            <span className="mt-0.5 block text-2xs font-normal opacity-70">AI 直接执行写操作</span>
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
            <span className="mt-0.5 block text-2xs font-normal opacity-70">写操作需点击确认</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleTest} disabled={testing || (!apiKey && !hasExistingKey)}
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
                <label className="mb-1 block text-2xs-plus text-muted-foreground">标识 (英文)</label>
                <input value={newPName} onChange={e => setNewPName(e.target.value)} placeholder="xiaomi / custom" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-2xs-plus text-muted-foreground">显示名</label>
                <input value={newPLabel} onChange={e => setNewPLabel(e.target.value)} placeholder="小米 MiMo" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-2xs-plus text-muted-foreground">API 地址</label>
                <input value={newPUrl} onChange={e => setNewPUrl(e.target.value)} placeholder="https://api.xxx.com/v1" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-2xs-plus text-muted-foreground">API Key</label>
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
