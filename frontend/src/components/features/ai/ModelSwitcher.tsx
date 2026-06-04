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
  onSelect: (modelId: string | undefined) => void;
}

export function ModelSwitcher({ selectedModel, onSelect }: ModelSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [allModels, setAllModels] = useState<AllModelsResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProvider, setActiveProvider] = useState('deepseek');
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // 防止竞态：用 ref 追踪最新一次请求
  const requestIdRef = useRef(0);

  // 页面加载时获取所有已配置供应商的模型
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const rid = ++requestIdRef.current;
      try {
        const aiSettings = await api.get<Record<string, string> | null>('/settings/ai');
        if (cancelled || rid !== requestIdRef.current) return;
        setActiveProvider(aiSettings?.provider || 'deepseek');

        const results = await api.get<AllModelsResult[]>('/settings/ai/all-models');
        if (cancelled || rid !== requestIdRef.current) return;
        setAllModels(results);
      } catch {
        if (!cancelled && rid === requestIdRef.current) setAllModels([]);
      } finally {
        if (!cancelled && rid === requestIdRef.current) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // 刷新时保留已有数据，失败不清空
  async function handleRefresh() {
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
      // 刷新失败不清空已有模型
    } finally {
      if (rid === requestIdRef.current) setLoading(false);
    }
  }

  // 打开下拉时滚动到选中模型
  useEffect(() => {
    if (open && selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [open]);

  // 有模型的供应商列表
  const providersWithModels = useMemo(() =>
    allModels.filter(g => g.models.length > 0),
    [allModels],
  );

  // 获取失败的供应商
  const failedProviders = useMemo(() =>
    allModels.filter(g => g.error && g.models.length === 0),
    [allModels],
  );

  // 当前选中的模型信息
  const currentModel = useMemo(() => {
    for (const g of allModels) {
      const found = g.models.find(m => m.id === selectedModel);
      if (found) return { ...found, providerLabel: g.label };
    }
    return null;
  }, [allModels, selectedModel]);

  const displayName = currentModel?.name || '默认模型';
  const displayId = currentModel?.id || '';

  return (
    <div className="relative border-t border-border px-3 py-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted"
      >
        <Zap className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-foreground/70 truncate">{displayName}</p>
          {displayId && <p className="text-[10px] text-muted-foreground truncate">{displayId}</p>}
        </div>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-2 right-2 z-20 mb-1 rounded-xl border border-border bg-background shadow-xl overflow-hidden">
            {/* 标题 */}
            <div className="border-b border-border px-3 py-2 bg-muted/50 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">选择模型</p>
              <span className="text-[10px] text-muted-foreground/50">{providersWithModels.length} 个供应商</span>
            </div>

            <div ref={listRef} className="max-h-[320px] overflow-y-auto">
              {loading && allModels.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">获取模型列表...</span>
                </div>
              ) : providersWithModels.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-[12px] text-muted-foreground">暂无可用模型</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/50">请在设置页配置 AI 供应商和 API Key</p>
                </div>
              ) : (
                <>
                  {providersWithModels.map((group, gi) => (
                    <div key={group.provider} className={cn('px-1.5', gi === 0 ? 'pt-1.5 pb-0.5' : 'pt-1 pb-0.5 border-t border-border')}>
                      {/* 供应商分组标题 */}
                      <p className={cn('px-2 text-[10px] font-semibold tracking-wide',
                        group.provider === activeProvider ? 'text-indigo-500' : 'text-muted-foreground',
                      )}>
                        {group.label}
                        {group.provider === activeProvider && <span className="ml-1 text-[9px] font-normal opacity-60">当前</span>}
                      </p>
                      {group.models.map((m) => {
                        const isSelected = selectedModel === m.id;
                        return (
                          <button
                            key={`${group.provider}-${m.id}`}
                            ref={isSelected ? selectedRef : undefined}
                            onClick={() => { onSelect(m.id); setOpen(false); }}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                              isSelected ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'hover:bg-accent',
                            )}
                          >
                            <span className={cn('flex-1 truncate text-[12px]',
                              isSelected ? 'font-medium text-indigo-700 dark:text-indigo-300' : 'text-foreground/80',
                            )}>
                              {m.name}
                            </span>
                            {m.tier === 'powerful' && (
                              <span className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                                强力
                              </span>
                            )}
                            {isSelected && (
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[9px] text-white">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}

                  {/* 获取失败的供应商提示 */}
                  {failedProviders.length > 0 && (
                    <div className="mx-1.5 mb-1 mt-0.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 dark:border-amber-800 dark:bg-amber-950/30">
                      {failedProviders.map(fp => (
                        <div key={fp.provider} className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-500">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          <span className="font-medium">{fp.label}</span>
                          <span className="opacity-60">— {fp.error}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 底部操作 */}
            <div className="border-t border-border px-1.5 py-1 flex gap-1">
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/70"
              >
                <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
                刷新列表
              </button>
              <a
                href="/main/settings"
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground/70"
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
