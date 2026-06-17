'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Loader2, CheckCircle, Check, AlertCircle, Bot, Link, Shield, Database,
  Eye, EyeOff, Wifi, Trash2, Download, LogOut, Smartphone, Search, Plus, Mail, Send, Bell, Clock, Globe, Mic,
} from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

// ========== 类型 ==========

type TabKey = 'ai' | 'stt' | 'search' | 'integration' | 'email' | 'push' | 'security' | 'data';

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
  const [hasExistingKey, setHasExistingKey] = useState(false); // 标记当前供应商是否已有保存的 key
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
      setApiKey(''); setHasExistingKey(false); setBaseUrl(''); setDefaultModel(''); setPowerfulModel(''); setModels([]);
      return;
    }
    const keyExists = !!(p.apiKey && p.apiKey === '***'); // 后端返回 '***' 表示有已保存的 key
    setApiKey(keyExists ? '' : (p.apiKey || '')); // 有旧 key 时输入框留空，让用户决定是否替换
    setHasExistingKey(keyExists);
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
      // 有旧 key 且未输入新 key 时，传 '***' 让后端用已保存的 key
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
      // 1. 保存当前供应商的完整配置到 AI_PROVIDER 表
      //    apiKey 为空表示未修改，后端会保留已有的加密值
      await api.post('/settings/ai/providers', {
        name: selectedProvider,
        baseUrl,
        ...(apiKey ? { apiKey } : {}),
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

// ========== 语音识别 (STT) 配置 ==========

function SttConfig() {
  const [providers, setProviders] = useState<{ name: string; label: string; baseUrl: string; apiKey: string; model: string; language: string }[]>([]);
  const [activeProvider, setActiveProvider] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);

  // 表单
  const [formName, setFormName] = useState('groq');
  const [formKey, setFormKey] = useState('');
  const [formUrl, setFormUrl] = useState('https://api.groq.com/openai/v1');
  const [formModel, setFormModel] = useState('whisper-large-v3-turbo');

  const PRESETS: Record<string, { label: string; url: string; model: string }> = {
    groq: { label: 'Groq（免费推荐）', url: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3-turbo' },
    openai: { label: 'OpenAI Whisper', url: 'https://api.openai.com/v1', model: 'whisper-1' },
    siliconflow: { label: '硅基流动（国内免费）', url: 'https://api.siliconflow.cn/v1', model: 'FunAudioLLM/SenseVoiceSmall' },
    ollama: { label: 'Ollama（本地）', url: 'http://localhost:11434/v1', model: 'whisper' },
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<{ providers: typeof providers; active: string }>('/llm/speech/providers');
        setProviders(data.providers || []);
        setActiveProvider(data.active || '');
        // 填充当前激活供应商的配置
        const active = (data.providers || []).find(p => p.name === data.active);
        if (active) fillForm(active);
      } catch { /* 首次无配置 */ }
      setLoading(false);
    })();
  }, []);

  function fillForm(p: { name: string; baseUrl: string; apiKey: string; model: string; language: string }) {
    setFormName(p.name);
    setFormUrl(p.baseUrl);
    if (p.apiKey === '***') {
      setFormKey('');
      setHasExistingKey(true);
    } else {
      setFormKey(p.apiKey);
      setHasExistingKey(!!p.apiKey);
    }
    setFormModel(p.model);
    setTestResult(null);
  }

  function handleProviderChange(name: string) {
    setFormName(name);
    // 已配置的供应商 → 填充已有配置
    const existing = providers.find(p => p.name === name);
    if (existing) { fillForm(existing); return; }
    // 预置供应商 → 填充默认值
    const preset = PRESETS[name];
    if (preset) { setFormUrl(preset.url); setFormModel(preset.model); setFormKey(''); }
    setHasExistingKey(false);
    setTestResult(null);
  }

  async function handleSave() {
    if (!formKey.trim() && !hasExistingKey) { toast.error('请填写 API Key'); return; }
    setSaving(true);
    try {
      const label = PRESETS[formName]?.label || formName;
      await api.post('/llm/speech/providers', { name: formName, label, baseUrl: formUrl, ...(formKey.trim() ? { apiKey: formKey } : {}), model: formModel });
      // 自动设为默认
      await api.put('/llm/speech/active', { provider: formName });
      // 刷新列表
      const data = await api.get<{ providers: typeof providers; active: string }>('/llm/speech/providers');
      setProviders(data.providers || []);
      setActiveProvider(data.active || formName);
      setSaved(true);
      setHasExistingKey(true);
      toast.success('语音识别配置已保存');
      setTimeout(() => setSaved(false), 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally { setSaving(false); }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post<{ success: boolean; message: string; latencyMs: number }>('/llm/speech/test', { provider: formName });
      setTestResult(res);
      setTimeout(() => setTestResult(null), 3000);
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : '测试失败', latencyMs: -1 });
      setTimeout(() => setTestResult(null), 3000);
    } finally { setTesting(false); }
  }

  if (loading) return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />加载中...</div>;

  const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none transition-all bg-background focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60';

  return (
    <div className="space-y-5">
      {/* 说明 */}
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 px-4 py-3 text-xs leading-relaxed text-indigo-600/70">
        <span className="font-medium text-indigo-700">语音识别</span> 通过 Whisper API 将录音转为文字。
        推荐 <b>Groq</b>（免费）或 <b>硅基流动</b>（国内免费）。
      </div>

      {/* 当前使用的供应商 */}
      {activeProvider && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          当前默认：<span className="font-medium text-foreground">{PRESETS[activeProvider]?.label || activeProvider}</span>
        </div>
      )}

      {/* 供应商选择 */}
      <div>
        <label className="mb-1.5 block text-2xs-plus font-medium text-muted-foreground">服务提供商</label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(PRESETS).map(([key, preset]) => (
            <button key={key} onClick={() => handleProviderChange(key)}
              className={cn('rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                formName === key ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-border text-foreground hover:bg-accent')}>
              {preset.label}
              {activeProvider === key && <span className="ml-1 text-2xs text-indigo-500">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div>
        <label className="mb-1.5 block text-2xs-plus font-medium text-muted-foreground">
          API Key {hasExistingKey && !formKey && <span className="text-indigo-500">（已保存，留空则保留）</span>}
        </label>
        <div className="relative">
          <input type={showKey ? 'text' : 'password'} value={formKey} onChange={e => { setFormKey(e.target.value); }}
            placeholder={formName === 'ollama' ? '本地服务无需填写' : hasExistingKey ? '已配置，如需更新请重新填写' : 'gsk_xxx 或 sk-xxx'} className={inputCls} />
          <button type="button" onClick={() => setShowKey(!showKey)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground">
            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        {formName === 'groq' && <p className="mt-1 text-2xs text-emerald-600">免费获取：console.groq.com → API Keys</p>}
        {formName === 'siliconflow' && <p className="mt-1 text-2xs text-emerald-600">国内免费注册：siliconflow.cn → API Keys。模型可选 FunAudioLLM/SenseVoiceSmall 或 TeleAI/TeleSpeechASR</p>}
      </div>

      {/* 地址 + 模型 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-2xs-plus font-medium text-muted-foreground">API 地址</label>
          <input value={formUrl} onChange={e => setFormUrl(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-2xs-plus font-medium text-muted-foreground">模型</label>
          <input value={formModel} onChange={e => setFormModel(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* 测速结果 */}
      {testResult && (
        <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
          testResult.success ? 'border-emerald-200 bg-emerald-50/50 text-emerald-700' : 'border-red-200 bg-red-50/50 text-red-600')}>
          {testResult.success ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          {testResult.message}{testResult.latencyMs != null && testResult.latencyMs > 0 ? ` (${testResult.latencyMs}ms)` : ''}
        </div>
      )}

      {/* 按钮 */}
      <div className="flex gap-2">
        <button onClick={handleTest} disabled={testing || (!formKey.trim() && !hasExistingKey && formName !== 'ollama')}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-4 text-xs font-medium transition-all hover:bg-accent disabled:opacity-50">
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
          测速
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-xs font-medium text-white transition-all hover:bg-indigo-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
          保存配置
        </button>
      </div>
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

  // 代理配置
  const [proxyUrl, setProxyUrl] = useState('');
  const [proxyTesting, setProxyTesting] = useState(false);
  const [proxyResult, setProxyResult] = useState<{ success: boolean; message: string; ip?: string } | null>(null);

  // 外部访问测试
  const [extTesting, setExtTesting] = useState(false);
  const [extResult, setExtResult] = useState<{ success: boolean; message: string } | null>(null);

  // SearXNG 配置
  const [searxngUrl, setSearxngUrl] = useState('');
  const [searxngTesting, setSearxngTesting] = useState(false);
  const [searxngResult, setSearxngResult] = useState<{ success: boolean; message: string; latency?: number; resultCount?: number } | null>(null);

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
        if (res.searxng_url) setSearxngUrl(res.searxng_url);
      })
      .catch(() => {});
    // 加载代理配置
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

  // 测试代理
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

  // 测试外部访问（直连，用国内可达的目标）
  async function handleExtTest() {
    setExtTesting(true);
    setExtResult(null);
    try {
      // 用华为连通性检测（国内服务器，稳定且快）
      const res = await fetch('https://connectivitycheck.platform.hicloud.com/generate_204', {
        signal: AbortSignal.timeout(5000), mode: 'no-cors',
      });
      // no-cors 模式下 status 为 0，但不报错就说明网络通了
      setExtResult({ success: true, message: '外网连接正常' });
      setTimeout(() => setExtResult(null), 3000);
    } catch {
      setExtResult({ success: false, message: '直连失败，需要代理才能访问外部网络' });
      setTimeout(() => setExtResult(null), 3000);
    } finally { setExtTesting(false); }
  }

  // 测试 SearXNG 连接
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
          {/* 分隔 */}
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

      {/* SearXNG 自托管搜索 */}
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

      {/* 网络代理配置 */}
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

  const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60';
  const selectCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60 bg-card';

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">配置群机器人 Webhook，定时任务和 AI 可自动推送消息到群聊。每个推送目标需要设置一个昵称，AI 通过昵称识别发送目标。</p>
        </div>
        <button onClick={() => setAddOpen(true)}
          className="flex h-9 items-center gap-1 rounded-lg bg-indigo-600 px-3.5 text-sm font-medium text-white transition-all hover:bg-indigo-700 active:scale-95">
          <Plus className="h-4 w-4" />添加推送
        </button>
      </div>

      {webhooks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">暂未配置推送目标</p>
          <p className="mt-1 text-2xs-plus text-muted-foreground">点击"添加推送"配置企业微信/飞书/钉钉群机器人</p>
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
                  <p className="text-2xs-plus text-muted-foreground">{ch?.label || wh.channel}</p>
                </div>
                {/* URL */}
                <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{wh.url}</p>
                {/* 操作按钮 */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <button onClick={() => handleTest(wh)} disabled={testing === wh.name}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground/60 transition-all hover:bg-accent disabled:opacity-50">
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
                <Select value={addChannel} onValueChange={v => setAddChannel(v || 'wechat')}>
                  <SelectTrigger className={cn(selectCls, "w-full")}><SelectValue placeholder="选择渠道" /></SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map(ch => <SelectItem key={ch.value} value={ch.value}>{ch.icon} {ch.label}</SelectItem>)}
                  </SelectContent>
                </Select>
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

  const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60';

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground/80">n8n Webhook 地址</label>
        <input type="url" value={n8nWebhook} onChange={(e) => setN8nWebhook(e.target.value)}
          placeholder="https://n8n.example.com/webhook/xxx" className={inputCls} />
        <p className="mt-1 text-2xs-plus text-muted-foreground">n8n 自动化工作流的回调地址</p>
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
                  <p className="text-2xs-plus text-muted-foreground">IP: {s.ip} · {new Date(s.createdAt).toLocaleDateString('zh-CN')}</p>
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
          <span className="text-2xs-plus text-muted-foreground">CSV 格式</span>
        </button>
        <button className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card transition-all hover:border-indigo-300 hover:shadow-sm">
          <Download className="h-6 w-6 text-emerald-500" />
          <span className="text-sm font-medium text-foreground/80">导出客户数据</span>
          <span className="text-2xs-plus text-muted-foreground">CSV 格式</span>
        </button>
      </div>

      <button className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground/70 transition-colors hover:bg-accent">
        <Database className="h-4 w-4 text-muted-foreground" />
        清除本地缓存
      </button>

      <div className="rounded-lg border border-red-200 bg-red-50/30 px-4 py-4 dark:border-red-800/50 dark:bg-red-950/30">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">危险操作</h3>
        <p className="mt-1 text-xs text-red-400">账号注销将删除所有数据，此操作不可恢复</p>
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
    { key: 'stt', label: '语音识别', icon: Mic },
    { key: 'search', label: '搜索配置', icon: Search },
    { key: 'integration', label: '集成管理', icon: Link },
    { key: 'email', label: '邮件设置', icon: Mail },
    { key: 'push', label: '推送管理', icon: Bell },
    { key: 'security', label: '安全设置', icon: Shield },
    { key: 'data', label: '数据管理', icon: Database },
  ];

  return (
    <div className="mx-auto max-w-4xl page-enter">

      {/* 分类标签 */}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 scrollbar-none">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn('flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium transition-all',
              activeTab === tab.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent')}>
            <tab.icon className="h-3.5 w-3.5" />{tab.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
        {activeTab === 'ai' && <AIConfig />}
        {activeTab === 'stt' && <SttConfig />}
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
