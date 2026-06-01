'use client';

import { Loader2, Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface ToolCallItem {
  name: string;
  icon: string;
  label: string;
  status: 'calling' | 'done' | 'error';
  summary?: string;
}

interface ToolCallBarProps {
  tools: ToolCallItem[];
}

export function ToolCallBar({ tools }: ToolCallBarProps) {
  const [expanded, setExpanded] = useState(false);

  if (!tools || tools.length === 0) return null;

  const doneCount = tools.filter(t => t.status === 'done').length;
  const callingCount = tools.filter(t => t.status === 'calling').length;
  const isComplete = callingCount === 0;

  return (
    <div className={cn(
      'rounded-lg border px-3 py-1.5 text-[11px] transition-colors',
      isComplete ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50',
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 text-left"
      >
        {isComplete ? (
          <Check className="h-3 w-3 shrink-0 text-emerald-500" />
        ) : (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-amber-500" />
        )}
        <span className={isComplete ? 'text-emerald-700' : 'text-amber-700'}>
          {isComplete
            ? `已查询 ${doneCount} 个数据源`
            : `正在查询数据源 (${doneCount}/${tools.length})`}
        </span>
        <span className="ml-auto text-[10px] opacity-50">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-1.5 space-y-0.5 border-t border-slate-200/50 pt-1.5">
          {tools.map((t, i) => (
            <div key={i} className="flex items-center gap-1.5 text-slate-500">
              {t.status === 'done' ? (
                <Check className="h-3 w-3 shrink-0 text-emerald-400" />
              ) : (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-amber-400" />
              )}
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {t.summary && <span className="text-slate-400">· {t.summary}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
