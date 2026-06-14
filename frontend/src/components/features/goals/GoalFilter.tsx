'use client';

import { cn } from '@/lib/utils';

interface GoalFilterProps {
  status: string;
  type: string;
  onStatusChange: (status: string) => void;
  onTypeChange: (type: string) => void;
}

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'ACTIVE', label: '进行中' },
  { value: 'AT_RISK', label: '进度落后' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'ABANDONED', label: '已放弃' },
];

const typeOptions = [
  { value: '', label: '全部周期' },
  { value: 'MONTHLY', label: '月度' },
  { value: 'QUARTERLY', label: '季度' },
  { value: 'YEARLY', label: '年度' },
];

export function GoalFilter({ status, type, onStatusChange, onTypeChange }: GoalFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 状态筛选 */}
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onStatusChange(opt.value)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
              status === opt.value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 周期筛选 */}
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
        {typeOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onTypeChange(opt.value)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
              type === opt.value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
