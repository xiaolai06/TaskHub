'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { CustomSelect } from '@/components/ui/custom-select';

interface GoalFilterProps {
  status: string;
  category: string;
  dateFrom: string;
  dateTo: string;
  onStatusChange: (status: string) => void;
  onCategoryChange: (category: string) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
}

const statusTabs = [
  { value: '', label: '全部' },
  { value: 'ACTIVE', label: '进行中' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'AT_RISK', label: '落后' },
  { value: 'ABANDONED', label: '已放弃' },
];

const datePresets = [
  { value: '', label: '全部日期' },
  { value: 'today', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'year', label: '本年' },
  { value: 'custom', label: '自定义' },
];

const categoryOptions = [
  { value: '', label: '全部分类' },
  { value: 'business', label: '💼 经营' },
  { value: 'tasks', label: '📋 任务' },
  { value: 'customers', label: '🤝 客户' },
  { value: 'growth', label: '🌱 成长' },
];

function applyDatePreset(preset: string): { from: string; to: string } {
  if (!preset || preset === 'custom') return { from: '', to: '' };
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === 'today') { const t = fmt(now); return { from: t, to: t }; }
  if (preset === 'week') {
    const day = now.getDay() || 7;
    const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: fmt(mon), to: fmt(sun) };
  }
  if (preset === 'month') {
    return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  }
  if (preset === 'year') {
    return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
  }
  return { from: '', to: '' };
}

export function GoalFilter({
  status, category, dateFrom, dateTo,
  onStatusChange, onCategoryChange, onDateFromChange, onDateToChange,
}: GoalFilterProps) {
  const [datePreset, setDatePreset] = useState('');

  function handlePresetChange(v: string) {
    setDatePreset(v);
    if (v === 'custom') return;
    const { from, to } = applyDatePreset(v);
    onDateFromChange(from);
    onDateToChange(to);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 状态 Tabs */}
      <div className="flex items-center gap-0.5 rounded-lg border border-border/80 bg-card p-0.5 h-8">
        {statusTabs.map((opt) => (
          <button key={opt.value} onClick={() => onStatusChange(opt.value)}
            className={cn(
              'h-7 rounded-md px-2.5 text-xs font-medium transition-all',
              status === opt.value ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted-foreground hover:bg-accent',
            )}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* 分类下拉 */}
      <CustomSelect value={category} options={categoryOptions} onChange={onCategoryChange} />

      {/* 日期下拉 + 自定义日期同行 */}
      <div className="flex items-center gap-2">
        <CustomSelect value={datePreset} options={datePresets} onChange={handlePresetChange} />
        {datePreset === 'custom' && (
          <div className="flex items-center gap-1.5">
            <DatePicker value={dateFrom} onChange={onDateFromChange} placeholder="开始日期" className="!w-[120px]" />
            <span className="text-xs text-muted-foreground/40">—</span>
            <DatePicker value={dateTo} onChange={onDateToChange} placeholder="结束日期" className="!w-[120px]" />
          </div>
        )}
      </div>
    </div>
  );
}
