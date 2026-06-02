'use client';

import { Loader2 } from 'lucide-react';

export function LoadingIndicator() {
  return (
    <div className="flex gap-3 px-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-slate-200 bg-background px-4 py-3 shadow-sm">
        <span className="inline-flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
        </span>
        <span className="text-[12px] text-slate-500">正在思考</span>
      </div>
    </div>
  );
}
