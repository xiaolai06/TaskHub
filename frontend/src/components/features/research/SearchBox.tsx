'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SOURCE_CONFIG } from './source-config';
import type { GroupedHistory } from '@/hooks/useResearch';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  searching: boolean;
  historyGrouped: GroupedHistory[];
  onClearHistory: () => void;
}

export function SearchBox({ value, onChange, onSearch, searching, historyGrouped, onClearHistory }: SearchBoxProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-card px-3 py-2.5 transition-all hover:border-indigo-300 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-200">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => historyGrouped.length > 0 && setShowDropdown(true)}
          placeholder="搜索 GitHub · HN · Dev.to · DuckDuckGo · SearXNG..."
          onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onSearch(value); }}
          className="flex-1 bg-transparent text-sm text-foreground/80 outline-none placeholder:text-muted-foreground/60"
        />
        <button
          onClick={() => { if (value.trim()) onSearch(value); }}
          disabled={searching || !value.trim()}
          className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 shrink-0">
          {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          搜索
        </button>
      </div>

      {showDropdown && historyGrouped.length > 0 && (
        <div ref={dropdownRef}
          className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
            <span className="text-2xs font-medium text-muted-foreground">最近搜索</span>
            <button onClick={onClearHistory}
              className="text-2xs text-muted-foreground/60 hover:text-red-500 transition-colors">
              清空
            </button>
          </div>
          <div className="px-1 pb-1.5">
            {historyGrouped.slice(0, 6).map((h) => (
              <button key={h.query}
                onClick={() => { setShowDropdown(false); onSearch(h.query); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-accent">
                <Clock className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                <span className="flex-1 truncate text-sm text-foreground/80">{h.query}</span>
                <span className="flex items-center gap-1 shrink-0">
                  {Object.entries(h.sources).map(([src, count]) => (
                    <span key={src} className="flex items-center gap-0.5">
                      <span className={cn('inline-block h-1.5 w-1.5 rounded-full', SOURCE_CONFIG[src]?.dotColor ?? 'bg-gray-300')} />
                      <span className="text-2xs text-muted-foreground/50">{count}</span>
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
