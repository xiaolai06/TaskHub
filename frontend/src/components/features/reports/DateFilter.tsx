'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CustomSelect } from '@/components/ui/custom-select';
import { DatePicker } from '@/components/ui/date-picker';

export type DatePreset = 'day' | 'month' | 'year' | 'custom' | 'range';

export interface DateFilterValue {
  preset: DatePreset;
  period: string;
  type: string;
  endDate?: string;
}

const datePresets = [
  { value: 'custom', label: '全部日期' },
  { value: 'day', label: '今日' },
  { value: 'month', label: '本月' },
  { value: 'year', label: '本年' },
  { value: 'range', label: '自定义' },
];

function getDefaultDate(mode: string): string {
  const n = new Date();
  if (mode === 'day') {
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }
  if (mode === 'year') return `${n.getFullYear()}`;
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

interface DateFilterProps {
  value: DateFilterValue;
  onChange: (v: DateFilterValue) => void;
  className?: string;
}

export function DateFilter({ value, onChange, className }: DateFilterProps) {
  const isCustomRange = value.preset === 'range';
  const isAll = value.preset === 'custom';

  const handlePresetChange = useCallback((preset: string) => {
    const p = preset as DatePreset;
    if (p === 'range') {
      const n = new Date();
      const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
      onChange({ preset: p, period: today, type: 'day', endDate: today });
    } else {
      onChange({
        preset: p,
        period: isAll ? getDefaultDate('month') : getDefaultDate(p),
        type: isAll ? 'month' : p,
      });
    }
  }, [onChange, isAll]);

  const handleStartChange = useCallback((v: string) => {
    onChange({ ...value, period: v });
  }, [onChange, value]);

  const handleEndChange = useCallback((v: string) => {
    onChange({ ...value, endDate: v });
  }, [onChange, value]);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isCustomRange && (
        <>
          <DatePicker
            value={value.period}
            onChange={handleStartChange}
            placeholder="开始日期"
            className="!w-[140px]"
          />
          <DatePicker
            value={value.endDate || value.period}
            onChange={handleEndChange}
            placeholder="结束日期"
            className="!w-[140px]"
          />
        </>
      )}
      <CustomSelect value={value.preset} options={datePresets} onChange={handlePresetChange} />
    </div>
  );
}

/** 创建默认的 DateFilterValue（本月） */
export function createDefaultDateFilter(): DateFilterValue {
  return {
    preset: 'month',
    period: getDefaultDate('month'),
    type: 'month',
  };
}

/** 从 DateFilterValue 生成 API 查询参数 */
export function buildDateQuery(f: DateFilterValue): string {
  const isAll = f.preset === 'custom';
  const apiType = isAll ? 'month' : f.preset === 'range' ? 'day' : f.type;
  const apiPeriod = isAll ? getDefaultDate('month') : f.period;
  let qs = `period=${apiPeriod}&type=${apiType}`;
  if (f.preset === 'range' && f.endDate) qs += `&endDate=${f.endDate}`;
  return qs;
}
