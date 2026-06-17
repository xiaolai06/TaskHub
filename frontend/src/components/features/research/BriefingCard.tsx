'use client';

import { useState } from 'react';
import { BarChart3, Clock, Trash2, Bookmark, BookmarkCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/features/ai/MarkdownRenderer';
import type { BriefingItem } from '@/hooks/useResearch';

interface BriefingCardProps {
  briefing: BriefingItem;
  onDelete: (id: string) => void;
  onToggleSave?: (id: string) => void;
  onResearch?: (query: string) => void;
  showResearch?: boolean;
}

export function BriefingCard({ briefing, onDelete, onToggleSave, onResearch, showResearch }: BriefingCardProps) {
  const [expanded, setExpanded] = useState(false);
  let tags: string[] = [];
  try { tags = JSON.parse(briefing.tags); } catch { /* ignore */ }

  return (
    <div className="group rounded-xl border border-border bg-card transition-colors hover:border-amber-200 hover:shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        <BarChart3 className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-foreground">{briefing.title}</span>
          <div className="mt-0.5 flex items-center gap-2 flex-wrap">
            {tags.slice(0, 3).map(tag => (
              <span key={tag} className="rounded-full bg-amber-50 px-1.5 py-0.5 text-2xs text-amber-600 border border-amber-100">{tag}</span>
            ))}
            <span className="flex items-center gap-1 text-2xs text-muted-foreground/50">
              <Clock className="h-3 w-3" />
              {new Date(briefing.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {onToggleSave && (
            <button onClick={() => onToggleSave(briefing.id)}
              className={cn(
                'rounded-lg p-1 transition-colors',
                briefing.saved
                  ? 'text-amber-500 hover:bg-amber-50'
                  : 'text-muted-foreground/40 hover:bg-amber-50 hover:text-amber-500',
              )}
              title={briefing.saved ? '取消收藏' : '收藏'}>
              {briefing.saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
            </button>
          )}
          {showResearch && briefing.query && (
            <button onClick={() => onResearch?.(briefing.query!)}
              className="rounded-lg px-2 py-1 text-2xs text-indigo-500 hover:bg-indigo-50 transition-colors">
              重新搜索
            </button>
          )}
          <button onClick={() => setExpanded(prev => !prev)}
            className="rounded-lg px-2 py-1 text-2xs text-muted-foreground hover:bg-muted transition-colors">
            {expanded ? '收起' : '展开'}
          </button>
          <button onClick={() => onDelete(briefing.id)}
            className="rounded-lg p-1 text-muted-foreground/40 hover:bg-red-50 hover:text-red-500 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3">
          <div className="prose prose-sm max-w-none text-sm text-foreground/80 leading-relaxed">
            <MarkdownRenderer content={briefing.content} />
          </div>
        </div>
      )}
    </div>
  );
}
