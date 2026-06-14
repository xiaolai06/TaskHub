'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { ChevronDown, Settings, Zap, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface AIModel {
  id: string;
  name: string;
  tier: 'fast' | 'balanced' | 'powerful';
}

interface AllModelsResult {
  provider: string;
  label: string;
  models: AIModel[];
  error?: string;
}

interface ModelSwitcherProps {
  selectedModel?: string;
  selectedModelName?: string;
  onSelect: (modelId: string | undefined, provider?: string, modelName?: string) => void;
  open?: boolean; // 父面板是否展开，展开时重新加载模型
}

export function ModelSwitcher({ selectedModel, selectedModelName, onSelect, open: panelOpen }: ModelSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [allModels, setAllModels] = useState<AllModelsResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProvider, setActiveProvider] = useState('deepseek');
  const [viewProvider, setViewProvider] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const requestIdRef = useRef(0);

  // 加载模型（提取为独立函数，可复用）
  const loadModels = async () => {
    setLoading(true);
    const rid = ++requestIdRef.current;
    try {
      const aiSettings = await api.get<Record<string, string> | null>('/settings/ai');
      if (rid !== requestIdRef.current) return;
      setActiveProvider(aiSettings?.provider || 'deepseek');

      const results = await api.get<AllModelsResult[]>('/settings/ai/all-models');
      if (rid !== requestIdRef.current) return;
      setAllModels(results);
    } catch {
      if (rid === requestIdRef.current) setAllModels([]);
    } finally {
      if (rid === requestIdRef.current) setLoading(false);
    }
  };

  // 首次加载 + 面板展开时刷新
  useEffect(() => {
    let cancelled = false;
    const wrapper = async () => { if (!cancelled) await loadModels(); };
    wrapper();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 面板每次展开时刷新模型列表 + 重置到激活供应商（解决设置页切换供应商后不更新的问题）
  useEffect(() => {
    if (panelOpen) {
      setViewProvider(null); // 重置到激活供应商
      loadModels();
    }
  }, [panelOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    await loadModels();
  }

  useEffect(() => {
    if (open && selectedRef.current) selectedRef.current.scrollIntoView({ block: 'nearest' });
  }, [open]);

  const providersWithModels = useMemo(() => allModels.filter(g => g.models.length > 0), [allModels]);
  const failedProviders = useMemo(() => allModels.filter(g => g.error && g.models.length === 0), [allModels]);

  // 当前显示的供应商（默认为激活供应商）
  const currentViewProvider = viewProvider || activeProvider;
  const currentGroup = providersWithModels.find(g => g.provider === currentViewProvider);
  const displayModels = currentGroup?.models ?? [];

  // 选中模型信息（优先用父组件传入的 modelName，其次从 allModels 查找）
  const currentModel = useMemo(() => {
    if (selectedModel && selectedModelName) {
      // 还需要找到对应的 provider label
      for (const g of allModels) {
        const found = g.models.find(m => m.id === selectedModel);
        if (found) return { id: found.id, name: found.name, providerLabel: g.label };
      }
      return { id: selectedModel, name: selectedModelName, providerLabel: undefined };
    }
    for (const g of allModels) {
      const found = g.models.find(m => m.id === selectedModel);
      if (found) return { id: found.id, name: found.name, providerLabel: g.label };
    }
    return null;
  }, [allModels, selectedModel, selectedModelName]);

  const displayName = currentModel?.name || '默认模型';
  const displayId = currentModel?.id || '';
  const displayProvider = currentModel?.providerLabel;

  return (
    <div className="relative border-t border-border px-3 py-2">
      <button onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted">
        <Zap className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
        <div className="min-w-0 flex-1">
          <p className="text-2xs-plus font-medium text-foreground/70 truncate">
            {displayName}
            {displayProvider && displayId && (
              <span className="ml-1 text-2xs font-normal text-muted-foreground/60">· {displayProvider}</span>
            )}
          </p>
          {displayId && <p className="text-2xs text-muted-foreground truncate">{displayId}</p>}
        </div>
        {loading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          : <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setViewProvider(null); }} />
          <div className="absolute bottom-full left-2 right-2 z-20 mb-1 rounded-xl border border-border bg-background shadow-xl overflow-hidden">
            {/* 供应商切换 tabs */}
            <div className="border-b border-border px-2 py-1.5 bg-muted/50 flex items-center gap-0.5 overflow-x-auto">
              {providersWithModels.map(g => (
                <button key={g.provider} onClick={() => setViewProvider(g.provider)}
                  className={cn('shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                    currentViewProvider === g.provider
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:bg-accent')}>
                  {g.label}
                </button>
              ))}
              {providersWithModels.length > 1 && (
                <span className="shrink-0 text-2xs text-muted-foreground/40 ml-auto">{providersWithModels.length} 个</span>
              )}
            </div>

            {/* 模型列表 — 只显示当前选中供应商的模型 */}
            <div ref={listRef} className="max-h-[260px] overflow-y-auto">
              {/* 恢复默认按钮 */}
              {selectedModel && (
                <div className="px-1.5 pt-1.5">
                  <button onClick={() => { onSelect(undefined, undefined, undefined); setOpen(false); setViewProvider(null); }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent">
                    <span className="flex-1 truncate text-xs text-muted-foreground">🔄 恢复默认模型</span>
                  </button>
                </div>
              )}

              {loading && allModels.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-2xs-plus text-muted-foreground">获取模型列表...</span>
                </div>
              ) : displayModels.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    {currentGroup?.error || '暂无可用模型'}
                  </p>
                </div>
              ) : (
                <div className="px-1.5 py-1.5">
                  {displayModels.map((m) => {
                    const isSelected = selectedModel === m.id;
                    return (
                      <button key={m.id} ref={isSelected ? selectedRef : undefined}
                        onClick={() => {
                          onSelect(m.id, currentViewProvider, m.name);
                          setOpen(false); setViewProvider(null);
                        }}
                        className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                          isSelected ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'hover:bg-accent')}>
                        <span className={cn('flex-1 truncate text-xs',
                          isSelected ? 'font-medium text-indigo-700 dark:text-indigo-300' : 'text-foreground/80')}>
                          {m.name}
                        </span>
                        {m.tier === 'powerful' && (
                          <span className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-2xs font-medium text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">强力</span>
                        )}
                        {isSelected && (
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-2xs text-white">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {failedProviders.length > 0 && (
                <div className="mx-1.5 mb-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 dark:border-amber-800 dark:bg-amber-950/30">
                  {failedProviders.map(fp => (
                    <div key={fp.provider} className="flex items-center gap-1 text-2xs text-amber-600 dark:text-amber-500">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span className="font-medium">{fp.label}</span>
                      <span className="opacity-60">— {fp.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 底部操作 */}
            <div className="border-t border-border px-1.5 py-1 flex gap-1">
              <button onClick={handleRefresh}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-2xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/70">
                <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
                刷新
              </button>
              <a href="/main/settings"
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-2xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/70">
                <Settings className="h-3 w-3" />
                配置
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
