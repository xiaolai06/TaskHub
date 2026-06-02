'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Settings, Zap, Brain, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface AIModel {
  id: string;
  name: string;
  tier: 'fast' | 'balanced' | 'powerful';
}

interface ModelSwitcherProps {
  selectedModel?: string;
  onSelect: (modelId: string | undefined) => void;
}

export function ModelSwitcher({ selectedModel, onSelect }: ModelSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState('deepseek');

  // 加载模型列表：先从设置读 provider，再调用 fetch-models 从供应商 API 获取
  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        // 1. 读取用户 AI 配置
        const aiSettings = await api.get<Record<string, string>>('/settings/ai');
        const p = aiSettings.provider || 'deepseek';
        setProvider(p);

        // 2. 如果有 apiKey，从供应商 API 动态获取模型列表
        const apiKey = aiSettings.api_key;
        if (apiKey && apiKey !== '***') {
          const res = await api.post<{ models: AIModel[]; error?: string }>('/settings/ai/fetch-models', {
            provider: p,
            apiKey,
            baseUrl: aiSettings.base_url || undefined,
          });
          if (res.models && res.models.length > 0) {
            setModels(res.models);
            setLoading(false);
            return;
          }
        }
      } catch { /* ignore */ }

      // 3. Fallback：没有 API key 时用静态列表
      try {
        const res = await api.get<{ models: AIModel[] }>(`/settings/ai/models?provider=${provider}`);
        setModels(res.models || []);
      } catch { setModels([]); }

      setLoading(false);
    })();
  }, []);

  const fastModels = models.filter(m => m.tier === 'fast' || m.tier === 'balanced');
  const powerfulModels = models.filter(m => m.tier === 'powerful');
  const currentModel = models.find(m => m.id === selectedModel);

  const displayName = currentModel?.name || '默认模型';
  const displayId = currentModel?.id || '';

  return (
    <div className="relative border-t border-slate-200 px-3 py-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted"
      >
        <Zap className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-slate-600 truncate">{displayName}</p>
          {displayId && <p className="text-[10px] text-slate-500 truncate">{displayId}</p>}
        </div>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
        ) : (
          <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition-transform', open && 'rotate-180')} />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-2 right-2 z-20 mb-1 rounded-xl border border-slate-200 bg-background shadow-xl overflow-hidden">
            {/* 标题 */}
            <div className="border-b border-slate-100 px-3 py-2 bg-muted/50 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">选择模型</p>
              <span className="text-[10px] text-slate-300">{provider}</span>
            </div>

            <div className="max-h-[220px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  <span className="text-[11px] text-slate-500">获取模型列表...</span>
                </div>
              ) : models.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-[12px] text-slate-500">暂无可用模型</p>
                  <p className="mt-1 text-[11px] text-slate-300">请在设置页配置 AI 供应商和 API Key</p>
                </div>
              ) : (
                <>
                  {fastModels.length > 0 && (
                    <div className="px-1.5 pt-1.5 pb-0.5">
                      <p className="px-2 text-[10px] font-medium text-slate-500">⚡ 快速模型</p>
                      {fastModels.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { onSelect(m.id); setOpen(false); }}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                            selectedModel === m.id ? 'bg-indigo-50' : 'hover:bg-slate-50',
                          )}
                        >
                          <span className={cn('flex-1 truncate text-[12px]', selectedModel === m.id ? 'font-medium text-indigo-700' : 'text-slate-700')}>
                            {m.name}
                          </span>
                          {selectedModel === m.id && (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[9px] text-white">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {powerfulModels.length > 0 && (
                    <div className="px-1.5 pt-0.5 pb-1 border-t border-slate-100">
                      <p className="px-2 text-[10px] font-medium text-amber-500">🧠 强力模型</p>
                      {powerfulModels.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { onSelect(m.id); setOpen(false); }}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                            selectedModel === m.id ? 'bg-indigo-50' : 'hover:bg-slate-50',
                          )}
                        >
                          <span className={cn('flex-1 truncate text-[12px]', selectedModel === m.id ? 'font-medium text-indigo-700' : 'text-slate-700')}>
                            {m.name}
                          </span>
                          {selectedModel === m.id && (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[9px] text-white">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 底部操作 */}
            <div className="border-t border-slate-100 px-1.5 py-1 flex gap-1">
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const aiSettings = await api.get<Record<string, string>>('/settings/ai');
                    const p = aiSettings.provider || provider;
                    const apiKey = aiSettings.api_key;
                    if (apiKey && apiKey !== '***') {
                      const res = await api.post<{ models: AIModel[] }>('/settings/ai/fetch-models', {
                        provider: p, apiKey,
                        baseUrl: aiSettings.base_url || undefined,
                      });
                      if (res.models?.length) setModels(res.models);
                    }
                  } catch { } finally { setLoading(false); }
                }}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-600"
              >
                <RefreshCw className="h-3 w-3" />
                刷新列表
              </button>
              <a
                href="/main/settings"
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-600"
              >
                <Settings className="h-3 w-3" />
                配置更多模型
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
