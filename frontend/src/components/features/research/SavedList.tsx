'use client';

import { useState } from 'react';
import { Bookmark, BarChart3, Clock, Trash2, ChevronDown, BookmarkCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/features/ai/MarkdownRenderer';
import { getSourceMeta } from './source-config';
import type { SavedItem, BriefingItem } from '@/hooks/useResearch';

interface SavedListProps {
  savedItems: SavedItem[];
  savedBriefings: BriefingItem[];
  allTags: string[];
  tagFilter: string;
  onTagFilterChange: (tag: string) => void;
  onDelete: (id: string) => void;
  onToggleBriefingSave?: (id: string) => void;
}

export function SavedList({ savedItems, savedBriefings, allTags, tagFilter, onTagFilterChange, onDelete, onToggleBriefingSave }: SavedListProps) {
  const [expandedSavedId, setExpandedSavedId] = useState<string | null>(null);
  const [expandedBriefingId, setExpandedBriefingId] = useState<string | null>(null);

  if (savedItems.length === 0 && savedBriefings.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-12">
        <Bookmark className="h-10 w-10 text-slate-200" />
        <p className="mt-3 text-sm text-muted-foreground">暂无收藏</p>
        <p className="mt-1 text-xs text-muted-foreground">在"搜索发现"中点击星标收藏内容，或进行 AI 分析</p>
      </div>
    );
  }

  return (
    <div>
      {allTags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button onClick={() => onTagFilterChange('')}
            className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors',
              !tagFilter ? 'bg-indigo-100 text-indigo-600' : 'bg-muted text-muted-foreground hover:bg-accent')}>
            全部
          </button>
          {allTags.map((tag) => (
            <button key={tag} onClick={() => onTagFilterChange(tag === tagFilter ? '' : tag)}
              className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors',
                tagFilter === tag ? 'bg-indigo-100 text-indigo-600' : 'bg-muted text-muted-foreground hover:bg-accent')}>
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {savedItems.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">搜索收藏</h3>
            <div className="space-y-2">
              {savedItems.map((item) => {
                let tags: string[] = [];
                try { tags = JSON.parse(item.tags); } catch { /* ignore */ }
                const srcCfg = tags[0] ? getSourceMeta(tags[0]) : null;
                const isExpanded = expandedSavedId === item.id;
                const isLong = item.content.length > 100;
                return (
                  <div key={item.id}
                    className="group rounded-xl border border-border bg-card transition-colors hover:border-indigo-200 hover:shadow-sm">
                    <div className="flex items-start gap-3 p-4">
                      {srcCfg && (
                        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs', srcCfg.color)}>
                          <srcCfg.icon className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                        <p className={cn(
                          'mt-1 text-xs leading-relaxed text-muted-foreground',
                          !isExpanded && 'line-clamp-2',
                        )}>{isExpanded ? item.content : item.summary}</p>
                        {isLong && (
                          <button onClick={() => setExpandedSavedId(isExpanded ? null : item.id)}
                            className="mt-1 flex items-center gap-0.5 text-2xs text-indigo-500 hover:text-indigo-600">
                            {isExpanded ? '收起' : '展开全部'}
                            <ChevronDown className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-180')} />
                          </button>
                        )}
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-2xs', srcCfg?.color ?? 'bg-muted text-muted-foreground')}>
                            {srcCfg?.label ?? tags[0] ?? '未知'}
                          </span>
                          {tags.filter(t => !getSourceMeta(t).label).map(t => (
                            <span key={t} className="rounded-full bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">{t}</span>
                          ))}
                          <span className="text-2xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(item.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => onDelete(item.id)}
                        className="shrink-0 rounded-lg p-1.5 text-muted-foreground/30 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {savedBriefings.length > 0 && (
          <div>
            <h3 className={cn('text-xs font-medium text-muted-foreground', savedItems.length > 0 && 'mt-4 mb-2')}>分析简报</h3>
            <div className="space-y-2">
              {savedBriefings.map((b) => {
                let tags: string[] = [];
                try { tags = JSON.parse(b.tags); } catch { /* ignore */ }
                const isExpanded = expandedBriefingId === b.id;
                return (
                  <div key={b.id}
                    className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-amber-200 hover:shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <button onClick={() => setExpandedBriefingId(isExpanded ? null : b.id)}
                          className="flex items-center gap-2 text-left w-full">
                          <BarChart3 className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <h4 className="text-sm font-semibold text-foreground">{b.title}</h4>
                        </button>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          {tags.map(tag => (
                            <span key={tag} className="rounded-full bg-amber-50 px-1.5 py-0.5 text-2xs text-amber-600 border border-amber-100">{tag}</span>
                          ))}
                          <span className="flex items-center gap-1 text-2xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(b.createdAt).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                      </div>
                      {onToggleBriefingSave && (
                        <button onClick={() => onToggleBriefingSave(b.id)}
                          className="shrink-0 rounded-lg p-1.5 text-amber-500 opacity-0 transition-all hover:bg-amber-50 group-hover:opacity-100"
                          title="取消收藏">
                          <BookmarkCheck className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="mt-3 border-t border-border/50 pt-3">
                        <div className="prose prose-sm max-w-none text-sm text-foreground/80 leading-relaxed">
                          <MarkdownRenderer content={b.content} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
