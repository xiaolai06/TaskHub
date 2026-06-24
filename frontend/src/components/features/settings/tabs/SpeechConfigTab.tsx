'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff, Wifi } from 'lucide-react';

export function SpeechConfigTab() {
  const [providers, setProviders] = useState<{ name: string; label: string; baseUrl: string; apiKey: string; model: string; language: string }[]>([]);
  const [activeProvider, setActiveProvider] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);

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
    const existing = providers.find(p => p.name === name);
    if (existing) { fillForm(existing); return; }
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
      await api.put('/llm/speech/active', { provider: formName });
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
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 px-4 py-3 text-xs leading-relaxed text-indigo-600/70">
        <span className="font-medium text-indigo-700">语音识别</span> 通过 Whisper API 将录音转为文字。
        推荐 <b>Groq</b>（免费）或 <b>硅基流动</b>（国内免费）。
      </div>

      {activeProvider && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          当前默认：<span className="font-medium text-foreground">{PRESETS[activeProvider]?.label || activeProvider}</span>
        </div>
      )}

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

      {testResult && (
        <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
          testResult.success ? 'border-emerald-200 bg-emerald-50/50 text-emerald-700' : 'border-red-200 bg-red-50/50 text-red-600')}>
          {testResult.success ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          {testResult.message}{testResult.latencyMs != null && testResult.latencyMs > 0 ? ` (${testResult.latencyMs}ms)` : ''}
        </div>
      )}

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
