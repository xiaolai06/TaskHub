'use client';

import { useState } from 'react';
import { Search, Globe, History as HistoryIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSourceMeta, SOURCE_CONFIG } from './source-config';
import { BriefingCard } from './BriefingCard';
import { useHistoryResults } from '@/hooks/useResearch';
import type { GroupedHistory, BriefingItem, SearchResultItem } from '@/hooks/useResearch';

interface HistoryListProps {
  historyGrouped: GroupedHistory[];
  historyBriefings: BriefingItem[];
  historyFilter: 'all' | 'search' | 'analysis';
  onDeleteBriefing: (id: string) => void;
  onToggleBriefingSave?: (id: string) => void;
  onResearch: (query: string) => void;
}

export function HistoryList({ historyGrouped, historyBriefings, historyFilter, onDeleteBriefing, onToggleBriefingSave, onResearch }: HistoryListProps) {
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);

  if (historyGrouped.length === 0 && historyBriefings.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-12">
        <HistoryIcon className="h-10 w-10 text-slate-200" />
        <p className="mt-3 text-sm text-muted-foreground">暂无历史记录</p>
        <p className="mt-1 text-xs text-muted-foreground">搜索内容后会自动记录到这里</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(historyFilter === 'all' || historyFilter === 'search') && historyGrouped.length > 0 && (
        <div className="space-y-2">
          {historyFilter === 'all' && <h3 className="mb-1 text-xs font-medium text-muted-foreground">搜索记录</h3>}
          {historyGrouped.map((h) => (
            <HistoryGroupItem
              key={h.query}
              group={h}
              isExpanded={expandedQuery === h.query}
              onToggle={() => setExpandedQuery(prev => prev === h.query ? null : h.query)}
              onResearch={onResearch}
            />
          ))}
        </div>
      )}

      {(historyFilter === 'all' || historyFilter === 'analysis') && historyBriefings.length > 0 && (
        <div className="space-y-2">
          {historyFilter === 'all' && <h3 className={cn('text-xs font-medium text-muted-foreground', historyGrouped.length > 0 && 'mb-1')}>AI 分析</h3>}
          {historyBriefings.map((b) => (
            <BriefingCard
              key={b.id}
              briefing={b}
              onDelete={onDeleteBriefing}
              onToggleSave={onToggleBriefingSave}
              onResearch={onResearch}
              showResearch
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryGroupItem({ group, isExpanded, onToggle, onResearch }: {
  group: GroupedHistory;
  isExpanded: boolean;
  onToggle: () => void;
  onResearch: (q: string) => void;
}) {
  const { data: results, isFetching } = useHistoryResults(isExpanded ? group.query : null, true);

  return (
    <div className="group rounded-xl border border-border bg-card transition-colors hover:border-indigo-200 hover:shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 cursor-pointer" onClick={onToggle} />
        <div className="min-w-0 flex-1 cursor-pointer" onClick={onToggle}>
          <span className="text-sm font-medium text-foreground">{group.query}</span>
          <div className="mt-0.5 flex items-center gap-2">
            {Object.entries(group.sources).map(([src, count]) => {
              const cfg = SOURCE_CONFIG[src];
              return (
                <span key={src} className="flex items-center gap-0.5 text-2xs text-muted-foreground">
                  <span className={cn('inline-block h-1.5 w-1.5 rounded-full', cfg?.dotColor ?? 'bg-gray-300')} />
                  {cfg?.label ?? src}×{count}
                </span>
              );
            })}
            <span className="text-2xs text-muted-foreground/50">
              {new Date(group.latestAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        <button onClick={() => onResearch(group.query)}
          className="shrink-0 rounded-lg px-2 py-1 text-2xs text-indigo-500 opacity-0 transition-all hover:bg-indigo-50 group-hover:opacity-100">
          重新搜索
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-border/50 px-4 pb-3 pt-2">
          {isFetching ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              <span className="ml-2 text-xs text-muted-foreground">加载结果...</span>
            </div>
          ) : results && results.length > 0 ? (
            <div className="space-y-1.5">
              {results.slice(0, 8).map((r, i) => {
                const cfg = getSourceMeta(r.source);
                return (
                  <div key={`${r.url}-${i}`} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/50 transition-colors">
                    <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded text-2xs mt-0.5', cfg.color)}>
                      <cfg.icon className="h-3 w-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noreferrer"
                          className="text-xs font-medium text-foreground hover:text-indigo-600 hover:underline line-clamp-1">
                          {r.title}
                        </a>
                      ) : (
                        <span className="text-xs font-medium text-foreground line-clamp-1">{r.title}</span>
                      )}
                      <p className="text-2xs text-muted-foreground line-clamp-1 mt-0.5">{r.snippet}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2 text-center">无缓存结果</p>
          )}
        </div>
      )}
    </div>
  );
}
