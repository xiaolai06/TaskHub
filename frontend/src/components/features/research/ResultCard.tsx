'use client';

import { useState } from 'react';
import { ExternalLink, ChevronDown, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSourceMeta } from './source-config';
import type { SearchResultItem } from '@/hooks/useResearch';

interface ResultCardProps {
  item: SearchResultItem;
  index: number;
  onSave: (item: SearchResultItem) => void;
}

export function ResultCard({ item, index, onSave }: ResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cfg = getSourceMeta(item.source);
  const isLong = item.snippet.length > 100;

  return (
    <div className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-indigo-200 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs', cfg.color)}>
          <cfg.icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer"
                className="truncate text-sm font-semibold text-foreground transition-colors hover:text-indigo-600 hover:underline">
                {item.title}
              </a>
            ) : (
              <h3 className="truncate text-sm font-semibold text-foreground">{item.title}</h3>
            )}
            <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-medium', cfg.color)}>
              {cfg.label}
            </span>
            {item.extra && (
              <span className="text-2xs text-muted-foreground font-mono">{item.extra}</span>
            )}
          </div>
          <p className={cn(
            'mt-1 text-xs leading-relaxed text-muted-foreground',
            !expanded && isLong && 'line-clamp-2',
          )}>{item.snippet}</p>
          {isLong && (
            <button onClick={() => setExpanded(prev => !prev)}
              className="mt-1 flex items-center gap-0.5 text-2xs text-indigo-500 hover:text-indigo-600">
              {expanded ? '收起' : '展开全部'}
              <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
            </button>
          )}
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-indigo-500">
              <ExternalLink className="h-3 w-3" />
              打开链接
            </a>
          )}
        </div>
        <button
          onClick={() => onSave(item)}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground/30 opacity-0 transition-all hover:bg-amber-50 hover:text-amber-500 group-hover:opacity-100"
          title="收藏">
          <Star className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
