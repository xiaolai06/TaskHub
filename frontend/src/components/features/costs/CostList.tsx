'use client';

import { Loader2, Trash2 } from 'lucide-react';
import type { CostRecord } from '@/hooks/useCosts';

const categoryLabel: Record<string, string> = {
  LABOR: '人工',
  MATERIAL: '材料',
  OVERHEAD: '运营',
  OTHER: '其他',
};

function formatYuan(fen: number): string {
  return `¥${(fen / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

export function CostList({
  records,
  isLoading,
  onDelete,
}: {
  records: CostRecord[];
  isLoading?: boolean;
  onDelete?: (id: string) => void;
}) {
  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>;
  }

  if (records.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">暂无成本记录</p>;
  }

  return (
    <div className="divide-y rounded-lg border border-slate-200">
      {records.map((record) => (
        <div key={record.id} className="flex items-center gap-3 px-4 py-3 text-sm">
          <span className="w-16 rounded-full bg-slate-100 px-2 py-0.5 text-center text-2xs-plus text-slate-600">
            {categoryLabel[record.category] || record.category}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-slate-700">{record.description}</p>
            <p className="text-2xs-plus text-slate-400">{new Date(record.date).toLocaleDateString('zh-CN')}</p>
          </div>
          <span className="font-mono text-slate-700">{formatYuan(record.amount)}</span>
          {onDelete && (
            <button onClick={() => onDelete(record.id)} className="rounded-md p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
