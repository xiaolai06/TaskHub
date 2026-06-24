'use client';

import { Download, Database, Trash2 } from 'lucide-react';

export function DataTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <button className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card transition-all hover:border-indigo-300 hover:shadow-sm">
          <Download className="h-6 w-6 text-indigo-500" />
          <span className="text-sm font-medium text-foreground/80">导出项目数据</span>
          <span className="text-2xs-plus text-muted-foreground">CSV 格式</span>
        </button>
        <button className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card transition-all hover:border-indigo-300 hover:shadow-sm">
          <Download className="h-6 w-6 text-emerald-500" />
          <span className="text-sm font-medium text-foreground/80">导出客户数据</span>
          <span className="text-2xs-plus text-muted-foreground">CSV 格式</span>
        </button>
      </div>

      <button className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground/70 transition-colors hover:bg-accent">
        <Database className="h-4 w-4 text-muted-foreground" />
        清除本地缓存
      </button>

      <div className="rounded-lg border border-red-200 bg-red-50/30 px-4 py-4 dark:border-red-800/50 dark:bg-red-950/30">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">危险操作</h3>
        <p className="mt-1 text-xs text-red-400">账号注销将删除所有数据，此操作不可恢复</p>
        <button className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-700 active:scale-95">
          <Trash2 className="h-4 w-4" />注销账号
        </button>
      </div>
    </div>
  );
}
